"""Endpoints REST FastAPI avec filtrage anti-triche et simulation de tours IA."""

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.orchestrator import interroger_agent_ia
from app.engine.fsm import MoteurPartieFSM
from app.engine.rules import (
    ErreurRegleJeu,
    choisir_cible_aleatoire_fallback,
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
    nom_humain: str = Field(default="Sarah", min_length=2, max_length=30)
    consentement_ai_act: bool = Field(
        default=True,
        description="Conformité AI Act obligatoire : le joueur confirme savoir qu'il affronte 5 IA.",
    )
    role_humain_force: RolePersonnage | None = Field(
        default=None,
        description="Optionnel : forcer le rôle du joueur humain pour tester un rôle précis.",
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
                "modele_ia": (
                    j.personnalite.modele_par_defaut if j.personnalite else None
                ),
                "archetype": (
                    j.personnalite.archetype.value if j.personnalite else None
                ),
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

    # Informations secrètes strictement réservées au rôle du joueur humain
    informations_role_humain: dict[str, Any] = {}
    if humain is not None:
        if role_humain == RolePersonnage.INQUISITEUR:
            informations_role_humain["inspections_inquisiteur"] = dict(
                humain.memoire_ia.inspections_inquisiteur
            )
        elif role_humain == RolePersonnage.ALCHIMISTE:
            informations_role_humain["potion_vie_disponible"] = (
                humain.memoire_ia.potion_vie_disponible
            )
            informations_role_humain["potion_mort_disponible"] = (
                humain.memoire_ia.potion_mort_disponible
            )
            informations_role_humain["victime_provisoire_nuit_id"] = (
                str(partie.victime_provisoire_nuit_id)
                if partie.victime_provisoire_nuit_id
                else None
            )
        elif role_humain == RolePersonnage.GARDE_DU_CORPS:
            informations_role_humain["doit_tirer"] = (
                partie.garde_du_corps_en_attente_id == humain.id
            )

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
        "informations_role_humain": informations_role_humain,
    }


@router.get("/db-status", tags=["systeme"])
async def verifier_connexion_bdd() -> dict[str, Any]:
    """Vérifie en direct la connexion à Supabase et la présence des tables."""
    return depot_parties.verifier_connexion_supabase()


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
        role_humain_force=req.role_humain_force,
    )
    depot_parties.sauvegarder(moteur.partie)
    return serialiser_partie_pour_humain(moteur.partie)


@router.get("/parties/{partie_id}")
async def obtenir_partie(partie_id: UUID) -> dict[str, Any]:
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")
    return serialiser_partie_pour_humain(partie)


