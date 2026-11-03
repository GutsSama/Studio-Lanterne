"""Validation déterministe des règles (« L'IA propose, le moteur valide »)."""

import random
from collections import Counter
from uuid import UUID

from app.models.enums import (
    CampPartie,
    PhasePartie,
    RolePersonnage,
    StatutPartie,
    TypeActionJeu,
)
from app.models.game import ActionPartie, EtatPartie, JoueurPartie, VotePartie


# Composition officielle d'une partie à 6 joueurs (cadrage_synthese.md) :
# - 2 Créatures de la Nuit
# - 4 Citoyens (1 Inquisiteur, 1 Alchimiste, 1 Garde du Corps, 1 Citoyen)
ROLES_POOL_6_JOUEURS: list[RolePersonnage] = [
    RolePersonnage.CREATURE,
    RolePersonnage.CREATURE,
    RolePersonnage.INQUISITEUR,
    RolePersonnage.ALCHIMISTE,
    RolePersonnage.GARDE_DU_CORPS,
    RolePersonnage.CITOYEN,
]


class ErreurRegleJeu(ValueError):
    """Exception levée lorsqu'une action d'un joueur ou d'une IA viole les règles."""


def distribuer_roles(
    nombre_joueurs: int = 6,
    graine_aleatoire: int | None = None,
) -> list[RolePersonnage]:
    """Distribue aléatoirement les rôles pour une partie (6 joueurs par défaut)."""
    if nombre_joueurs < 6:
        raise ErreurRegleJeu("Une partie nécessite au moins 6 joueurs (1 Humain + 5 IA).")

    roles = list(ROLES_POOL_6_JOUEURS)
    while len(roles) < nombre_joueurs:
        roles.append(RolePersonnage.CITOYEN)

    rng = random.Random(graine_aleatoire)
    rng.shuffle(roles)
    return roles


def verifier_conditions_victoire(partie: EtatPartie) -> CampPartie | None:
    """Vérifie si l'un des camps a remporté la partie.

    Règles (cadrage_synthese.md) :
    - Les Citoyens gagnent si toutes les Créatures sont éliminées (0 Créature vivante).
    - Les Créatures gagnent si le nombre de Créatures vivantes >= nombre de Citoyens vivants.
    """
    nb_creatures = len(partie.creatures_vivantes())
    nb_citoyens = len(partie.citoyens_vivants())

    if nb_creatures == 0 and nb_citoyens == 0:
        return CampPartie.EGALITE
    if nb_creatures == 0:
        return CampPartie.CITOYENS
    if nb_creatures >= nb_citoyens:
        return CampPartie.CREATURES
    return None


def valider_cible_vivante(
    partie: EtatPartie,
    acteur: JoueurPartie,
    cible_id: UUID | str | None,
    autoriser_auto_ciblage: bool = False,
) -> JoueurPartie:
    """Vérifie que l'acteur est vivant, que la cible existe et qu'elle est vivante."""
    if not acteur.est_vivant and partie.garde_du_corps_en_attente_id != acteur.id:
        raise ErreurRegleJeu(f"Le joueur {acteur.nom_affiche} est éliminé et ne peut pas agir.")

    if cible_id is None:
        raise ErreurRegleJeu("Aucune cible spécifiée.")

    cible = partie.obtenir_joueur(cible_id)
    if cible is None:
        raise ErreurRegleJeu(f"La cible '{cible_id}' n'existe pas dans cette partie.")

    if not cible.est_vivant:
        raise ErreurRegleJeu(f"La cible {cible.nom_affiche} est déjà éliminée.")

    if not autoriser_auto_ciblage and cible.id == acteur.id:
        raise ErreurRegleJeu(f"{acteur.nom_affiche} ne peut pas se cibler lui-même.")

    return cible


