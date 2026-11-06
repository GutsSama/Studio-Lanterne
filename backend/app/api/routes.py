"""Endpoints REST FastAPI avec filtrage anti-triche et simulation de tours IA."""

import asyncio
import random
from typing import Any
import unicodedata
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
import httpx
from pydantic import BaseModel, Field

from app.agents.orchestrator import interroger_agent_ia, observabilite_llm
from app.config import settings
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
from app.models.game import EtatPartie, JoueurPartie, MessagePartie
from app.services.supabase_service import depot_parties

router = APIRouter(prefix="/api", tags=["parties"])

# Suivi des tâches d'animation initiales déjà lancées par (partie_id, tour, phase)
_phases_initiees: set[str] = set()


def _normaliser_texte(texte: str) -> str:
    """Supprime les accents et met en minuscules pour la détection de prénoms."""
    sans_accents = "".join(
        c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn"
    )
    return sans_accents.lower()


def _mots_cles_joueur(joueur: JoueurPartie) -> list[str]:
    """Extrait les mots-clés (prénom, surnom) permettant d'identifier un joueur dans un message."""
    mots_ignores = {"le", "la", "les", "de", "du", "des", "sr", "soeur", "sœur"}
    bruts = _normaliser_texte(joueur.nom_affiche.replace("œ", "oe")).split()
    cles = [m for m in bruts if len(m) >= 3 and m not in mots_ignores]
    return cles or [_normaliser_texte(joueur.nom_affiche)]


def selectionner_ia_ciblees(
    partie: EtatPartie, contenu: str, max_ia: int = 2
) -> list[JoueurPartie]:
    """Sélectionne les IA vivantes ciblées par le message du joueur humain.

    - Si 1 ou plusieurs IA sont nommées dans le message, ce sont elles qui répondent (max `max_ia`).
    - Si aucune IA n'est nommée, choisit l'IA qui a le moins parlé durant ce tour (ou celle qui vient de parler).
    """
    ia_vivantes = [j for j in partie.joueurs_vivants() if not j.est_humain]
    if not ia_vivantes:
        return []

    texte_norm = _normaliser_texte(contenu.replace("œ", "oe"))
    mentionnees = [
        j
        for j in ia_vivantes
        if any(cle in texte_norm for cle in _mots_cles_joueur(j))
    ]
    if mentionnees:
        return mentionnees[:max_ia]

    # Aucune IA explicitement nommée : choisir 1 IA vivante (priorité à celles ayant le moins parlé ce tour)
    compte_paroles: dict[UUID, int] = {j.id: 0 for j in ia_vivantes}
    for m in partie.messages:
        if (
            m.tour == partie.tour_actuel
            and m.phase == PhasePartie.DEBAT_JOUR
            and m.joueur_emetteur_id in compte_paroles
        ):
            compte_paroles[m.joueur_emetteur_id] += 1

    candidats = list(ia_vivantes)
    random.shuffle(candidats)
    candidats.sort(key=lambda j: compte_paroles[j.id])
    return candidats[:1]


async def _interroger_et_publier_jour(
    partie: EtatPartie, agent: JoueurPartie, consigne: str
) -> None:
    """Interroge un agent IA unique pendant le débat diurne et publie sa réponse dès qu'elle est prête."""
    tour_depart = partie.tour_actuel
    if (
        partie.phase_actuelle != PhasePartie.DEBAT_JOUR
        or not agent.est_vivant
        or agent.id in partie.ia_en_cours_ids
    ):
        return

    partie.ia_en_cours_ids.append(agent.id)
    try:
        rep_ia, tokens = await interroger_agent_ia(partie, agent, consigne)
        if (
            partie.phase_actuelle == PhasePartie.DEBAT_JOUR
            and partie.tour_actuel == tour_depart
            and agent.est_vivant
            and rep_ia.declaration_publique
        ):
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
            depot_parties.enregistrer_message_supabase(msg)
    finally:
        if agent.id in partie.ia_en_cours_ids:
            partie.ia_en_cours_ids.remove(agent.id)


