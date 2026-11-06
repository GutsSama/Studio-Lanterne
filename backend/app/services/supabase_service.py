"""Service de connexion Supabase et stockage hybride (Mémoire vive + PostgreSQL Supabase).

Assure la persistance complète :
- Tables `parties` et `joueurs_partie` lors de la création d'une partie.
- Tables `messages_partie`, `votes_partie` et `actions_partie` en cours de jeu.
- Mise à jour des tables `statistiques_joueurs` et `succes_joueurs` à la fin d'une partie.
- Gestion du profil joueur (authentifié ou invité persistant pour l'intégrité référentielle).
"""

import logging
from typing import Any
from uuid import UUID

from supabase import Client, create_client

from app.config import settings
from app.models.enums import ArchetypeIA, CampPartie, PhasePartie, RolePersonnage, StatutPartie
from app.models.game import (
    ActionPartie,
    EtatPartie,
    MessagePartie,
    PersonnaliteIA,
    VotePartie,
    utc_now,
)

logger = logging.getLogger(__name__)

# Profil invité persistant garanti dans auth.users et public.profils
INVITE_PROFIL_ID = UUID("00000000-0000-0000-0000-000000000001")

# Les 5 personnalités synchronisées avec les IDs exacts de `public.personnalites_ia`
CATALOGUE_PERSONNALITES_DEFAUT: list[PersonnaliteIA] = [
    PersonnaliteIA(
        id=UUID("4a05a398-9aec-4481-9db5-e062f7468fca"),
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
        id=UUID("bdce3b9f-040b-435c-b013-b5e730fc4233"),
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
        id=UUID("9469786b-62fd-49fc-8913-3ba4255a498b"),
        nom="Bob le Rigolo",
        archetype=ArchetypeIA.DROLE,
        avatar_url="https://api.dicebear.com/7.x/bottts/svg?seed=Bob",
        prompt_systeme=(
            "Tu es Bob (Le Bluffeur Imperturbable). Tu détends l'atmosphère avec de l'humour absurde, "
            "des jeux de mots et une fausse naïveté, mais sous tes airs innocents tu analyses "
            "finement le contexte et manipules les votes."
        ),
        modele_par_defaut="gemini/gemini-3.5-flash-lite",
        temperature=0.85,
    ),
    PersonnaliteIA(
        id=UUID("eb51236c-738d-4f19-934e-86b8cf4a8a80"),
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
        id=UUID("2c7f923c-9686-403e-b914-a59814ae4fe4"),
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
    """Stockage des parties actives en mémoire vive + synchronisation complète avec Supabase."""

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
                "conseil": "Vérifiez que les migrations Supabase ont bien été exécutées.",
            }

    def lister_personnalites(self) -> list[PersonnaliteIA]:
        """Récupère les 5 personnalités IA depuis Supabase (ou le catalogue par défaut mis à jour)."""
        if self.client is not None:
            try:
                res = self.client.table("personnalites_ia").select("*").execute()
                if res.data and len(res.data) >= 5:
                    modeles = [r.get("modele_par_defaut", "") for r in res.data]
                    if all("/" in m for m in modeles):
                        return [PersonnaliteIA.model_validate(row) for row in res.data]
            except Exception as exc:
                logger.debug(
                    "Fallback sur le catalogue local de personnalités IA (%s)", exc
                )
        return list(CATALOGUE_PERSONNALITES_DEFAUT)

    def valider_hote_id(self, hote_id: UUID, nom_joueur: str = "Sarah") -> UUID:
        """Vérifie si l'hôte existe dans `public.profils` pour respecter la clé étrangère SQL."""
        if self.client is None:
            return hote_id
        try:
            res = (
                self.client.table("profils")
                .select("id")
                .eq("id", str(hote_id))
                .execute()
            )
            if res.data and len(res.data) > 0:
                return hote_id
        except Exception as exc:
            logger.debug("Vérification profil hôte : %s", exc)

        # Si le profil n'existe pas (UUID invité ou arbitraire), basculer sur l'invité permanent
        return INVITE_PROFIL_ID

    def sauvegarder_nouvelle_partie(self, partie: EtatPartie) -> None:
        """Sauvegarde l'état de la partie en RAM et persiste la partie et les 6 joueurs dans Supabase."""
        self._parties[partie.id] = partie
        if self.client is None:
            return

        try:
            hote_id_valide = self.valider_hote_id(partie.hote_id)
            partie.hote_id = hote_id_valide

            # 1. Insertion dans la table `parties`
            self.client.table("parties").insert(
                {
                    "id": str(partie.id),
                    "hote_id": str(partie.hote_id),
                    "statut": partie.statut.value,
                    "phase_actuelle": partie.phase_actuelle.value,
                    "tour_actuel": partie.tour_actuel,
                    "camp_vainqueur": (
                        partie.camp_vainqueur.value if partie.camp_vainqueur else None
                    ),
                    "tokens_total_utilises": partie.tokens_total_utilises,
                    "cout_estime_usd": partie.cout_estime_usd,
                }
            ).execute()

            # 2. Insertion des 6 joueurs dans la table `joueurs_partie`
            joueurs_payload = []
            for j in partie.joueurs:
                joueur_data = {
                    "id": str(j.id),
                    "partie_id": str(partie.id),
                    "est_humain": j.est_humain,
                    "joueur_id": str(partie.hote_id) if j.est_humain else None,
                    "personnalite_ia_id": (
                        str(j.personnalite_ia_id)
                        if not j.est_humain and j.personnalite_ia_id
                        else None
                    ),
                    "nom_affiche": j.nom_affiche,
                    "avatar_url": j.avatar_url,
                    "role": j.role.value,
                    "est_vivant": j.est_vivant,
                    "est_capitaine": j.est_capitaine,
                    "numero_siege": j.numero_siege,
                    "memoire_ia": j.memoire_ia.model_dump(mode="json"),
                }
                joueurs_payload.append(joueur_data)

            self.client.table("joueurs_partie").insert(joueurs_payload).execute()
            logger.info("Partie %s persistée dans Supabase avec 6 participants.", partie.id)
        except Exception as exc:
            logger.warning("Échec de synchronisation initiale Supabase : %s", exc)

    def sauvegarder(self, partie: EtatPartie) -> None:
        """Sauvegarde en mémoire vive et met à jour Supabase."""
        self.synchroniser_etat_partie_supabase(partie)

    def synchroniser_etat_partie_supabase(self, partie: EtatPartie) -> None:
        """Met à jour l'avancement, les compteurs et les éliminations dans Supabase."""
        self._parties[partie.id] = partie
        if self.client is None:
            return

        try:
            update_data: dict[str, Any] = {
                "statut": partie.statut.value,
                "phase_actuelle": partie.phase_actuelle.value,
                "tour_actuel": partie.tour_actuel,
                "tokens_total_utilises": partie.tokens_total_utilises,
                "cout_estime_usd": partie.cout_estime_usd,
            }
            if partie.camp_vainqueur:
                update_data["camp_vainqueur"] = partie.camp_vainqueur.value
            if partie.terminee_le:
                update_data["terminee_le"] = partie.terminee_le.isoformat()

            self.client.table("parties").update(update_data).eq("id", str(partie.id)).execute()

            # Mettre à jour les joueurs éliminés
            for j in partie.joueurs:
                if not j.est_vivant and j.tour_mort is not None:
                    self.client.table("joueurs_partie").update(
                        {
                            "est_vivant": False,
                            "tour_mort": j.tour_mort,
                            "cause_mort": j.cause_mort,
                        }
                    ).eq("id", str(j.id)).execute()
        except Exception as exc:
            logger.debug("Mise à jour Supabase partie ignorée : %s", exc)

    def enregistrer_message_supabase(self, msg: MessagePartie) -> None:
        """Persiste un message dans `messages_partie` (déclenche le trigger des tokens)."""
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

    def enregistrer_vote_supabase(self, vote: VotePartie) -> None:
        """Persiste un vote d'élimination dans `votes_partie`."""
        if self.client is None:
            return
        try:
            self.client.table("votes_partie").insert(
                {
                    "id": str(vote.id),
                    "partie_id": str(vote.partie_id),
                    "tour": vote.tour,
                    "phase": vote.phase.value,
                    "joueur_votant_id": str(vote.joueur_votant_id),
                    "joueur_cible_id": str(vote.joueur_cible_id),
                    "argumentation": vote.argumentation,
                }
            ).execute()
        except Exception as exc:
            logger.debug("Insertion Supabase votes_partie ignorée : %s", exc)

    def enregistrer_action_supabase(self, action: ActionPartie) -> None:
        """Persiste une action de pouvoir dans `actions_partie`."""
        if self.client is None:
            return
        try:
            self.client.table("actions_partie").insert(
                {
                    "id": str(action.id),
                    "partie_id": str(action.partie_id),
                    "tour": action.tour,
                    "joueur_acteur_id": str(action.joueur_acteur_id),
                    "type_action": action.type_action.value,
                    "joueur_cible_id": (
                        str(action.joueur_cible_id) if action.joueur_cible_id else None
                    ),
                    "details_resultat": action.details_resultat,
                }
            ).execute()
        except Exception as exc:
            logger.debug("Insertion Supabase actions_partie ignorée : %s", exc)

    def cloturer_partie_et_mettre_a_jour_stats(self, partie: EtatPartie) -> dict[str, Any]:
        """Met à jour les statistiques et débloque les succès du joueur humain à la fin d'une partie."""
        partie.statut = StatutPartie.TERMINEE
        partie.phase_actuelle = PhasePartie.TERMINEE
        if not partie.terminee_le:
            partie.terminee_le = utc_now()

        self.synchroniser_etat_partie_supabase(partie)

        humain = next((j for j in partie.joueurs if j.est_humain), None)
        if humain is None or self.client is None:
            return {"succes_debloques": [], "victoire_humain": False}

        joueur_id = partie.hote_id
        camp_gagnant = partie.camp_vainqueur
        est_creature = humain.role == RolePersonnage.CREATURE
        victoire_humain = (
            (camp_gagnant == CampPartie.CREATURES and est_creature)
            or (camp_gagnant == CampPartie.CITOYENS and not est_creature)
        )

        nouveaux_succes: list[dict[str, Any]] = []

        try:
            # 1. Mise à jour des statistiques de jeu
            res_stats = (
                self.client.table("statistiques_joueurs")
                .select("*")
                .eq("joueur_id", str(joueur_id))
                .execute()
            )
            parties_jouees = 1
            parties_gagnees = 1 if victoire_humain else 0
            parties_perdues = 0 if victoire_humain else 1
            victoires_citoyens = 1 if (victoire_humain and not est_creature) else 0
            victoires_creatures = 1 if (victoire_humain and est_creature) else 0

            if res_stats.data and len(res_stats.data) > 0:
                s = res_stats.data[0]
                parties_jouees = s.get("parties_jouees", 0) + 1
                parties_gagnees = s.get("parties_gagnees", 0) + (1 if victoire_humain else 0)
                parties_perdues = s.get("parties_perdues", 0) + (0 if victoire_humain else 1)
                victoires_citoyens = s.get("victoires_citoyens", 0) + (
                    1 if (victoire_humain and not est_creature) else 0
                )
                victoires_creatures = s.get("victoires_creatures", 0) + (
                    1 if (victoire_humain and est_creature) else 0
                )

                self.client.table("statistiques_joueurs").update(
                    {
                        "parties_jouees": parties_jouees,
                        "parties_gagnees": parties_gagnees,
                        "parties_perdues": parties_perdues,
                        "victoires_citoyens": victoires_citoyens,
                        "victoires_creatures": victoires_creatures,
                        "mis_a_jour_le": utc_now().isoformat(),
                    }
                ).eq("joueur_id", str(joueur_id)).execute()
            else:
                self.client.table("statistiques_joueurs").insert(
                    {
                        "joueur_id": str(joueur_id),
                        "parties_jouees": parties_jouees,
                        "parties_gagnees": parties_gagnees,
                        "parties_perdues": parties_perdues,
                        "victoires_citoyens": victoires_citoyens,
                        "victoires_creatures": victoires_creatures,
                    }
                ).execute()

            # 2. Vérification et déblocage des succès
            res_debloques = (
                self.client.table("succes_joueurs")
                .select("succes_id")
                .eq("joueur_id", str(joueur_id))
                .execute()
            )
            deja_obtenus = {row["succes_id"] for row in (res_debloques.data or [])}

            res_catalogue = self.client.table("succes").select("*").execute()
            catalogue_succes = {row["code"]: row for row in (res_catalogue.data or [])}

            def debloquer(code: str) -> None:
                succes = catalogue_succes.get(code)
                if not succes:
                    return
                succes_id = succes["id"]
                if succes_id not in deja_obtenus:
                    try:
                        self.client.table("succes_joueurs").insert(
                            {
                                "joueur_id": str(joueur_id),
                                "succes_id": succes_id,
                                "debloque_le": utc_now().isoformat(),
                            }
                        ).execute()
                        deja_obtenus.add(succes_id)
                        nouveaux_succes.append(succes)
                        logger.info("Succès débloqué pour le joueur %s : %s", joueur_id, succes["titre"])
                    except Exception as err:
                        logger.debug("Succès déjà débloqué ou erreur : %s", err)

            # Condition 1 : FIRST_BLOOD (Citoyen mort nuit 1 alors que le joueur est Créature)
            if est_creature:
                morts_nuit_1 = [
                    j
                    for j in partie.joueurs
                    if not j.est_vivant and j.tour_mort == 1 and j.role != RolePersonnage.CREATURE
                ]
                if morts_nuit_1:
                    debloquer("FIRST_BLOOD")

            # Condition 2 : SHERLOCK (Inquisition Absolue - Inquisiteur ayant trouvé 2 créatures)
            if humain.role == RolePersonnage.INQUISITEUR:
                inspections = humain.memoire_ia.inspections_inquisiteur
                nb_creatures_trouvees = sum(1 for camp in inspections.values() if camp == "creatures")
                if nb_creatures_trouvees >= 2:
                    debloquer("SHERLOCK")

            # Condition 3 : MASTER_BLUFF (Ombre parmi les Citoyens - Créature gagne avec 0 vote contre elle)
            if est_creature and victoire_humain:
                votes_contre_humain = [
                    v
                    for v in partie.votes
                    if v.joueur_cible_id == humain.id and v.phase == PhasePartie.VOTE_JOUR
                ]
                if len(votes_contre_humain) == 0:
                    debloquer("MASTER_BLUFF")

            # Condition 4 : SURVIVOR (Dernier Rempart - Citoyen vivant lors de la victoire)
            if not est_creature and victoire_humain and humain.est_vivant:
                debloquer("SURVIVOR")

        except Exception as exc:
            logger.warning("Erreur lors de la mise à jour des statistiques/succès : %s", exc)

        return {
            "victoire_humain": victoire_humain,
            "camp_vainqueur": camp_gagnant.value if camp_gagnant else None,
            "nouveaux_succes": nouveaux_succes,
        }

    def obtenir_profil_complet(self, joueur_id: UUID) -> dict[str, Any] | None:
        """Récupère le profil, les statistiques et le catalogue des succès avec statut de déblocage."""
        if self.client is None:
            return None
        try:
            # 1. Profil
            res_profil = (
                self.client.table("profils")
                .select("*")
                .eq("id", str(joueur_id))
                .execute()
            )
            profil = res_profil.data[0] if res_profil.data else None

            # 2. Statistiques
            res_stats = (
                self.client.table("statistiques_joueurs")
                .select("*")
                .eq("joueur_id", str(joueur_id))
                .execute()
            )
            stats = res_stats.data[0] if res_stats.data else {
                "joueur_id": str(joueur_id),
                "parties_jouees": 0,
                "parties_gagnees": 0,
                "parties_perdues": 0,
                "victoires_citoyens": 0,
                "victoires_creatures": 0,
                "temps_de_jeu_total_secondes": 0,
            }

            # 3. Tous les succès du catalogue
            res_succes = self.client.table("succes").select("*").order("points").execute()
            tous_les_succes = res_succes.data or []

            # 4. Succès débloqués
            res_debloques = (
                self.client.table("succes_joueurs")
                .select("succes_id, debloque_le")
                .eq("joueur_id", str(joueur_id))
                .execute()
            )
            map_debloques = {
                row["succes_id"]: row["debloque_le"] for row in (res_debloques.data or [])
            }

            succes_avec_statut = []
            for s in tous_les_succes:
                succes_avec_statut.append(
                    {
                        **s,
                        "debloque": s["id"] in map_debloques,
                        "debloque_le": map_debloques.get(s["id"]),
                    }
                )

            return {
                "profil": profil,
                "statistiques": stats,
                "succes": succes_avec_statut,
            }
        except Exception as exc:
            logger.warning("Erreur lors de la récupération du profil %s : %s", joueur_id, exc)
            return None

    def obtenir(self, partie_id: UUID) -> EtatPartie | None:
        return self._parties.get(partie_id)


depot_parties = DepotPartiesHybride()
