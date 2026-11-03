"""Tests unitaires de la Machine à États (FSM) sur un cycle complet."""

from uuid import uuid4

from app.engine.fsm import MoteurPartieFSM
from app.engine.rules import enregistrer_vote
from app.models.enums import CampPartie, PhasePartie, RolePersonnage, StatutPartie
from app.services.supabase_service import CATALOGUE_PERSONNALITES_DEFAUT


def test_cycle_complet_nuit_aube_debat_vote() -> None:
    """Vérifie l'enchaînement NUIT -> TOUR_ALCHIMISTE -> DEBAT_JOUR -> VOTE_JOUR -> NUIT tour 2."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=7,
    )
    partie = moteur.partie
    assert partie.phase_actuelle == PhasePartie.NUIT
    assert partie.tour_actuel == 1

    # Les 2 Créatures votent contre le joueur humain (Citoyen)
    humain = next(j for j in partie.joueurs if j.est_humain)
    for creature in partie.creatures_vivantes():
        enregistrer_vote(partie, creature, humain.id)

    victime = moteur.clore_votes_creatures_vers_alchimiste()
    assert victime is not None and victime.id == humain.id
    assert partie.phase_actuelle == PhasePartie.TOUR_ALCHIMISTE

    # Aube : l'Alchimiste n'utilise pas sa potion -> le Citoyen meurt -> passage au débat
    morts = moteur.resoudre_aube()
    assert len(morts) == 1 and morts[0].id == humain.id
    assert partie.phase_actuelle == PhasePartie.DEBAT_JOUR

    # Passage au vote du jour : tous les joueurs vivants votent contre une Créature
    moteur.passer_au_vote_du_jour()
    assert partie.phase_actuelle == PhasePartie.VOTE_JOUR

    creature_cible = partie.creatures_vivantes()[0]
    for votant in partie.joueurs_vivants():
        if votant.id != creature_cible.id:
            enregistrer_vote(partie, votant, creature_cible.id)

    elimine = moteur.resoudre_vote_du_jour()
    assert elimine is not None and elimine.id == creature_cible.id
    assert partie.tour_actuel == 2
    assert partie.phase_actuelle == PhasePartie.NUIT
    assert partie.statut == StatutPartie.EN_COURS


def test_victoire_creatures_parite_numerique() -> None:
    """Les Créatures gagnent dès que le nombre de Créatures vivantes >= Citoyens vivants."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        graine_aleatoire=10,
    )
    partie = moteur.partie
    citoyens = [
        j
        for j in partie.citoyens_vivants()
        if j.role != RolePersonnage.GARDE_DU_CORPS
    ]

    # Il ne reste plus que 2 Citoyens face aux 2 Créatures après l'attaque nocturne
    citoyens[0].est_vivant = False
    partie.victime_provisoire_nuit_id = citoyens[1].id

    moteur.resoudre_aube()
    assert partie.statut == StatutPartie.TERMINEE
    assert partie.camp_vainqueur == CampPartie.CREATURES