async def _interroger_et_publier_creature_nuit(
    partie: EtatPartie, creature: JoueurPartie, consigne: str
) -> None:
    """Interroge le coéquipier Créature IA la nuit pour discuter en ping-pong et ajuster sa cible."""
    tour_depart = partie.tour_actuel
    if (
        partie.phase_actuelle != PhasePartie.NUIT
        or not creature.est_vivant
        or creature.role != RolePersonnage.CREATURE
        or creature.id in partie.ia_en_cours_ids
    ):
        return

    partie.ia_en_cours_ids.append(creature.id)
    try:
        rep_creat, tokens_c = await interroger_agent_ia(partie, creature, consigne)
        if (
            partie.phase_actuelle != PhasePartie.NUIT
            or partie.tour_actuel != tour_depart
            or not creature.est_vivant
        ):
            return

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
            depot_parties.enregistrer_message_supabase(msg_secret)

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
            # Si le message du joueur humain mentionne un citoyen vivant, l'IA peut s'y rallier
            deja_vote = any(
                v.tour == partie.tour_actuel
                and v.phase == PhasePartie.NUIT
                and v.joueur_votant_id == creature.id
                for v in partie.votes
            )
            if not deja_vote:
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
    finally:
        if creature.id in partie.ia_en_cours_ids:
            partie.ia_en_cours_ids.remove(creature.id)


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
        elif role_humain == RolePersonnage.CREATURE:
            votes_nuit = [
                v
                for v in partie.votes
                if v.tour == partie.tour_actuel and v.phase == PhasePartie.NUIT
            ]
            mon_vote = next(
                (v for v in votes_nuit if v.joueur_votant_id == humain.id), None
            )
            vote_allie = next(
                (v for v in votes_nuit if v.joueur_votant_id != humain.id), None
            )
            informations_role_humain["ma_cible_nuit_id"] = (
                str(mon_vote.joueur_cible_id) if mon_vote else None
            )
            informations_role_humain["cible_allie_nuit_id"] = (
                str(vote_allie.joueur_cible_id) if vote_allie else None
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
        "ia_en_cours_ids": [str(uid) for uid in partie.ia_en_cours_ids],
    }


@router.get("/db-status", tags=["systeme"])
async def verifier_connexion_bdd() -> dict[str, Any]:
    """Vérifie en direct la connexion à Supabase et la présence des tables."""
    return depot_parties.verifier_connexion_supabase()


@router.get("/metrics/llm", tags=["observabilite"])
async def obtenir_metriques_llm() -> dict[str, Any]:
    """Retourne le tableau de bord complet LiteLLM : coûts USD, tokens, latence ms par modèle et par agent."""
    return observabilite_llm.calculer_synthese()


