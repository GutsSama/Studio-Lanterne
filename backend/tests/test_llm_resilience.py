"""Tests de résilience du parsing et de la normalisation des réponses LLM (LiteLLM)."""

from uuid import uuid4

from app.agents.orchestrator import (
    calculer_cout_reel_litellm,
    construire_reponse_fallback,
    nettoyer_json_llm,
    normaliser_cles_json_ia,
    parser_json_ia_robuste,
)
from app.engine.fsm import MoteurPartieFSM
from app.models.ai_schema import ReponseAgentIA
from app.models.enums import PhasePartie, RolePersonnage, TypeActionJeu
from app.services.supabase_service import CATALOGUE_PERSONNALITES_DEFAUT


def test_nettoyage_balises_think_qwen_deepseek() -> None:
    """Vérifie que les balises <think>...</think> générées par certains modèles sont éliminées."""
    texte_brut = (
        "<think>Je dois faire attention à ne pas éveiller les soupçons d'Elena.</think>\n"
        '{\n  "analyse_interne": "Je vote contre Lucas.",\n'
        '  "action_technique": {"phase": "vote_jour", "cible_id": "lucas-uuid", "pouvoir_utilise": null},\n'
        '  "declaration_publique": "Lucas me semble très nerveux aujourd\'hui."\n}'
    )
    nettoye = nettoyer_json_llm(texte_brut)
    assert "<think>" not in nettoye
    assert "</think>" not in nettoye
    assert '"analyse_interne": "Je vote contre Lucas."' in nettoye


def test_extraction_markdown_codeblock() -> None:
    """Vérifie l'extraction du JSON encadré par des blocs de code markdown (```json ... ```)."""
    texte_markdown = (
        "Voici mon action pour ce tour :\n"
        "```json\n"
        "{\n"
        '  "analyse_interne": "Elena calcule trop, c\'est suspect.",\n'
        '  "action_technique": {\n'
        '    "phase": "debat_jour",\n'
        '    "cible_id": null,\n'
        '    "pouvoir_utilise": null\n'
        "  },\n"
        '  "declaration_publique": "Elena, pourquoi détournes-tu les questions de Gérard ?"\n'
        "}\n"
        "```\n"
        "J'espère que le village m'écoutera."
    )
    nettoye = nettoyer_json_llm(texte_markdown)
    assert nettoye.startswith("{")
    assert nettoye.endswith("}")
    donnees = parser_json_ia_robuste(texte_markdown)
    assert donnees["analyse_interne"] == "Elena calcule trop, c'est suspect."
    assert "Elena, pourquoi détournes-tu" in donnees["declaration_publique"]


def test_reparation_json_ia_tronque() -> None:
    """Vérifie la robustesse du parser si le LLM est coupé par la limite de tokens."""
    json_coupe = (
        '{\n  "analyse_interne": "Je soupçonne fortement Gérard qui hausse la voix",\n'
        '  "action_technique": {\n    "cible_id": "gerard-id-1234"'
    )
    donnees = parser_json_ia_robuste(json_coupe)
    assert "Gérard qui hausse la voix" in donnees["analyse_interne"]
    assert donnees["action_technique"]["cible_id"] == "gerard-id-1234"


def test_normalisation_variantes_cles_llm() -> None:
    """Tolère les synonymes courants utilisés par les modèles anglo-saxons (target_id, message, etc.)."""
    reponse_anglicismes = {
        "analysis_interne": "Analyse logique du conseil.",
        "technical_action": {
            "target_id": "bob-id",
            "pouvoir_utilise": "inquisiteur_inspecter",
        },
        "public_declaration": "Je demande des explications à Bob.",
    }
    normalise = normaliser_cles_json_ia(reponse_anglicismes, PhasePartie.NUIT)
    assert normalise["analyse_interne"] == "Analyse logique du conseil."
    assert normalise["action_technique"]["cible_id"] == "bob-id"
    assert normalise["action_technique"]["pouvoir_utilise"] == "inquisiteur_inspecter"
    assert normalise["declaration_publique"] == "Je demande des explications à Bob."

    # Validation par Pydantic
    modele = ReponseAgentIA.model_validate(normalise)
    assert modele.action_technique.pouvoir_utilise == TypeActionJeu.INQUISITEUR_INSPECTER


def test_repli_secours_fallback_timeout() -> None:
    """Vérifie que la réponse de repli automatique génère toujours une action valide pour le moteur."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=55,
    )
    partie = moteur.partie
    partie.phase_actuelle = PhasePartie.VOTE_JOUR
    agent = partie.joueurs[1]

    fallback = construire_reponse_fallback(partie, agent, raison="TimeoutError")
    assert "[FALLBACK AUTOMATIQUE" in fallback.analyse_interne
    assert fallback.action_technique.phase == PhasePartie.VOTE_JOUR
    # La cible désignée doit être un joueur vivant
    assert fallback.action_technique.cible_id is not None
    cible = partie.obtenir_joueur(fallback.action_technique.cible_id)
    assert cible is not None
    assert cible.est_vivant is True


def test_calcul_cout_tarifaire_secours() -> None:
    """Vérifie le calcul tarifaire par défaut si litellm.completion_cost échoue."""
    total_tokens = 1000
    cout = calculer_cout_reel_litellm(None, "modele-inconnu", total_tokens)
    assert cout > 0.0
    assert cout == round(1000 * 0.00000015, 6)

