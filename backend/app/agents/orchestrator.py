"""Orchestrateur IA multi-fournisseurs (Groq, Mistral, Gemini) via LiteLLM avec télémétrie et calcul de coûts réels."""

import asyncio
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any
from uuid import UUID

import litellm
from pydantic import BaseModel, Field, ValidationError

from app.agents.context_builder import construire_messages_llm
from app.config import settings
from app.engine.rules import choisir_cible_aleatoire_fallback
from app.models.ai_schema import ActionTechniqueIA, ReponseAgentIA
from app.models.enums import PhasePartie, RolePersonnage, TypeActionJeu
from app.models.game import EtatPartie, JoueurPartie

logger = logging.getLogger(__name__)


class TraceAppelLLM(BaseModel):
    """Enregistrement télémétrique d'un appel LiteLLM (sans exposer `analyse_interne`)."""

    horodatage: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%H:%M:%S")
    )
    partie_id: str
    agent_nom: str
    modele: str
    fournisseur: str
    phase: str
    statut: str  # "succes" | "fallback"
    latence_ms: float
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cout_usd: float = 0.0
    erreur: str | None = None


class ObservabiliteLiteLLM:
    """Collecteur en mémoire vive des métriques de coûts, tokens et latence par modèle et par agent."""

    def __init__(self) -> None:
        self.historique: list[TraceAppelLLM] = []

    def enregistrer(self, trace: TraceAppelLLM) -> None:
        self.historique.append(trace)
        # Conserver les 200 derniers appels
        if len(self.historique) > 200:
            self.historique = self.historique[-200:]

    def calculer_synthese(self) -> dict[str, Any]:
        total_appels = len(self.historique)
        appels_succes = sum(1 for t in self.historique if t.statut == "succes")
        appels_fallback = total_appels - appels_succes
        total_tokens = sum(t.total_tokens for t in self.historique)
        cout_total_usd = round(sum(t.cout_usd for t in self.historique), 6)
        latence_moyenne_ms = (
            round(sum(t.latence_ms for t in self.historique) / total_appels, 1)
            if total_appels > 0
            else 0.0
        )

        par_modele: dict[str, dict[str, Any]] = {}
        par_agent: dict[str, dict[str, Any]] = {}

        for t in self.historique:
            # Agrégation par modèle
            m_stat = par_modele.setdefault(
                t.modele,
                {
                    "modele": t.modele,
                    "fournisseur": t.fournisseur,
                    "appels": 0,
                    "succes": 0,
                    "fallbacks": 0,
                    "total_tokens": 0,
                    "cout_usd": 0.0,
                    "latence_totale_ms": 0.0,
                    "derniere_erreur": None,
                },
            )
            m_stat["appels"] += 1
            if t.statut == "succes":
                m_stat["succes"] += 1
            else:
                m_stat["fallbacks"] += 1
                if t.erreur:
                    m_stat["derniere_erreur"] = t.erreur
            m_stat["total_tokens"] += t.total_tokens
            m_stat["cout_usd"] = round(m_stat["cout_usd"] + t.cout_usd, 6)
            m_stat["latence_totale_ms"] += t.latence_ms

            # Agrégation par agent IA
            a_stat = par_agent.setdefault(
                t.agent_nom,
                {
                    "agent_nom": t.agent_nom,
                    "modele": t.modele,
                    "appels": 0,
                    "succes": 0,
                    "fallbacks": 0,
                    "total_tokens": 0,
                    "cout_usd": 0.0,
                    "latence_moyenne_ms": 0.0,
                    "_latence_cumulee": 0.0,
                },
            )
            a_stat["appels"] += 1
            if t.statut == "succes":
                a_stat["succes"] += 1
            else:
                a_stat["fallbacks"] += 1
            a_stat["total_tokens"] += t.total_tokens
            a_stat["cout_usd"] = round(a_stat["cout_usd"] + t.cout_usd, 6)
            a_stat["_latence_cumulee"] += t.latence_ms
            a_stat["latence_moyenne_ms"] = round(
                a_stat["_latence_cumulee"] / a_stat["appels"], 1
            )

        liste_modeles = []
        for m in par_modele.values():
            lat_moy = round(m["latence_totale_ms"] / m["appels"], 1) if m["appels"] else 0.0
            liste_modeles.append(
                {
                    "modele": m["modele"],
                    "fournisseur": m["fournisseur"],
                    "appels": m["appels"],
                    "succes": m["succes"],
                    "fallbacks": m["fallbacks"],
                    "total_tokens": m["total_tokens"],
                    "cout_usd": m["cout_usd"],
                    "latence_moyenne_ms": lat_moy,
                    "derniere_erreur": m["derniere_erreur"],
                }
            )

        liste_agents = [
            {k: v for k, v in a.items() if not k.startswith("_")}
            for a in par_agent.values()
        ]

        return {
            "resume_global": {
                "total_appels": total_appels,
                "appels_succes": appels_succes,
                "appels_fallback": appels_fallback,
                "taux_succes_pct": (
                    round((appels_succes / total_appels) * 100, 1)
                    if total_appels > 0
                    else 100.0
                ),
                "total_tokens": total_tokens,
                "plafond_tokens_par_partie": settings.max_tokens_per_game,
                "cout_total_usd": cout_total_usd,
                "latence_moyenne_ms": latence_moyenne_ms,
            },
            "par_modele": liste_modeles,
            "par_agent": liste_agents,
            "derniers_appels": [
                t.model_dump() for t in reversed(self.historique[-30:])
            ],
        }