@router.get("/diagnostic-cles", tags=["observabilite"])
async def diagnostiquer_cles_llm() -> dict[str, Any]:
    """Teste en direct les 3 clés API (Groq, Mistral, Gemini) et liste les modèles réellement accessibles."""
    resultats: dict[str, Any] = {}

    async with httpx.AsyncClient(timeout=6.0) as client:
        # 1. Test GROQ
        if settings.groq_api_key:
            try:
                r_groq = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                )
                if r_groq.status_code == 200:
                    modeles_groq = [m["id"] for m in r_groq.json().get("data", [])]
                    resultats["groq"] = {
                        "cle_valide": True,
                        "nb_modeles_autorises": len(modeles_groq),
                        "modeles_disponibles": modeles_groq[:15],
                        "conseil": (
                            "Si la liste est vide (0 modèle), allez sur https://console.groq.com/settings/limits "
                            "ou dans les paramètres de votre clé API Groq pour autoriser les modèles Llama."
                            if not modeles_groq
                            else f"Utilisez l'un de ces modèles avec le préfixe groq/, ex: groq/{modeles_groq[0]}"
                        ),
                    }
                else:
                    resultats["groq"] = {
                        "cle_valide": False,
                        "status_code": r_groq.status_code,
                        "erreur": r_groq.text[:250],
                    }
            except Exception as exc:
                resultats["groq"] = {"cle_valide": False, "erreur": str(exc)}
        else:
            resultats["groq"] = {"cle_valide": False, "erreur": "GROQ_API_KEY absente"}

        # 2. Test MISTRAL
        if settings.mistral_api_key:
            try:
                r_mistral = await client.get(
                    "https://api.mistral.ai/v1/models",
                    headers={"Authorization": f"Bearer {settings.mistral_api_key}"},
                )
                resultats["mistral"] = {
                    "cle_valide": r_mistral.status_code == 200,
                    "status_code": r_mistral.status_code,
                    "detail": (
                        "Clé Mistral reconnue ! Si les appels renvoient 429 (code 1300), vérifiez sur "
                        "https://console.mistral.ai/ que le plan gratuit ('Experiment') est bien activé sur votre espace."
                        if r_mistral.status_code == 200
                        else r_mistral.text[:250]
                    ),
                }
            except Exception as exc:
                resultats["mistral"] = {"cle_valide": False, "erreur": str(exc)}
        else:
            resultats["mistral"] = {"cle_valide": False, "erreur": "MISTRAL_API_KEY absente"}

        # 3. Test GEMINI
        if settings.gemini_api_key:
            try:
                r_gemini = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={settings.gemini_api_key}"
                )
                if r_gemini.status_code == 200:
                    modeles_gem = [
                        m["name"].replace("models/", "gemini/")
                        for m in r_gemini.json().get("models", [])
                        if "generateContent" in m.get("supportedGenerationMethods", [])
                    ]
                    resultats["gemini"] = {
                        "cle_valide": True,
                        "modeles_disponibles": modeles_gem[:10],
                    }
                else:
                    resultats["gemini"] = {
                        "cle_valide": False,
                        "status_code": r_gemini.status_code,
                        "erreur": r_gemini.text[:250],
                        "conseil": "Une clé Google AI Studio commence par 'AIzaSy...' (à créer sur https://aistudio.google.com/apikey).",
                    }
            except Exception as exc:
                resultats["gemini"] = {"cle_valide": False, "erreur": str(exc)}
        else:
            resultats["gemini"] = {"cle_valide": False, "erreur": "GEMINI_API_KEY absente"}

    return resultats


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
    depot_parties.sauvegarder_nouvelle_partie(moteur.partie)
    return serialiser_partie_pour_humain(moteur.partie)


@router.get("/parties/{partie_id}")
async def obtenir_partie(partie_id: UUID) -> dict[str, Any]:
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")
    return serialiser_partie_pour_humain(partie)


async def _animer_debat_initial(partie: EtatPartie, tour: int) -> None:
    """Fait réagir progressivement les IA vivantes au début du débat diurne."""
    await asyncio.sleep(0.5)
    ia_vivantes = [j for j in partie.joueurs_vivants() if not j.est_humain]
    random.shuffle(ia_vivantes)
    for agent in ia_vivantes:
        if partie.phase_actuelle != PhasePartie.DEBAT_JOUR or partie.tour_actuel != tour:
            break
        await _interroger_et_publier_jour(
            partie,
            agent,
            "C'est le début du débat public du jour. Réagis aux morts de la nuit et aux messages précédents en 1 ou 2 phrases.",
        )
        await asyncio.sleep(1.0)


async def _animer_nuit_initiale(partie: EtatPartie, tour: int) -> None:
    """Lance la proposition initiale du coéquipier Créature IA au début de la nuit si le joueur humain est Créature."""
    await asyncio.sleep(0.5)
    if partie.phase_actuelle != PhasePartie.NUIT or partie.tour_actuel != tour:
        return
    humain = next((j for j in partie.joueurs if j.est_humain), None)
    if not humain or not humain.est_vivant or humain.role != RolePersonnage.CREATURE:
        return

    for creature in partie.creatures_vivantes():
        if creature.est_humain:
            continue
        await _interroger_et_publier_creature_nuit(
            partie,
            creature,
            f"C'est la nuit {tour}. Propose à ton coéquipier Créature ({humain.nom_affiche}) une cible Citoyen à dévorer dans le canal secret et indique son id ou nom dans cible_id.",
        )


