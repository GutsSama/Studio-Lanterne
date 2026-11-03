"""Tests de sécurité et de cloisonnement contextuel (Zero Information Leak & Anti-Triche)."""

from uuid import uuid4

from app.agents.context_builder import construire_messages_llm
from app.api.routes import serialiser_partie_pour_humain
from app.engine.fsm import MoteurPartieFSM
from app.models.enums import CanalMessage, PhasePartie, RolePersonnage
from app.models.game import MessagePartie
from app.services.supabase_service import CATALOGUE_PERSONNALITES_DEFAUT


def test_zero_information_leak_citoyen_ne_voit_pas_chat_creatures() -> None:
    """Un agent Citoyen ne reçoit JAMAIS les messages secrets des Créatures ni leur identité."""
    moteur = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.CITOYEN,
        graine_aleatoire=99,
    )
    partie = moteur.partie
    creature = partie.creatures_vivantes()[0]
    citoyen_ia = next(
        j
        for j in partie.joueurs
        if not j.est_humain and j.role != RolePersonnage.CREATURE
    )

    # Message secret envoyé la nuit par une Créature
    secret_txt = "COMPLOT_SECRET_NOCTURNE_ATTAQUONS_SARAH"
    partie.messages.append(
        MessagePartie(
            partie_id=partie.id,
            joueur_emetteur_id=creature.id,
            nom_emetteur=creature.nom_affiche,
            canal=CanalMessage.CREATURE_SECRET,
            tour=1,
            phase=PhasePartie.NUIT,
            contenu=secret_txt,
            est_ia=True,
        )
    )

    # Ajout d'une pensée secrète interne à la Créature
    creature.memoire_ia.notes_strategiques.append("PENSEE_INTERNE_MASQUEE_123")

    # 1. Vérification du prompt construit pour un agent Citoyen
    messages_llm_citoyen = construire_messages_llm(
        partie, citoyen_ia, "Exprime ton avis."
    )
    prompt_complet = " ".join(m["content"] for m in messages_llm_citoyen)
    assert secret_txt not in prompt_complet
    assert "PENSEE_INTERNE_MASQUEE_123" not in prompt_complet
    assert "[SECRET CRÉATURE]" not in prompt_complet

    # 2. Vérification qu'une Créature voit bien le canal secret
    messages_llm_creature = construire_messages_llm(
        partie, creature, "Choisis une victime."
    )
    prompt_creature = " ".join(m["content"] for m in messages_llm_creature)
    assert secret_txt in prompt_creature
    assert "[SECRET CRÉATURE]" in prompt_creature

    # 3. Vérification de la sérialisation REST/WebSocket envoyée au joueur humain Citoyen
    vue_humain = serialiser_partie_pour_humain(partie)
    textes_messages_humain = [m["contenu"] for m in vue_humain["messages"]]
    assert secret_txt not in textes_messages_humain

    # Les rôles des IA vivantes doivent être masqués (`None`) pour un humain Citoyen
    for j_pub in vue_humain["joueurs"]:
        if not j_pub["est_humain"]:
            assert j_pub["role"] is None
    assert vue_humain["informations_role_humain"] == {}


def test_informations_secretes_humain_alchimiste_et_inquisiteur() -> None:
    """Vérifie que l'humain Alchimiste ou Inquisiteur reçoit ses propres informations secrètes de rôle."""
    # Cas 1 : Humain Alchimiste
    moteur_alch = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.ALCHIMISTE,
        graine_aleatoire=12,
    )
    cible_nuit = moteur_alch.partie.joueurs[1]
    moteur_alch.partie.victime_provisoire_nuit_id = cible_nuit.id

    vue_alch = serialiser_partie_pour_humain(moteur_alch.partie)
    infos_alch = vue_alch["informations_role_humain"]
    assert infos_alch["potion_vie_disponible"] is True
    assert infos_alch["potion_mort_disponible"] is True
    assert infos_alch["victime_provisoire_nuit_id"] == str(cible_nuit.id)

    # Cas 2 : Humain Inquisiteur
    moteur_inq = MoteurPartieFSM.creer_partie_solo_vs_ia(
        hote_id=uuid4(),
        nom_humain="Sarah",
        personnalites_ia=CATALOGUE_PERSONNALITES_DEFAUT,
        role_humain_force=RolePersonnage.INQUISITEUR,
        graine_aleatoire=15,
    )
    humain_inq = moteur_inq.partie.joueurs[0]
    humain_inq.memoire_ia.inspections_inquisiteur["joueur-x"] = "creatures"

    vue_inq = serialiser_partie_pour_humain(moteur_inq.partie)
    assert vue_inq["informations_role_humain"]["inspections_inquisiteur"] == {
        "joueur-x": "creatures"
    }


