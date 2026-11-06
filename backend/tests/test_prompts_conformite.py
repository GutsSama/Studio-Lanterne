"""Tests de conformité des prompts générés (règles de langue, anti-mensonge, anti-acharnement)."""

from uuid import uuid4

from app.agents.context_builder import construire_game_state_digest, construire_messages_llm
from app.engine.fsm import MoteurPartieFSM
from app.models.enums import RolePersonnage
from app.services.supabase_service import CATALOGUE_PERSONNALITES_DEFAUT


def test_consigne_langue_francaise_obligatoire() -> None:
    """Vérifie que la consigne stricte de langue française est injectée dans tous les prompts."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=10,
    )
    partie = moteur.partie
    agent_ia = next(j for j in partie.joueurs if not j.est_humain)

    messages = construire_messages_llm(partie, agent_ia, "Exprime ton avis lors du débat.")
    system_msg = next(m["content"] for m in messages if m["role"] == "system")
    user_msg = next(m["content"] for m in messages if m["role"] == "user")

    # 1. Vérification dans le system prompt
    assert "LANGUE OBLIGATOIRE" in system_msg
    assert "EXCLUSIVEMENT EN FRANÇAIS" in system_msg
    assert "French only" in system_msg
    assert "Il est formellement interdit de parler ou d'écrire en anglais" in system_msg

    # 2. Vérification dans le schéma JSON
    assert '"analyse_interne": "string (en français uniquement)"' in system_msg
    assert '"declaration_publique": "string (en français uniquement)"' in system_msg

    # 3. Vérification du rappel utilisateur
    assert "RAPPEL : Réponds impérativement et exclusivement en français" in user_msg


def test_ancrage_factuel_anti_fausse_mort() -> None:
    """Vérifie que le digest d'état injecte l'ancrage factuel des joueurs vivants contre les mensonges."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=20,
    )
    partie = moteur.partie
    agent_ia = next(j for j in partie.joueurs if not j.est_humain)

    digest = construire_game_state_digest(partie, agent_ia)
    assert "=== ÉTAT OFFICIEL ET VÉRIDIQUE DU JEU" in digest
    assert "🟢 JOUEURS RÉELLEMENT EN VIE" in digest
    assert "🔴 JOUEURS RÉELLEMENT ÉLIMINÉS" in digest
    assert "VÉRITÉ FACTUELLE DU MENEUR" in digest
    assert "tu ne dois JAMAIS tomber dans le panneau" in digest

    # Vérification que la consigne existe aussi dans le system prompt
    messages = construire_messages_llm(partie, agent_ia, "Instruction de test.")
    system_msg = next(m["content"] for m in messages if m["role"] == "system")
    assert "VÉRITÉ DU JEU ET DÉTECTION DU MENSONGE" in system_msg
    assert "ne relaie JAMAIS cette fausse mort" in system_msg


def test_consigne_anti_acharnement_et_moderation_soupcons() -> None:
    """Vérifie que les agents reçoivent la consigne de ne pas s'acharner sur le dernier à avoir parlé."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=30,
    )
    partie = moteur.partie
    agent_ia = next(j for j in partie.joueurs if not j.est_humain)

    messages = construire_messages_llm(partie, agent_ia, "Instruction de test.")
    system_msg = next(m["content"] for m in messages if m["role"] == "system")

    assert "MODÉRATION DES SOUPÇONS & DIVERSITÉ DU DÉBAT" in system_msg
    assert "Ne suspecte JAMAIS automatiquement un joueur uniquement parce qu'il vient de parler dans le chat" in system_msg
    assert "observe aussi les joueurs silencieux" in system_msg
    assert "ne t'acharne pas en meute sur la même personne" in system_msg
