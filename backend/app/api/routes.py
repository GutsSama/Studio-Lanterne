"""Endpoints REST FastAPI avec filtrage anti-triche côté serveur."""

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.engine.fsm import MoteurPartieFSM
from app.engine.rules import (
    ErreurRegleJeu,
    enregistrer_vote,
    executer_action_alchimiste,
    executer_inspection_inquisiteur,
    executer_tir_garde_du_corps,
)
from app.models.enums import CanalMessage, PhasePartie, RolePersonnage, TypeActionJeu
from app.models.game import EtatPartie, MessagePartie
from app.services.supabase_service import depot_parties

router = APIRouter(prefix="/api", tags=["parties"])


class CreerPartieRequete(BaseModel):
    hote_id: UUID = Field(default_factory=uuid4)
    nom_humain: str = Field(default="Joueur", min_length=2, max_length=30)
    consentement_ai_act: bool = Field(
        description="Conformité AI Act obligatoire : le joueur confirme savoir qu'il affronte 5 IA."
    )


class EnvoyerMessageRequete(BaseModel):
    joueur_id: UUID
    contenu: str = Field(min_length=1, max_length=500)
    canal: CanalMessage = CanalMessage.VILLAGE_PUBLIC


class VoterRequete(BaseModel):
    votant_id: UUID
    cible_id: UUID
    argumentation: str | None = None


class ActionSpecialeRequete(BaseModel):
    acteur_id: UUID
    type_action: TypeActionJeu
    cible_id: UUID | None = None


def serialiser_partie_pour_humain(partie: EtatPartie) -> dict[str, Any]:
    """Filtre l'état de la partie pour le client web afin d'empêcher toute triche via l'inspecteur réseau.

    - Masque le rôle des joueurs IA tant qu'ils sont vivants (sauf allié Créature si l'humain est Créature).
    - Supprime systématiquement `memoire_ia.notes_strategiques` (`analyse_interne`).
    - Filtre `messages` selon les droits du joueur humain (équivalent applicatif de la RLS Supabase).
    """
    humain = next((j for j in partie.joueurs if j.est_humain), None)
    role_humain = humain.role if humain else RolePersonnage.CITOYEN
    humain_vivant = humain.est_vivant if humain else True

    joueurs_publics = []
    for j in partie.joueurs:
        montrer_role = (
            j.est_humain
            or not j.est_vivant
            or partie.phase_actuelle == PhasePartie.TERMINEE
            or (
                role_humain == RolePersonnage.CREATURE
                and j.role == RolePersonnage.CREATURE
            )
        )
        joueurs_publics.append(
            {
                "id": str(j.id),
                "est_humain": j.est_humain,
                "nom_affiche": j.nom_affiche,
                "avatar_url": j.avatar_url,
                "role": j.role.value if montrer_role else None,
                "est_vivant": j.est_vivant,
                "numero_siege": j.numero_siege,
                "tour_mort": j.tour_mort,
                "cause_mort": j.cause_mort,
            }
        )

    canaux_autorises = {CanalMessage.VILLAGE_PUBLIC, CanalMessage.SYSTEME}
    if role_humain == RolePersonnage.CREATURE:
        canaux_autorises.add(CanalMessage.CREATURE_SECRET)
    if not humain_vivant:
        canaux_autorises.add(CanalMessage.CHAT_MORTS)

    messages_autorises = [
        m.model_dump(mode="json")
        for m in partie.messages
        if m.canal in canaux_autorises
    ]

    return {
        "id": str(partie.id),
        "statut": partie.statut.value,
        "phase_actuelle": partie.phase_actuelle.value,
        "tour_actuel": partie.tour_actuel,
        "camp_vainqueur": partie.camp_vainqueur.value if partie.camp_vainqueur else None,
        "tokens_total_utilises": partie.tokens_total_utilises,
        "cout_estime_usd": partie.cout_estime_usd,
        "joueurs": joueurs_publics,
        "messages": messages_autorises,
    }