def executer_inspection_inquisiteur(
    partie: EtatPartie,
    inquisiteur: JoueurPartie,
    cible_id: UUID | str,
) -> ActionPartie:
    """Exécute et enregistre l'inspection nocturne de l'Inquisiteur."""
    if partie.phase_actuelle != PhasePartie.NUIT:
        raise ErreurRegleJeu("L'Inquisiteur ne peut inspecter que pendant la nuit.")
    if inquisiteur.role != RolePersonnage.INQUISITEUR:
        raise ErreurRegleJeu(f"{inquisiteur.nom_affiche} n'est pas l'Inquisiteur.")

    # Vérifier qu'il n'a pas déjà inspecté ce tour-ci
    deja_inspecte = any(
        a.tour == partie.tour_actuel
        and a.joueur_acteur_id == inquisiteur.id
        and a.type_action == TypeActionJeu.INQUISITEUR_INSPECTER
        for a in partie.actions
    )
    if deja_inspecte:
        raise ErreurRegleJeu("L'Inquisiteur a déjà utilisé son pouvoir cette nuit.")

    cible = valider_cible_vivante(
        partie, inquisiteur, cible_id, autoriser_auto_ciblage=False
    )

    alignement = (
        CampPartie.CREATURES.value
        if cible.role == RolePersonnage.CREATURE
        else CampPartie.CITOYENS.value
    )
    inquisiteur.memoire_ia.inspections_inquisiteur[str(cible.id)] = alignement

    action = ActionPartie(
        partie_id=partie.id,
        tour=partie.tour_actuel,
        joueur_acteur_id=inquisiteur.id,
        type_action=TypeActionJeu.INQUISITEUR_INSPECTER,
        joueur_cible_id=cible.id,
        details_resultat={
            "cible_nom": cible.nom_affiche,
            "alignement_decouvert": alignement,
        },
    )
    partie.actions.append(action)
    return action


def enregistrer_vote(
    partie: EtatPartie,
    votant: JoueurPartie,
    cible_id: UUID | str,
    argumentation: str | None = None,
) -> VotePartie:
    """Valide et enregistre un vote (nocturne pour les Créatures ou diurne pour tous)."""
    if partie.phase_actuelle not in (PhasePartie.NUIT, PhasePartie.VOTE_JOUR):
        raise ErreurRegleJeu(
            f"Impossible de voter pendant la phase '{partie.phase_actuelle}'."
        )

    if partie.phase_actuelle == PhasePartie.NUIT and votant.role != RolePersonnage.CREATURE:
        raise ErreurRegleJeu("Seules les Créatures de la Nuit peuvent voter la nuit.")

    cible = valider_cible_vivante(
        partie, votant, cible_id, autoriser_auto_ciblage=False
    )

    if (
        partie.phase_actuelle == PhasePartie.NUIT
        and cible.role == RolePersonnage.CREATURE
    ):
        raise ErreurRegleJeu("Une Créature de la Nuit ne peut pas dévorer une autre Créature.")

    # Remplacer le vote s'il existait déjà pour ce tour et cette phase
    partie.votes = [
        v
        for v in partie.votes
        if not (
            v.tour == partie.tour_actuel
            and v.phase == partie.phase_actuelle
            and v.joueur_votant_id == votant.id
        )
    ]

    vote = VotePartie(
        partie_id=partie.id,
        tour=partie.tour_actuel,
        phase=partie.phase_actuelle,
        joueur_votant_id=votant.id,
        joueur_cible_id=cible.id,
        argumentation=argumentation,
    )
    partie.votes.append(vote)
    return vote


def calculer_cible_majoritaire(
    partie: EtatPartie,
    phase: PhasePartie,
    departager_aleatoirement_nuit: bool = True,
    graine_aleatoire: int | None = None,
) -> JoueurPartie | None:
    """Calcule le joueur ayant reçu le plus de votes pour le tour et la phase donnés.

    - Au Conseil de Jour (`vote_jour`) : en cas d'égalité stricte, personne n'est éliminé (`None`).
    - La Nuit (`nuit`) : si les 2 Créatures votent contre 2 Citoyens différents, l'une des cibles est choisie.
    """
    votes_phase = [
        v
        for v in partie.votes
        if v.tour == partie.tour_actuel and v.phase == phase
    ]
    if not votes_phase:
        return None

    compteur = Counter(v.joueur_cible_id for v in votes_phase)
    max_voix = max(compteur.values())
    ex_aequo = [jid for jid, nb in compteur.items() if nb == max_voix]

    if len(ex_aequo) > 1:
        if phase == PhasePartie.NUIT and departager_aleatoirement_nuit:
            rng = random.Random(graine_aleatoire)
            gagnant_id = rng.choice(ex_aequo)
            return partie.obtenir_joueur(gagnant_id)
        return None

    return partie.obtenir_joueur(ex_aequo[0])


