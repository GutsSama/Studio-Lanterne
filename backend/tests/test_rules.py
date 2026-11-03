"""Tests unitaires des règles métier et cas limites (« L'IA propose, le moteur valide »)."""

from uuid import uuid4
import pytest

from app.engine.fsm import MoteurPartieFSM
from app.engine.rules import (
    ErreurRegleJeu,
    calculer_cible_majoritaire,
    enregistrer_vote,
    executer_action_alchimiste,
    executer_inspection_inquisiteur,
    executer_tir_garde_du_corps,
    verifier_conditions_victoire,
)
from app.models.enums import (
    CampPartie,
    PhasePartie,
    RolePersonnage,
    TypeActionJeu,
)
from app.services.supabase_service import CATALOGUE_PERSONNALITES_DEFAUT


@pytest.fixture
def moteur_partie() -> MoteurPartieFSM:
    return MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.INQUISITEUR,
        graine_aleatoire=42,
    )


def test_distribution_roles_6_joueurs(moteur_partie: MoteurPartieFSM) -> None:
    """Vérifie qu'une partie comporte 6 joueurs avec exactement 2 Créatures et 4 Citoyens."""
    partie = moteur_partie.partie
    assert len(partie.joueurs) == 6
    assert len(partie.creatures_vivantes()) == 2
    assert len(partie.citoyens_vivants()) == 4


def test_inquisiteur_inspection_et_anti_double_action(
    moteur_partie: MoteurPartieFSM,
) -> None:
    """L'Inquisiteur découvre le camp d'un joueur et ne peut pas inspecter deux fois la même nuit."""
    partie = moteur_partie.partie
    inquisiteur = next(
        j for j in partie.joueurs if j.role == RolePersonnage.INQUISITEUR
    )
    cible = next(j for j in partie.joueurs if j.id != inquisiteur.id)

    action = executer_inspection_inquisiteur(partie, inquisiteur, cible.id)
    assert action.type_action == TypeActionJeu.INQUISITEUR_INSPECTER
    assert str(cible.id) in inquisiteur.memoire_ia.inspections_inquisiteur

    # Une deuxième inspection la même nuit doit être rejetée
    with pytest.raises(ErreurRegleJeu):
        executer_inspection_inquisiteur(partie, inquisiteur, cible.id)


def test_egalite_votes_conseil_aucun_mort(moteur_partie: MoteurPartieFSM) -> None:
    """En cas d'égalité de voix lors du Conseil de Jour, aucun joueur n'est éliminé."""
    partie = moteur_partie.partie
    partie.phase_actuelle = PhasePartie.VOTE_JOUR
    j1, j2, j3, j4, _, _ = partie.joueurs

    enregistrer_vote(partie, j1, j2.id)
    enregistrer_vote(partie, j3, j2.id)
    enregistrer_vote(partie, j2, j1.id)
    enregistrer_vote(partie, j4, j1.id)

    assert calculer_cible_majoritaire(partie, PhasePartie.VOTE_JOUR) is None


def test_alchimiste_potions_et_interdiction_auto_sauvetage(
    moteur_partie: MoteurPartieFSM,
) -> None:
    """L'Alchimiste peut sauver une autre victime une seule fois mais ne peut pas s'auto-sauver."""
    partie = moteur_partie.partie
    alchimiste = next(j for j in partie.joueurs if j.role == RolePersonnage.ALCHIMISTE)
    autre_citoyen = next(
        j
        for j in partie.joueurs
        if j.id != alchimiste.id and j.role != RolePersonnage.CREATURE
    )

    # Interdiction d'auto-sauvetage
    partie.victime_provisoire_nuit_id = alchimiste.id
    with pytest.raises(ErreurRegleJeu, match="auto-sauvetage"):
        executer_action_alchimiste(
            partie, alchimiste, TypeActionJeu.ALCHIMISTE_SOIGNER
        )

    # Sauvetage valide d'un autre joueur
    partie.victime_provisoire_nuit_id = autre_citoyen.id
    executer_action_alchimiste(partie, alchimiste, TypeActionJeu.ALCHIMISTE_SOIGNER)
    assert partie.victime_provisoire_nuit_id is None
    assert alchimiste.memoire_ia.potion_vie_disponible is False

    # Impossible de réutiliser la potion de Vie une seconde fois
    partie.victime_provisoire_nuit_id = autre_citoyen.id
    with pytest.raises(ErreurRegleJeu, match="déjà été utilisée"):
        executer_action_alchimiste(
            partie, alchimiste, TypeActionJeu.ALCHIMISTE_SOIGNER
        )


def test_garde_du_corps_dernier_souffle_et_conditions_victoire(
    moteur_partie: MoteurPartieFSM,
) -> None:
    """Si le Garde du Corps meurt, il tire immédiatement et peut donner la victoire aux Citoyens."""
    partie = moteur_partie.partie
    garde = next(j for j in partie.joueurs if j.role == RolePersonnage.GARDE_DU_CORPS)
    creatures = partie.creatures_vivantes()

    # Supposons que la 1re Créature est déjà morte
    creatures[0].est_vivant = False

    # La 2e Créature tue le Garde du Corps pendant la nuit
    partie.victime_provisoire_nuit_id = garde.id
    moteur_partie.resoudre_aube()

    assert partie.phase_actuelle == PhasePartie.TOUR_GARDE_DU_CORPS
    assert partie.garde_du_corps_en_attente_id == garde.id

    # Le Garde du Corps abat la dernière Créature
    executer_tir_garde_du_corps(partie, garde, creatures[1].id)
    moteur_partie.reprendre_apres_tir_garde_du_corps(origine_nuit=True)

    assert verifier_conditions_victoire(partie) == CampPartie.CITOYENS
    assert partie.camp_vainqueur == CampPartie.CITOYENS