@router.get("/personnalites")
async def lister_personnalites() -> list[dict[str, Any]]:
    return [
        p.model_dump(mode="json") for p in depot_parties.lister_personnalites()
    ]


@router.post("/parties", status_code=201)
async def creer_partie(req: CreerPartieRequete) -> dict[str, Any]:
    if not req.consentement_ai_act:
        raise HTTPException(
            status_code=400,
            detail="Conformité AI Act : vous devez accepter le consentement indiquant que vous affrontez des agents IA.",
        )

    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=req.hote_id,
        nom_humain=req.nom_humain,
        personnalites_ia=depot_parties.lister_personnalites(),
    )
    depot_parties.sauvegarder(moteur.partie)
    return serialiser_partie_pour_humain(moteur.partie)


@router.get("/parties/{partie_id}")
async def obtenir_partie(partie_id: UUID) -> dict[str, Any]:
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")
    return serialiser_partie_pour_humain(partie)


@router.post("/parties/{partie_id}/messages")
async def poster_message(
    partie_id: UUID, req: EnvoyerMessageRequete
) -> dict[str, Any]:
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")

    emetteur = partie.obtenir_joueur(req.joueur_id)
    if emetteur is None:
        raise HTTPException(status_code=404, detail="Joueur introuvable dans cette partie.")

    if (
        req.canal == CanalMessage.CREATURE_SECRET
        and emetteur.role != RolePersonnage.CREATURE
    ):
        raise HTTPException(
            status_code=403,
            detail="Anti-triche : seules les Créatures de la Nuit ont accès au canal secret.",
        )

    msg = MessagePartie(
        partie_id=partie.id,
        joueur_emetteur_id=emetteur.id,
        nom_emetteur=emetteur.nom_affiche,
        canal=req.canal,
        tour=partie.tour_actuel,
        phase=partie.phase_actuelle,
        contenu=req.contenu,
        est_ia=not emetteur.est_humain,
        tokens_utilises=0,
    )
    partie.messages.append(msg)
    return msg.model_dump(mode="json")


@router.post("/parties/{partie_id}/votes")
async def voter(partie_id: UUID, req: VoterRequete) -> dict[str, Any]:
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")

    votant = partie.obtenir_joueur(req.votant_id)
    if votant is None:
        raise HTTPException(status_code=404, detail="Votant introuvable.")

    try:
        vote = enregistrer_vote(partie, votant, req.cible_id, req.argumentation)
        return vote.model_dump(mode="json")
    except ErreurRegleJeu as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/parties/{partie_id}/actions")
async def executer_action(
    partie_id: UUID, req: ActionSpecialeRequete
) -> dict[str, Any]:
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")

    acteur = partie.obtenir_joueur(req.acteur_id)
    if acteur is None:
        raise HTTPException(status_code=404, detail="Acteur introuvable.")

    try:
        if req.type_action == TypeActionJeu.INQUISITEUR_INSPECTER:
            if req.cible_id is None:
                raise ErreurRegleJeu("L'Inquisiteur doit choisir une cible.")
            action = executer_inspection_inquisiteur(partie, acteur, req.cible_id)
        elif req.type_action in (
            TypeActionJeu.ALCHIMISTE_SOIGNER,
            TypeActionJeu.ALCHIMISTE_EMPOISONNER,
        ):
            action = executer_action_alchimiste(
                partie, acteur, req.type_action, req.cible_id
            )
        elif req.type_action == TypeActionJeu.GARDE_DU_CORPS_TIRER:
            if req.cible_id is None:
                raise ErreurRegleJeu("Le Garde du Corps doit choisir une cible.")
            cible = executer_tir_garde_du_corps(partie, acteur, req.cible_id)
            return {"statut": "tir_effectue", "cible_eliminee": cible.nom_affiche}
        else:
            raise ErreurRegleJeu("Type d'action inconnu.")
        return action.model_dump(mode="json")
    except ErreurRegleJeu as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

