"""Schéma JSON strict de réponse des agents IA (REGLELOUPGAROU.md)."""

from pydantic import BaseModel, Field
from app.models.enums import PhasePartie, TypeActionJeu


class ActionTechniqueIA(BaseModel):
    """Action technique extraite de la réponse JSON du LLM et validée par le moteur."""

    phase: PhasePartie = Field(
        description="Phase actuelle du jeu (nuit, debat_jour, vote_jour, tour_alchimiste, tour_garde_du_corps)."
    )
    cible_id: str | None = Field(
        default=None,
        description="Identifiant ou nom du joueur ciblé par le vote ou le pouvoir nocturne (null lors d'un simple débat).",
    )
    pouvoir_utilise: TypeActionJeu | None = Field(
        default=None,
        description="Pouvoir spécial utilisé (inquisiteur_inspecter, alchimiste_soigner, alchimiste_empoisonner, garde_du_corps_tirer ou null).",
    )


class ReponseAgentIA(BaseModel):
    """Format JSON strict imposé à chaque agent IA.

    IMPORTANT : `analyse_interne` reste exclusivement côté serveur et n'est
    JAMAIS diffusé via WebSocket ni stocké dans les messages publics.
    """

    analyse_interne: str = Field(
        min_length=1,
        description="Pensée stratégique secrète (Chain-of-Thought masqué aux autres joueurs).",
    )
    action_technique: ActionTechniqueIA = Field(
        description="Décision technique soumise à l'arbitrage du moteur Python."
    )
    declaration_publique: str = Field(
        default="",
        description="Message prononcé dans le canal actif (public le jour, secret la nuit entre Créatures).",
    )