observabilite_llm = ObservabiliteLiteLLM()


def extraire_fournisseur(modele: str) -> str:
    if "/" in modele:
        return modele.split("/", 1)[0].upper()
    return "DEFAULT"


def calculer_cout_reel_litellm(response: Any, modele: str, total_tokens: int) -> float:
    """Calcule le coût exact en USD via `litellm.completion_cost` (avec repli tarifaire si inconnu)."""
    try:
        cout = float(
            litellm.completion_cost(completion_response=response, model=modele)
        )
        if cout > 0:
            return round(cout, 6)
    except Exception:
        pass
    # Repli tarifaire moyen (~0.15$ / 1M tokens pour Flash / Llama 8B / Mistral Small)
    return round(total_tokens * 0.00000015, 6)


def construire_reponse_fallback(
    partie: EtatPartie,
    agent: JoueurPartie,
    raison: str = "timeout_ou_erreur_llm",
) -> ReponseAgentIA:
    """Génère une réponse de secours valide si un modèle dépasse le timeout (3.5s) ou échoue."""
    cible_id: str | None = None
    pouvoir: TypeActionJeu | None = None

    if partie.phase_actuelle in (
        PhasePartie.VOTE_JOUR,
        PhasePartie.NUIT,
        PhasePartie.TOUR_GARDE_DU_CORPS,
    ):
        exclure_creatures = (
            partie.phase_actuelle == PhasePartie.NUIT
            and agent.role == RolePersonnage.CREATURE
        )
        cible = choisir_cible_aleatoire_fallback(
            partie, agent, exclure_creatures=exclure_creatures
        )
        cible_id = str(cible.id) if cible else None

        if (
            partie.phase_actuelle == PhasePartie.NUIT
            and agent.role == RolePersonnage.INQUISITEUR
        ):
            pouvoir = TypeActionJeu.INQUISITEUR_INSPECTER
        elif partie.phase_actuelle == PhasePartie.TOUR_GARDE_DU_CORPS:
            pouvoir = TypeActionJeu.GARDE_DU_CORPS_TIRER

    declaration = (
        "Je préfère observer encore un instant avant de me prononcer."
        if partie.phase_actuelle == PhasePartie.DEBAT_JOUR
        else "Je maintiens ma décision."
    )

    return ReponseAgentIA(
        analyse_interne=f"[FALLBACK AUTOMATIQUE : {raison}]",
        action_technique=ActionTechniqueIA(
            phase=partie.phase_actuelle,
            cible_id=cible_id,
            pouvoir_utilise=pouvoir,
        ),
        declaration_publique=declaration,
    )


