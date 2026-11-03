"""Orchestrateur IA multi-fournisseurs (Groq, Mistral, Gemini) via LiteLLM."""

import asyncio
import json
import logging
from typing import Any

import litellm
from pydantic import ValidationError

from app.agents.context_builder import construire_messages_llm
from app.config import settings
from app.engine.rules import choisir_cible_aleatoire_fallback
from app.models.ai_schema import ActionTechniqueIA, ReponseAgentIA
from app.models.enums import PhasePartie, RolePersonnage, TypeActionJeu
from app.models.game import EtatPartie, JoueurPartie

logger = logging.getLogger(__name__)


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
    """Interroge un agent IA via LiteLLM avec timeout strict (3.5s), plafond de tokens et fallback.

    Retourne `(ReponseAgentIA, tokens_utilises)`.
    """
    # 1. Garde-fou budgétaire (Plafond d'urgence 50 000 tokens par partie)
    if partie.tokens_total_utilises >= settings.max_tokens_per_game:
        logger.warning(
            "Plafond de tokens atteint (%d/%d) pour la partie %s. Passage en fallback.",
            partie.tokens_total_utilises,
            settings.max_tokens_per_game,
            partie.id,
        )
        return construire_reponse_fallback(partie, agent, raison="plafond_tokens_atteint"), 0

    modele = (
        agent.personnalite.modele_par_defaut
        if agent.personnalite
        else "mistral/mistral-small-latest"
    )
    temperature = agent.personnalite.temperature if agent.personnalite else 0.70
    messages = construire_messages_llm(partie, agent, instruction_phase)

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

        contenu_brut: str = response.choices[0].message.content or "{}"
        tokens_utilises: int = getattr(response.usage, "total_tokens", 0) or 0

        donnees = json.loads(contenu_brut)
        reponse_validee = ReponseAgentIA.model_validate(donnees)

        # Mise à jour de la mémoire stratégique interne (strictement côté serveur)
        agent.memoire_ia.notes_strategiques.append(reponse_validee.analyse_interne)
        agent.memoire_ia.notes_strategiques = agent.memoire_ia.notes_strategiques[-5:]

        # Mise à jour du compteur de tokens de la partie
        partie.tokens_total_utilises += tokens_utilises
        partie.cout_estime_usd = round(
            partie.cout_estime_usd + (tokens_utilises * 0.000001), 6
        )

        return reponse_validee, tokens_utilises

    except (asyncio.TimeoutError, ValidationError, json.JSONDecodeError, Exception) as exc:
        logger.warning(
            "Fallback activé pour l'agent %s (%s) : %s",
            agent.nom_affiche,
            modele,
            exc,
        )
        return construire_reponse_fallback(partie, agent, raison=type(exc).__name__), 0

