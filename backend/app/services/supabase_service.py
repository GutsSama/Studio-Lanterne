"""Service de connexion Supabase et stockage hybride (Mémoire vive + PostgreSQL Supabase)."""

import logging
from typing import Any
from uuid import UUID

from supabase import Client, create_client

from app.config import settings
from app.models.enums import ArchetypeIA
from app.models.game import EtatPartie, MessagePartie, PersonnaliteIA

logger = logging.getLogger(__name__)


CATALOGUE_PERSONNALITES_DEFAUT: list[PersonnaliteIA] = [
    PersonnaliteIA(
        nom="Gérard le Râleur",
        archetype=ArchetypeIA.MAUVAIS_JOUEUR,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Gerard",
        prompt_systeme=(
            "Tu es Gérard (Le Leader Agressif). Tu es méfiant, impulsif et mauvais joueur. "
            "Tu lances le débat, tu accuses vite les autres, tu te plains dès qu'on vote contre toi "
            "et tu râles quand les Citoyens font des erreurs."
        ),
        modele_par_defaut="groq/openai/gpt-oss-20b",
        temperature=0.75,
    ),
    PersonnaliteIA(
        nom="Elena la Stratège",
        archetype=ArchetypeIA.STRATEGE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Elena",
        prompt_systeme=(
            "Tu es Elena (La Logicienne Méfiante). Analytique, calme et méthodique. "
            "Tu observes les incohérences de vote, tu calcules les probabilités et tu construis "
            "des argumentaires logiques et froids."
        ),
        modele_par_defaut="mistral/mistral-small-latest",
        temperature=0.40,
    ),
    PersonnaliteIA(
        nom="Bob le Rigolo",
        archetype=ArchetypeIA.DROLE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Bob",
        prompt_systeme=(
            "Tu es Bob (Le Bluffeur Imperturbable). Tu détends l'atmosphère avec de l'humour absurde, "
            "des jeux de mots et une fausse naïveté, mais sous tes airs innocents tu analyses "
            "finement le contexte et manipules les votes."
        ),
        modele_par_defaut="gemini/gemini-2.5-flash",
        temperature=0.85,
    ),
    PersonnaliteIA(
        nom="Sœur Béatrice la Mystique",
        archetype=ArchetypeIA.MYSTIQUE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Beatrice",
        prompt_systeme=(
            "Tu es Sœur Béatrice (La Diplomate Mystique). Tu dis agir par intuition divine, "
            "rêves prémonitoires et signes du destin. Tu parles de façon solennelle et énigmatique "
            "pour apaiser les tensions ou orienter le conseil."
        ),
        modele_par_defaut="mistral/mistral-small-latest",
        temperature=0.70,
    ),
    PersonnaliteIA(
        nom="Lucas le Paranoïaque",
        archetype=ArchetypeIA.PARANOIAQUE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Lucas",
        prompt_systeme=(
            "Tu es Lucas (Le Suiveur Nerveux). Tu as peur de tout le monde, tu crois à un complot "
            "permanent des Créatures de la Nuit et tu rebondis nerveusement dès qu'un joueur hausse le ton."
        ),
        modele_par_defaut="groq/qwen/qwen3.8-27b",
        temperature=0.80,
    ),
]


class DepotPartiesHybride:
    """Stockage des parties actives en mémoire vive + synchronisation avec Supabase."""

    def __init__(self) -> None:
        self._parties: dict[UUID, EtatPartie] = {}
        self._client: Client | None = None

    @property
    def client(self) -> Client | None:
        """Initialise paresseusement le client Supabase avec la clé Service Role (ou Anon)."""
        if self._client is not None:
            return self._client

        url = settings.supabase_url.strip()
        key = (settings.supabase_service_role_key or settings.supabase_anon_key).strip()
        if not url or not key or not url.startswith("https://"):
            return None

        try:
            self._client = create_client(url, key)
            return self._client
        except Exception as exc:
            logger.warning("Impossible d'initialiser le client Supabase : %s", exc)
            return None

    def verifier_connexion_supabase(self) -> dict[str, Any]:
        """Teste la connexion réelle à Supabase et vérifie si les tables du schéma existent."""
        if self.client is None:
            return {
                "connecte": False,
                "url": settings.supabase_url,
                "detail": "Client Supabase non configuré (vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY).",
            }

        try:
            res = (
                self.client.table("personnalites_ia")
                .select("id, nom, archetype, modele_par_defaut")
                .limit(10)
                .execute()
            )
            return {
                "connecte": True,
                "url": settings.supabase_url,
                "table_personnalites_ia_ok": True,
                "nb_personnalites_en_base": len(res.data),
                "personnalites": res.data,
            }
        except Exception as exc:
            return {
                "connecte": False,
                "url": settings.supabase_url,
                "table_personnalites_ia_ok": False,
                "erreur": str(exc),
                "conseil": (
                    "Si l'erreur indique que la table 'public.personnalites_ia' n'existe pas "
                    "ou a l'ancien schéma, exécutez le contenu de supabase/migrations/20261103000000_initial_schema.sql "
                    "puis supabase/seed.sql dans l'éditeur SQL de votre dashboard Supabase."
                ),
            }

    def lister_personnalites(self) -> list[PersonnaliteIA]:
        """Récupère les 5 personnalités IA depuis Supabase (ou le catalogue par défaut mis à jour)."""
        if self.client is not None:
            try:
                res = self.client.table("personnalites_ia").select("*").execute()
                if res.data and len(res.data) >= 5:
                    # Vérifier que le seed en base est bien à jour (pas d'anciens modèles retirés)
                    modeles = [r.get("modele_par_defaut", "") for r in res.data]
                    if all(
                        "/" in m
                        and "gemini-1.5" not in m
                        and "llama-3.1" not in m
                        for m in modeles
                    ):
                        return [PersonnaliteIA.model_validate(row) for row in res.data]
            except Exception as exc:
                logger.debug(
                    "Fallback sur le catalogue local de personnalités IA (%s)", exc
                )
        return list(CATALOGUE_PERSONNALITES_DEFAUT)

    def sauvegarder(self, partie: EtatPartie) -> None:
        """Sauvegarde l'état de la partie en mémoire vive."""
        self._parties[partie.id] = partie

    def enregistrer_message_supabase(self, msg: MessagePartie) -> None:
        """Tente de persister un message dans la table `messages_partie` de Supabase si la partie y existe."""
        if self.client is None:
            return
        try:
            self.client.table("messages_partie").insert(
                {
                    "id": str(msg.id),
                    "partie_id": str(msg.partie_id),
                    "joueur_emetteur_id": (
                        str(msg.joueur_emetteur_id) if msg.joueur_emetteur_id else None
                    ),
                    "canal": msg.canal.value,
                    "tour": msg.tour,
                    "phase": msg.phase.value,
                    "contenu": msg.contenu,
                    "est_ia": msg.est_ia,
                    "tokens_utilises": msg.tokens_utilises,
                }
            ).execute()
        except Exception as exc:
            logger.debug("Insertion Supabase messages_partie ignorée : %s", exc)

    def obtenir(self, partie_id: UUID) -> EtatPartie | None:
        return self._parties.get(partie_id)


depot_parties = DepotPartiesHybride()
