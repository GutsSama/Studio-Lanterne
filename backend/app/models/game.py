"""Modèles métier représentant l'état d'une partie, les joueurs, messages, votes et actions."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
from app.models.enums import (
    ArchetypeIA,
    CampPartie,
    CanalMessage,
    PhasePartie,
    RolePersonnage,
    StatutPartie,
    TypeActionJeu,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PersonnaliteIA(BaseModel):
    """Profil psychologique et configuration LLM d'un agent IA (table `personnalites_ia`)."""

    id: UUID = Field(default_factory=uuid4)
    nom: str
    archetype: ArchetypeIA
    avatar_url: str
    prompt_systeme: str
    modele_par_defaut: str = "mistral/mistral-small-latest"
    temperature: float = 0.70


class MemoireInterneIA(BaseModel):
    """Mémoire privée d'un joueur/agent au cours de la partie (`memoire_ia` JSONB)."""

    inspections_inquisiteur: dict[str, str] = Field(
        default_factory=dict,
        description="Map {joueur_id: camp_decouvert} connue uniquement de l'Inquisiteur.",
    )
    potion_vie_disponible: bool = Field(
        default=True,
        description="Indique si l'Alchimiste possède encore sa potion de Vie.",
    )
    potion_mort_disponible: bool = Field(
        default=True,
        description="Indique si l'Alchimiste possède encore sa potion de Mort.",
    )
    notes_strategiques: list[str] = Field(
        default_factory=list,
        description="Dernières analyses internes de l'agent IA (jamais exposées au client).",
    )


class JoueurPartie(BaseModel):
    """Participant (Humain ou Agent IA) dans une partie (table `joueurs_partie`)."""

    id: UUID = Field(default_factory=uuid4)
    partie_id: UUID
    est_humain: bool = False
    joueur_id: UUID | None = None
    personnalite_ia_id: UUID | None = None
    nom_affiche: str
    avatar_url: str
    role: RolePersonnage
    est_vivant: bool = True
    est_capitaine: bool = False
    tour_mort: int | None = None
    cause_mort: str | None = None
    numero_siege: int
    memoire_ia: MemoireInterneIA = Field(default_factory=MemoireInterneIA)
    personnalite: PersonnaliteIA | None = None

    @property
    def camp(self) -> CampPartie:
        if self.role == RolePersonnage.CREATURE:
            return CampPartie.CREATURES
        return CampPartie.CITOYENS


class MessagePartie(BaseModel):
    """Message de chat (public, secret créatures, morts ou système — table `messages_partie`)."""

    id: UUID = Field(default_factory=uuid4)
    partie_id: UUID
    joueur_emetteur_id: UUID | None = None
    nom_emetteur: str = "Système"
    canal: CanalMessage = CanalMessage.VILLAGE_PUBLIC
    tour: int
    phase: PhasePartie
    contenu: str
    est_ia: bool = True
    tokens_utilises: int = 0
    cree_le: datetime = Field(default_factory=utc_now)


class VotePartie(BaseModel):
    """Vote d'élimination (table `votes_partie`)."""

    id: UUID = Field(default_factory=uuid4)
    partie_id: UUID
    tour: int
    phase: PhasePartie
    joueur_votant_id: UUID
    joueur_cible_id: UUID
    argumentation: str | None = None
    cree_le: datetime = Field(default_factory=utc_now)


class ActionPartie(BaseModel):
    """Action spéciale nocturne ou tir du Garde du Corps (table `actions_partie`)."""

    id: UUID = Field(default_factory=uuid4)
    partie_id: UUID
    tour: int
    joueur_acteur_id: UUID
    type_action: TypeActionJeu
    joueur_cible_id: UUID | None = None
    details_resultat: dict = Field(default_factory=dict)
    cree_le: datetime = Field(default_factory=utc_now)


class EtatPartie(BaseModel):
    """État complet en mémoire vive d'une partie (table `parties` + relations)."""

    id: UUID = Field(default_factory=uuid4)
    hote_id: UUID
    statut: StatutPartie = StatutPartie.EN_ATTENTE
    phase_actuelle: PhasePartie = PhasePartie.NUIT
    tour_actuel: int = 1
    camp_vainqueur: CampPartie | None = None
    tokens_total_utilises: int = 0
    cout_estime_usd: float = 0.0
    joueurs: list[JoueurPartie] = Field(default_factory=list)
    messages: list[MessagePartie] = Field(default_factory=list)
    votes: list[VotePartie] = Field(default_factory=list)
    actions: list[ActionPartie] = Field(default_factory=list)
    victime_provisoire_nuit_id: UUID | None = Field(
        default=None,
        description="Victime désignée par les Créatures avant l'intervention éventuelle de l'Alchimiste.",
    )
    garde_du_corps_en_attente_id: UUID | None = Field(
        default=None,
        description="Si le Garde du Corps vient de mourir, son ID en attente de son tir final.",
    )
    creee_le: datetime = Field(default_factory=utc_now)
    terminee_le: datetime | None = None

    def obtenir_joueur(self, joueur_id: UUID | str) -> JoueurPartie | None:
        cible_str = str(joueur_id).strip().lower()
        for j in self.joueurs:
            if str(j.id).lower() == cible_str or j.nom_affiche.lower() == cible_str:
                return j
        return None

    def joueurs_vivants(self) -> list[JoueurPartie]:
        return [j for j in self.joueurs if j.est_vivant]

    def creatures_vivantes(self) -> list[JoueurPartie]:
        return [
            j
            for j in self.joueurs
            if j.est_vivant and j.role == RolePersonnage.CREATURE
        ]

    def citoyens_vivants(self) -> list[JoueurPartie]:
        return [
            j
            for j in self.joueurs
            if j.est_vivant and j.role != RolePersonnage.CREATURE
        ]