async def interroger_agent_ia(
    partie: EtatPartie,
    agent: JoueurPartie,
    instruction_phase: str,
) -> tuple[ReponseAgentIA, int]:
    """Interroge un agent IA via LiteLLM avec timeout strict (3.5s), calcul de coût réel et télémétrie.

    Retourne `(ReponseAgentIA, tokens_utilises)`.
    """
    modele = (
        agent.personnalite.modele_par_defaut
        if agent.personnalite
        else "mistral/mistral-small-latest"
    )
    fournisseur = extraire_fournisseur(modele)

    # 1. Garde-fou budgétaire (Plafond d'urgence 50 000 tokens par partie)
    if partie.tokens_total_utilises >= settings.max_tokens_per_game:
        observabilite_llm.enregistrer(
            TraceAppelLLM(
                partie_id=str(partie.id),
                agent_nom=agent.nom_affiche,
                modele=modele,
                fournisseur=fournisseur,
                phase=partie.phase_actuelle.value,
                statut="fallback",
                latence_ms=0.0,
                erreur="Plafond de 50 000 tokens atteint sur la partie",
            )
        )
        return construire_reponse_fallback(partie, agent, raison="plafond_tokens_atteint"), 0

    temperature = agent.personnalite.temperature if agent.personnalite else 0.70
    messages = construire_messages_llm(partie, agent, instruction_phase)
    debut = time.perf_counter()

    try:
        response: Any = await asyncio.wait_for(
            litellm.acompletion(
                model=modele,
                messages=messages,
                temperature=temperature,
                response_format={"type": "json_object"},
                max_tokens=300,
            ),
            timeout=settings.llm_timeout_seconds,
        )
        latence_ms = round((time.perf_counter() - debut) * 1000, 1)

        contenu_brut: str = response.choices[0].message.content or "{}"
        usage = getattr(response, "usage", None)
        prompt_tokens: int = getattr(usage, "prompt_tokens", 0) or 0
        completion_tokens: int = getattr(usage, "completion_tokens", 0) or 0
        tokens_utilises: int = (
            getattr(usage, "total_tokens", 0) or (prompt_tokens + completion_tokens)
        )
        cout_appel = calculer_cout_reel_litellm(response, modele, tokens_utilises)

        donnees = json.loads(contenu_brut)
        reponse_validee = ReponseAgentIA.model_validate(donnees)

        # Mise à jour de la mémoire stratégique interne (strictement côté serveur)
        agent.memoire_ia.notes_strategiques.append(reponse_validee.analyse_interne)
        agent.memoire_ia.notes_strategiques = agent.memoire_ia.notes_strategiques[-5:]

        # Mise à jour du compteur de tokens et coût réel de la partie
        partie.tokens_total_utilises += tokens_utilises
        partie.cout_estime_usd = round(partie.cout_estime_usd + cout_appel, 6)

        observabilite_llm.enregistrer(
            TraceAppelLLM(
                partie_id=str(partie.id),
                agent_nom=agent.nom_affiche,
                modele=modele,
                fournisseur=fournisseur,
                phase=partie.phase_actuelle.value,
                statut="succes",
                latence_ms=latence_ms,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=tokens_utilises,
                cout_usd=cout_appel,
            )
        )

        return reponse_validee, tokens_utilises

    except (asyncio.TimeoutError, ValidationError, json.JSONDecodeError, Exception) as exc:
        latence_ms = round((time.perf_counter() - debut) * 1000, 1)
        msg_erreur = f"{type(exc).__name__}: {str(exc)[:180]}"
        logger.warning(
            "Fallback activé pour l'agent %s (%s) : %s",
            agent.nom_affiche,
            modele,
            msg_erreur,
        )
        observabilite_llm.enregistrer(
            TraceAppelLLM(
                partie_id=str(partie.id),
                agent_nom=agent.nom_affiche,
                modele=modele,
                fournisseur=fournisseur,
                phase=partie.phase_actuelle.value,
                statut="fallback",
                latence_ms=latence_ms,
                erreur=msg_erreur,
            )
        )
        return construire_reponse_fallback(partie, agent, raison=type(exc).__name__), 0