def executer_action_alchimiste(
    partie: EtatPartie,
    alchimiste: JoueurPartie,
    type_action: TypeActionJeu,
    cible_id: UUID | str | None = None,
) -> ActionPartie:
    """Valide et applique l'utilisation de la potion de Vie ou de Mort de l'Alchimiste."""
    if partie.phase_actuelle not in (PhasePartie.NUIT, PhasePartie.TOUR_ALCHIMISTE):
        raise ErreurRegleJeu("L'Alchimiste ne peut utiliser ses potions que la nuit.")
    if alchimiste.role != RolePersonnage.ALCHIMISTE:
        raise ErreurRegleJeu(f"{alchimiste.nom_affiche} n'est pas l'Alchimiste.")
    if not alchimiste.est_vivant:
        raise ErreurRegleJeu("L'Alchimiste est éliminé et ne peut plus agir.")

    if type_action == TypeActionJeu.ALCHIMISTE_SOIGNER:
        if not alchimiste.memoire_ia.potion_vie_disponible:
            raise ErreurRegleJeu("La potion de Vie a déjà été utilisée dans cette partie.")
        if partie.victime_provisoire_nuit_id is None:
            raise ErreurRegleJeu("Aucune victime nocturne à sauver.")
        if partie.victime_provisoire_nuit_id == alchimiste.id:
            raise ErreurRegleJeu("L'auto-sauvetage n'est pas autorisé pour l'Alchimiste.")

        victime_sauvee_id = partie.victime_provisoire_nuit_id
        partie.victime_provisoire_nuit_id = None
        alchimiste.memoire_ia.potion_vie_disponible = False

        action = ActionPartie(
            partie_id=partie.id,
            tour=partie.tour_actuel,
            joueur_acteur_id=alchimiste.id,
            type_action=TypeActionJeu.ALCHIMISTE_SOIGNER,
            joueur_cible_id=victime_sauvee_id,
            details_resultat={"sauvetage": True},
        )
        partie.actions.append(action)
        return action

    if type_action == TypeActionJeu.ALCHIMISTE_EMPOISONNER:
        if not alchimiste.memoire_ia.potion_mort_disponible:
            raise ErreurRegleJeu("La potion de Mort a déjà été utilisée dans cette partie.")
        cible = valider_cible_vivante(
            partie, alchimiste, cible_id, autoriser_auto_ciblage=False
        )
        alchimiste.memoire_ia.potion_mort_disponible = False

        action = ActionPartie(
            partie_id=partie.id,
            tour=partie.tour_actuel,
            joueur_acteur_id=alchimiste.id,
            type_action=TypeActionJeu.ALCHIMISTE_EMPOISONNER,
            joueur_cible_id=cible.id,
            details_resultat={"cible_nom": cible.nom_affiche},
        )
        partie.actions.append(action)
        return action

    raise ErreurRegleJeu(f"Action '{type_action}' invalide pour l'Alchimiste.")


def eliminer_joueur(
    partie: EtatPartie,
    joueur: JoueurPartie,
    cause_mort: str,
) -> None:
    """Marque un joueur comme mort et active le dernier souffle s'il est Garde du Corps."""
    if not joueur.est_vivant:
        return
    joueur.est_vivant = False
    joueur.tour_mort = partie.tour_actuel
    joueur.cause_mort = cause_mort

    if joueur.role == RolePersonnage.GARDE_DU_CORPS and len(partie.joueurs_vivants()) > 0:
        partie.garde_du_corps_en_attente_id = joueur.id
        partie.phase_actuelle = PhasePartie.TOUR_GARDE_DU_CORPS


def executer_tir_garde_du_corps(
    partie: EtatPartie,
    garde: JoueurPartie,
    cible_id: UUID | str,
) -> JoueurPartie:
    """Exécute le tir final du Garde du Corps lorsqu'il vient d'être éliminé."""
    if garde.role != RolePersonnage.GARDE_DU_CORPS:
        raise ErreurRegleJeu(f"{garde.nom_affiche} n'est pas le Garde du Corps.")
    if partie.garde_du_corps_en_attente_id != garde.id:
        raise ErreurRegleJeu("Le Garde du Corps n'est pas en position de tirer.")

    cible = valider_cible_vivante(
        partie, garde, cible_id, autoriser_auto_ciblage=False
    )
    partie.garde_du_corps_en_attente_id = None

    action = ActionPartie(
        partie_id=partie.id,
        tour=partie.tour_actuel,
        joueur_acteur_id=garde.id,
        type_action=TypeActionJeu.GARDE_DU_CORPS_TIRER,
        joueur_cible_id=cible.id,
        details_resultat={"cible_nom": cible.nom_affiche},
    )
    partie.actions.append(action)
    eliminer_joueur(partie, cible, cause_mort="tir_garde_du_corps")
    return cible


def choisir_cible_aleatoire_fallback(
    partie: EtatPartie,
    acteur: JoueurPartie,
    exclure_creatures: bool = False,
    graine_aleatoire: int | None = None,
) -> JoueurPartie | None:
    """Fallback déterministe (> 3.5s timeout LLM ou cible invalide) : choisit une cible valide."""
    candidats = [
        j
        for j in partie.joueurs_vivants()
        if j.id != acteur.id
        and (not exclure_creatures or j.role != RolePersonnage.CREATURE)
    ]
    if not candidats:
        return None
    rng = random.Random(graine_aleatoire)
    return rng.choice(candidats)