@router.post("/parties/{partie_id}/initier-phase")
async def initier_phase_interactive(partie_id: UUID) -> dict[str, Any]:
    """Démarre en tâche de fond les interventions spontanées des IA au début du jour ou de la nuit."""
    partie = depot_parties.obtenir(partie_id)
    if partie is None:
        raise HTTPException(status_code=404, detail="Partie introuvable.")

    cle = f"{partie.id}:{partie.tour_actuel}:{partie.phase_actuelle.value}"
    if cle not in _phases_initiees:
        _phases_initiees.add(cle)
        if partie.phase_actuelle == PhasePartie.DEBAT_JOUR:
            asyncio.create_task(_animer_debat_initial(partie, partie.tour_actuel))
        elif partie.phase_actuelle == PhasePartie.NUIT:
            asyncio.create_task(_animer_nuit_initiale(partie, partie.tour_actuel))

    return serialiser_partie_pour_humain(partie)


@router.post("/parties/{partie_id}/simuler-tour")
async def simuler_tour_ia(partie_id: UUID) -> dict[str, Any]:
    """Fait avancer automatiquement la phase actuelle en interrogeant les 5 agents IA via LiteLLM.

    - Si la partie est en `nuit` ou `tour_alchimiste` : exécute les actions nocturnes des IA (Inquisiteur, Créatures, Alchimiste), résout l'Aube et passe à `debat_jour`.
    - Si la partie est en `debat_jour` : clôt le débat (en faisant parler les IA si aucune ne s'est exprimée) et passe à `vote_jour`.
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
            "nouvelle_phase": phase_depart.value,
            "evenements": ["La partie est déjà terminée."],
            "etat": serialiser_partie_pour_humain(partie),
        }

    # 1. PHASE DE NUIT -> Actions secrètes IA + Résolution de l'Aube
    if phase_depart in (PhasePartie.NUIT, PhasePartie.TOUR_ALCHIMISTE):
        partie.ia_en_cours_ids.clear()
        if partie.phase_actuelle == PhasePartie.NUIT:
            # a) Inquisiteur IA (s'il n'a pas déjà inspecté ce tour-ci)
            inquisiteur = next(
                (
                    j
                    for j in partie.joueurs_vivants()
                    if not j.est_humain and j.role == RolePersonnage.INQUISITEUR
                ),
                None,
            )
            deja_inspecte = bool(
                inquisiteur
                and any(
                    a.tour == partie.tour_actuel
                    and a.joueur_acteur_id == inquisiteur.id
                    and a.type_action == TypeActionJeu.INQUISITEUR_INSPECTER
                    for a in partie.actions
                )
            )
            if inquisiteur and not deja_inspecte:
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

            # b) Créatures de la Nuit IA (si elles n'ont pas déjà voté pendant le ping-pong nocturne)
            for creature in partie.creatures_vivantes():
                if creature.est_humain:
                    continue
                deja_vote = any(
                    v.tour == partie.tour_actuel
                    and v.phase == PhasePartie.NUIT
                    and v.joueur_votant_id == creature.id
                    for v in partie.votes
                )
                if deja_vote:
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
                    depot_parties.enregistrer_message_supabase(msg_secret)

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

            # d) Alchimiste IA : décide d'utiliser (ou non) une potion avant l'Aube
            alchimiste_ia = next(
                (
                    j
                    for j in partie.joueurs_vivants()
                    if not j.est_humain and j.role == RolePersonnage.ALCHIMISTE
                ),
                None,
            )
            if alchimiste_ia and partie.phase_actuelle == PhasePartie.TOUR_ALCHIMISTE:
                rep_alc, _ = await interroger_agent_ia(
                    partie,
                    alchimiste_ia,
                    "C'est ton tour d'Alchimiste. Tu peux utiliser AU PLUS une potion cette nuit : "
                    "'alchimiste_soigner' pour sauver la victime attaquée (jamais toi-même), "
                    "'alchimiste_empoisonner' avec cible_id pour éliminer un suspect, "
                    "ou pouvoir_utilise=null pour garder tes potions.",
                )
                pouvoir = rep_alc.action_technique.pouvoir_utilise
                try:
                    if pouvoir == TypeActionJeu.ALCHIMISTE_SOIGNER:
                        executer_action_alchimiste(partie, alchimiste_ia, pouvoir)
                        evenements_tour.append("L'Alchimiste a fait usage d'une potion dans l'ombre.")
                    elif pouvoir == TypeActionJeu.ALCHIMISTE_EMPOISONNER:
                        cible_alc = (
                            partie.obtenir_joueur(rep_alc.action_technique.cible_id)
                            if rep_alc.action_technique.cible_id
                            else None
                        )
                        if cible_alc:
                            executer_action_alchimiste(partie, alchimiste_ia, pouvoir, cible_alc.id)
                            evenements_tour.append("L'Alchimiste a fait usage d'une potion dans l'ombre.")
                except ErreurRegleJeu:
                    # Décision invalide de l'IA (auto-sauvetage, potion épuisée, cible morte...) : ignorée
                    pass

            # Si l'Alchimiste est humain, on lui laisse la main : l'Aube sera résolue au prochain appel
            if partie.phase_actuelle == PhasePartie.TOUR_ALCHIMISTE and any(
                j.est_humain and j.role == RolePersonnage.ALCHIMISTE
                for j in partie.joueurs_vivants()
            ):
                evenements_tour.append("Les Créatures ont choisi leur proie -> Tour de l'Alchimiste.")
                return {
                    "phase_executee": phase_depart.value,
                    "nouvelle_phase": partie.phase_actuelle.value,
                    "evenements": evenements_tour,
                    "etat": serialiser_partie_pour_humain(partie),
                }

        # c) Résolution de l'Aube
        morts = moteur.resoudre_aube()
        evenements_tour.append(
            f"Aube résolue ({len(morts)} éliminé(s)) -> Passage à {partie.phase_actuelle.value}."
        )

    # 2. PHASE DE DÉBAT DIURNE -> Clôture vers le vote (ou tour de parole si aucun échange n'a eu lieu)
    elif phase_depart == PhasePartie.DEBAT_JOUR:
        partie.ia_en_cours_ids.clear()
        deja_debattu = any(
            m.tour == partie.tour_actuel
            and m.phase == PhasePartie.DEBAT_JOUR
            and m.canal == CanalMessage.VILLAGE_PUBLIC
            for m in partie.messages
        )
        if not deja_debattu:
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
                depot_parties.enregistrer_message_supabase(msg)
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
                depot_parties.enregistrer_message_supabase(msg_vote)
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
                moteur.ajouter_message_systeme(
                    f"Dernier souffle : {garde.nom_affiche} emporte {cible_tir.nom_affiche} ({cible_tir.role.value}) dans sa chute !"
                )
                evenements_tour.append(
                    f"Dernier souffle : {garde.nom_affiche} a abattu {cible_tir.nom_affiche} !"
                )
        else:
            garde = next(
                (j for j in partie.joueurs if j.role == RolePersonnage.GARDE_DU_CORPS),
                None,
            )

        origine_nuit = garde.cause_mort != "vote_conseil" if garde else True
        moteur.reprendre_apres_tir_garde_du_corps(origine_nuit=origine_nuit)

    # Synchronisation Supabase de la partie et clôture des stats si terminée
    if partie.phase_actuelle == PhasePartie.TERMINEE:
        bilan = depot_parties.cloturer_partie_et_mettre_a_jour_stats(partie)
        if bilan.get("nouveaux_succes"):
            for s in bilan["nouveaux_succes"]:
                evenements_tour.append(f"🏆 Nouveau succès débloqué : {s.get('titre', '')} !")
    else:
        depot_parties.synchroniser_etat_partie_supabase(partie)

    return {
        "phase_executee": phase_depart.value,
        "nouvelle_phase": partie.phase_actuelle.value,
        "evenements": evenements_tour,
        "etat": serialiser_partie_pour_humain(partie),
    }


async def _repondre_aux_cibles_jour(
    partie: EtatPartie, nom_humain: str, contenu: str, cibles: list[JoueurPartie]
) -> None:
    """Fait répondre séquentiellement les IA ciblées par le message du joueur humain."""
    for agent in cibles:
        if partie.phase_actuelle != PhasePartie.DEBAT_JOUR:
            break
        consigne = (
            f"Pendant le débat public du village, {nom_humain} vient de dire : « {contenu} ». "
            f"Réponds-lui directement en 1 ou 2 phrases avec ton style et selon tes intérêts."
        )
        await _interroger_et_publier_jour(partie, agent, consigne)
        await asyncio.sleep(0.4)


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
    depot_parties.enregistrer_message_supabase(msg)
    depot_parties.synchroniser_etat_partie_supabase(partie)

    # Déclenchement asynchrone de la réponse des IA ciblées (le jour) ou du coéquipier Loup (la nuit)
    if emetteur.est_humain and emetteur.est_vivant:
        if (
            partie.phase_actuelle == PhasePartie.DEBAT_JOUR
            and req.canal == CanalMessage.VILLAGE_PUBLIC
        ):
            cibles = selectionner_ia_ciblees(partie, req.contenu, max_ia=2)
            if cibles:
                asyncio.create_task(
                    _repondre_aux_cibles_jour(
                        partie, emetteur.nom_affiche, req.contenu, cibles
                    )
                )
        elif (
            partie.phase_actuelle == PhasePartie.NUIT
            and req.canal == CanalMessage.CREATURE_SECRET
            and emetteur.role == RolePersonnage.CREATURE
        ):
            for creature in partie.creatures_vivantes():
                if not creature.est_humain:
                    consigne_nuit = (
                        f"C'est la nuit dans le canal secret des Créatures. Ton coéquipier {emetteur.nom_affiche} "
                        f"vient de te murmurer : « {req.contenu} ». Réponds-lui directement en 1 ou 2 phrases "
                        f"pour convenir de la proie Citoyen à dévorer, et indique l'id ou le nom de la cible dans cible_id."
                    )
                    asyncio.create_task(
                        _interroger_et_publier_creature_nuit(
                            partie, creature, consigne_nuit
                        )
                    )

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
        depot_parties.enregistrer_vote_supabase(vote)
        depot_parties.synchroniser_etat_partie_supabase(partie)
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
            moteur = MoteurPartieFSM(partie)
            moteur.ajouter_message_systeme(
                f"Dernier souffle : {acteur.nom_affiche} emporte {cible.nom_affiche} ({cible.role.value}) dans sa chute !"
            )
            origine_nuit = acteur.cause_mort != "vote_conseil"
            moteur.reprendre_apres_tir_garde_du_corps(origine_nuit=origine_nuit)
            return {"statut": "tir_effectue", "cible_eliminee": cible.nom_affiche}
        else:
            raise ErreurRegleJeu("Type d'action inconnu.")
        depot_parties.enregistrer_action_supabase(action)
        depot_parties.synchroniser_etat_partie_supabase(partie)
        return action.model_dump(mode="json")
    except ErreurRegleJeu as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/profils/{joueur_id}", tags=["profils"])
async def obtenir_profil_joueur(joueur_id: UUID) -> dict[str, Any]:
    """Retourne le profil du joueur, ses statistiques de victoires et ses succès débloqués."""
    profil = depot_parties.obtenir_profil_complet(joueur_id)
    if profil is None:
        raise HTTPException(status_code=404, detail="Profil joueur introuvable.")
    return profil


@router.get("/succes", tags=["profils"])
async def lister_tous_les_succes() -> list[dict[str, Any]]:
    """Retourne le catalogue complet des succès/trophées du jeu."""
    if depot_parties.client is not None:
        try:
            res = depot_parties.client.table("succes").select("*").order("points").execute()
            if res.data:
                return res.data
        except Exception:
            pass
    return []