@router.post("/parties/{partie_id}/simuler-tour")
async def simuler_tour_ia(partie_id: UUID) -> dict[str, Any]:
    """Fait avancer automatiquement la phase actuelle en interrogeant les 5 agents IA via LiteLLM.

    - Si la partie est en `nuit` ou `tour_alchimiste` : exécute les actions nocturnes des IA (Inquisiteur, Créatures, Alchimiste), résout l'Aube et passe à `debat_jour`.
    - Si la partie est en `debat_jour` : fait parler séquentiellement chaque agent IA vivant dans le chat public, puis passe à `vote_jour`.
    - Si la partie est en `vote_jour` : fait voter tous les agents IA vivants, dépouille le vote du Conseil et passe à la nuit suivante.
    - Si la partie est en `tour_garde_du_corps` : fait tirer le Garde du Corps et reprend la partie.
    """
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")

    moteur = MoteurPartieFSM(partie)
    phase_depart = partie.phase_actuelle
    evenements_tour: list[str] = []

    if phase_depart == PhasePartie.TERMINEE:
        return {
            "phase_executee": phase_depart.value,
            "evenements": ["La partie est déjà terminée."],
            "etat": serialiser_partie_pour_humain(partie),
        }

    # 1. PHASE DE NUIT -> Actions secrètes IA + Résolution de l'Aube
    if phase_depart in (PhasePartie.NUIT, PhasePartie.TOUR_ALCHIMISTE):
        if partie.phase_actuelle == PhasePartie.NUIT:
            # a) Inquisiteur IA
            inquisiteur = next(
                (
                    j
                    for j in partie.joueurs_vivants()
                    if not j.est_humain and j.role == RolePersonnage.INQUISITEUR
                ),
                None,
            )
            if inquisiteur:
                rep_inq, _ = await interroger_agent_ia(
                    partie,
                    inquisiteur,
                    "C'est la nuit. Choisis un joueur vivant (cible_id) à inspecter avec le pouvoir 'inquisiteur_inspecter'.",
                )
                cible_inq = (
                    partie.obtenir_joueur(rep_inq.action_technique.cible_id)
                    if rep_inq.action_technique.cible_id
                    else None
                )
                if not cible_inq or not cible_inq.est_vivant or cible_inq.id == inquisiteur.id:
                    cible_inq = choisir_cible_aleatoire_fallback(partie, inquisiteur)
                if cible_inq:
                    try:
                        executer_inspection_inquisiteur(partie, inquisiteur, cible_inq.id)
                        evenements_tour.append("L'Inquisiteur a inspecté un joueur dans l'ombre.")
                    except ErreurRegleJeu:
                        pass

            # b) Créatures de la Nuit IA (discussion secrète + vote nocturne)
            for creature in partie.creatures_vivantes():
                if creature.est_humain:
                    continue
                rep_creat, tokens_c = await interroger_agent_ia(
                    partie,
                    creature,
                    "C'est la nuit. Propose à ton coéquipier Créature une cible Citoyen à dévorer et indique son id ou nom dans cible_id.",
                )
                if rep_creat.declaration_publique:
                    msg_secret = MessagePartie(
                        partie_id=partie.id,
                        joueur_emetteur_id=creature.id,
                        nom_emetteur=creature.nom_affiche,
                        canal=CanalMessage.CREATURE_SECRET,
                        tour=partie.tour_actuel,
                        phase=PhasePartie.NUIT,
                        contenu=rep_creat.declaration_publique,
                        est_ia=True,
                        tokens_utilises=tokens_c,
                    )
                    partie.messages.append(msg_secret)

                cible_c = (
                    partie.obtenir_joueur(rep_creat.action_technique.cible_id)
                    if rep_creat.action_technique.cible_id
                    else None
                )
                if (
                    not cible_c
                    or not cible_c.est_vivant
                    or cible_c.role == RolePersonnage.CREATURE
                ):
                    cible_c = choisir_cible_aleatoire_fallback(
                        partie, creature, exclure_creatures=True
                    )
                if cible_c:
                    try:
                        enregistrer_vote(
                            partie,
                            creature,
                            cible_c.id,
                            argumentation=rep_creat.declaration_publique,
                        )
                    except ErreurRegleJeu:
                        pass

            moteur.clore_votes_creatures_vers_alchimiste()

        # c) Résolution de l'Aube
        morts = moteur.resoudre_aube()
        evenements_tour.append(
            f"Aube résolue ({len(morts)} éliminé(s)) -> Passage à {partie.phase_actuelle.value}."
        )

    # 2. PHASE DE DÉBAT DIURNE -> Prise de parole séquentielle des IA vivantes
    elif phase_depart == PhasePartie.DEBAT_JOUR:
        for agent in partie.joueurs_vivants():
            if agent.est_humain:
                continue
            rep_ia, tokens = await interroger_agent_ia(
                partie,
                agent,
                "C'est le débat public du jour. Réagis aux morts de la nuit et aux messages précédents en 1 ou 2 phrases.",
            )
            msg = MessagePartie(
                partie_id=partie.id,
                joueur_emetteur_id=agent.id,
                nom_emetteur=agent.nom_affiche,
                canal=CanalMessage.VILLAGE_PUBLIC,
                tour=partie.tour_actuel,
                phase=PhasePartie.DEBAT_JOUR,
                contenu=rep_ia.declaration_publique,
                est_ia=True,
                tokens_utilises=tokens,
            )
            partie.messages.append(msg)
            evenements_tour.append(f"{agent.nom_affiche} a pris la parole ({tokens} tokens).")

        moteur.passer_au_vote_du_jour()
        evenements_tour.append("Débat terminé -> Passage à la phase vote_jour.")

    # 3. PHASE DE VOTE DU JOUR -> Votes des IA + Dépouillement du Conseil
    elif phase_depart == PhasePartie.VOTE_JOUR:
        for agent in partie.joueurs_vivants():
            if agent.est_humain:
                continue
            rep_vote, tokens = await interroger_agent_ia(
                partie,
                agent,
                "C'est l'heure du vote du Conseil ! Choisis obligatoirement un joueur vivant (cible_id) contre qui voter et justifie ton vote dans declaration_publique.",
            )
            cible_v = (
                partie.obtenir_joueur(rep_vote.action_technique.cible_id)
                if rep_vote.action_technique.cible_id
                else None
            )
            if not cible_v or not cible_v.est_vivant or cible_v.id == agent.id:
                cible_v = choisir_cible_aleatoire_fallback(partie, agent)

            if cible_v:
                enregistrer_vote(
                    partie,
                    agent,
                    cible_v.id,
                    argumentation=rep_vote.declaration_publique,
                )
                msg_vote = MessagePartie(
                    partie_id=partie.id,
                    joueur_emetteur_id=agent.id,
                    nom_emetteur=agent.nom_affiche,
                    canal=CanalMessage.VILLAGE_PUBLIC,
                    tour=partie.tour_actuel,
                    phase=PhasePartie.VOTE_JOUR,
                    contenu=f"[Vote contre {cible_v.nom_affiche}] {rep_vote.declaration_publique}",
                    est_ia=True,
                    tokens_utilises=tokens,
                )
                partie.messages.append(msg_vote)
                evenements_tour.append(
                    f"{agent.nom_affiche} a voté contre {cible_v.nom_affiche}."
                )

        elimine = moteur.resoudre_vote_du_jour()
        evenements_tour.append(
            f"Conseil résolu : {elimine.nom_affiche if elimine else 'Personne (égalité)'} éliminé."
        )

    # 4. TOUR DU GARDE DU CORPS -> Tir de vengeance
    elif phase_depart == PhasePartie.TOUR_GARDE_DU_CORPS:
        garde = (
            partie.obtenir_joueur(partie.garde_du_corps_en_attente_id)
            if partie.garde_du_corps_en_attente_id
            else None
        )
        if garde:
            cible_tir = choisir_cible_aleatoire_fallback(partie, garde)
            if cible_tir:
                executer_tir_garde_du_corps(partie, garde, cible_tir.id)
                evenements_tour.append(
                    f"Dernier souffle : {garde.nom_affiche} a abattu {cible_tir.nom_affiche} !"
                )
            moteur.reprendre_apres_tir_garde_du_corps(origine_nuit=True)

    return {
        "phase_executee": phase_depart.value,
        "nouvelle_phase": partie.phase_actuelle.value,
        "evenements": evenements_tour,
        "etat": serialiser_partie_pour_humain(partie),
    }


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
