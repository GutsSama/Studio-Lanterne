"""Tests des conditions de victoire, parité numérique et cas limites (Créatures vs Citoyens)."""

from uuid import uuid4

from app.engine.fsm import MoteurPartieFSM
from app.engine.rules import verifier_conditions_victoire
from app.models.enums import CampPartie, PhasePartie, RolePersonnage
from app.services.supabase_service import CATALOGUE_PERSONNALITES_DEFAUT


def test_victoire_citoyens_quand_zero_creature_en_vie() -> None:
    """Les Citoyens gagnent dès que toutes les Créatures de la Nuit ont été éliminées."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=40,
    )
    partie = moteur.partie

    # Élimination des 2 créatures
    for creature in partie.creatures_vivantes():
        creature.est_vivant = False
        creature.tour_mort = 1
        creature.cause_mort = "vote_conseil"

    victoire = verifier_conditions_victoire(partie)
    assert victoire == CampPartie.CITOYENS

    # Vérification que le moteur passe la partie en terminée
    assert moteur._verifier_et_cloturer_si_victoire() is True
    assert partie.phase_actuelle == PhasePartie.TERMINEE
    assert partie.camp_vainqueur == CampPartie.CITOYENS


def test_victoire_creatures_par_parite_numerique_2_contre_2() -> None:
    """Les Créatures gagnent dès que le nombre de Créatures est >= nombre de Citoyens vivants."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=50,
    )
    partie = moteur.partie

    # Élimination de 2 citoyens vivants -> reste 2 créatures et 2 citoyens
    citoyens = partie.citoyens_vivants()
    citoyens[0].est_vivant = False
    citoyens[1].est_vivant = False

    assert len(partie.creatures_vivantes()) == 2
    assert len(partie.citoyens_vivants()) == 2

    victoire = verifier_conditions_victoire(partie)
    assert victoire == CampPartie.CREATURES

    assert moteur._verifier_et_cloturer_si_victoire() is True
    assert partie.phase_actuelle == PhasePartie.TERMINEE
    assert partie.camp_vainqueur == CampPartie.CREATURES


def test_victoire_creatures_1_contre_1() -> None:
    """1 Créature face à 1 Citoyen constitue une parité numérique (victoire Créatures)."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=60,
    )
    partie = moteur.partie

    # Élimine 1 créature et 3 citoyens -> reste 1 créature et 1 citoyen
    partie.creatures_vivantes()[0].est_vivant = False
    citoyens = partie.citoyens_vivants()
    citoyens[0].est_vivant = False
    citoyens[1].est_vivant = False
    citoyens[2].est_vivant = False

    assert len(partie.creatures_vivantes()) == 1
    assert len(partie.citoyens_vivants()) == 1

    victoire = verifier_conditions_victoire(partie)
    assert victoire == CampPartie.CREATURES


def test_egalite_parfaite_si_aucun_survivant() -> None:
    """Si tous les participants sont éliminés au même tour, le résultat est une égalité."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=70,
    )
    partie = moteur.partie

    for j in partie.joueurs:
        j.est_vivant = False
        j.tour_mort = 2

    victoire = verifier_conditions_victoire(partie)
    assert victoire == CampPartie.EGALITE

    assert moteur._verifier_et_cloturer_si_victoire() is True
    assert partie.phase_actuelle == PhasePartie.TERMINEE
    assert partie.camp_vainqueur == CampPartie.EGALITE


def test_partie_en_cours_si_equilibre() -> None:
    """Tant qu'il y a 2 créatures et 3 ou 4 citoyens, la partie continue."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=80,
    )
    partie = moteur.partie
    # 2 créatures et 4 citoyens vivants
    assert verifier_conditions_victoire(partie) is None
