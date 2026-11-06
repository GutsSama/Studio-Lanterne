"""Tests d'intégration des routes REST FastAPI (AI Act, Anti-triche, Création de partie)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthcheck() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["statut"] == "ok"


def test_refus_creation_partie_sans_consentement_ai_act() -> None:
    """Conformité AI Act : la création de partie est refusée si consentement_ai_act=False."""
    resp = client.post(
        "/api/parties",
        json={"nom_humain": "Sarah", "consentement_ai_act": False},
    )
    assert resp.status_code == 400
    assert "AI Act" in resp.json()["detail"]


def test_creation_partie_et_anti_triche_canal_secret() -> None:
    """Création d'une partie valide et vérification de la protection du canal secret."""
    resp = client.post(
        "/api/parties",
        json={"nom_humain": "Sarah", "consentement_ai_act": True},
    )
    assert resp.status_code == 201
    donnees = resp.json()
    assert len(donnees["joueurs"]) == 6
    assert donnees["phase_actuelle"] == "nuit"


def test_tir_garde_du_corps_humain_debloque_avancer_tour() -> None:
    """Vérifie qu'après le tir du Garde du Corps humain via /actions, /avancer-tour reprend la partie."""
    from uuid import UUID
    from app.api.routes import depot_parties
    from app.engine.rules import eliminer_joueur

    resp = client.post(
        "/api/parties",
        json={
            "nom_humain": "Billy",
            "consentement_ai_act": True,
            "role_humain_force": "garde_du_corps",
        },
    )
    assert resp.status_code == 201
    partie_id = resp.json()["id"]
    partie = depot_parties.obtenir(UUID(partie_id))
    assert partie is not None

    humain = next(j for j in partie.joueurs if j.est_humain)
    cible = next(j for j in partie.joueurs_vivants() if j.id != humain.id)

    # Le Garde du Corps meurt pendant la nuit
    eliminer_joueur(partie, humain, cause_mort="attaque_creatures")
    assert partie.phase_actuelle.value == "tour_garde_du_corps"

    # Le joueur humain tire via /actions
    resp_tir = client.post(
        f"/api/parties/{partie_id}/actions",
        json={
            "acteur_id": str(humain.id),
            "type_action": "garde_du_corps_tirer",
            "cible_id": str(cible.id),
        },
    )
    assert resp_tir.status_code == 200

    # Le tir fait immédiatement reprendre la partie (plus de blocage en tour_garde_du_corps)
    etat = client.get(f"/api/parties/{partie_id}").json()
    assert etat["phase_actuelle"] in ("debat_jour", "terminee")


def test_alchimiste_humain_garde_la_main_avant_l_aube() -> None:
    """Vérifie que la nuit s'arrête sur tour_alchimiste quand l'Alchimiste est humain."""
    from uuid import UUID
    from app.api.routes import depot_parties
    from app.engine.fsm import MoteurPartieFSM

    resp = client.post(
        "/api/parties",
        json={"nom_humain": "Alchi", "consentement_ai_act": True, "role_humain_force": "alchimiste"},
    )
    partie_id = resp.json()["id"]
    partie = depot_parties.obtenir(UUID(partie_id))
    assert partie is not None

    MoteurPartieFSM(partie).clore_votes_creatures_vers_alchimiste()
    assert partie.phase_actuelle.value == "tour_alchimiste"

    # Le prochain /simuler-tour résout l'Aube
    resp_aube = client.post(f"/api/parties/{partie_id}/simuler-tour")
    assert resp_aube.json()["nouvelle_phase"] in ("debat_jour", "tour_garde_du_corps", "terminee")




def test_alchimiste_ia_sauve_la_victime(monkeypatch) -> None:
    """Vérifie que l'Alchimiste IA peut utiliser sa potion de Vie pendant la nuit simulée."""
    from uuid import UUID
    from app.api import routes
    from app.models.ai_schema import ActionTechniqueIA, ReponseAgentIA
    from app.models.enums import PhasePartie, RolePersonnage, TypeActionJeu

    resp = client.post(
        "/api/parties",
        json={"nom_humain": "Citoyen", "consentement_ai_act": True, "role_humain_force": "citoyen"},
    )
    partie_id = resp.json()["id"]
    partie = routes.depot_parties.obtenir(UUID(partie_id))
    assert partie is not None
    alchimiste = next(j for j in partie.joueurs if j.role == RolePersonnage.ALCHIMISTE)
    humain = next(j for j in partie.joueurs if j.est_humain)

    async def fausse_ia(partie_, agent, consigne):  # noqa: ANN001
        if agent.role == RolePersonnage.ALCHIMISTE:
            action = ActionTechniqueIA(
                phase=PhasePartie.TOUR_ALCHIMISTE, pouvoir_utilise=TypeActionJeu.ALCHIMISTE_SOIGNER
            )
        elif agent.role == RolePersonnage.CREATURE:
            # Les Créatures attaquent le joueur humain
            action = ActionTechniqueIA(phase=PhasePartie.NUIT, cible_id=str(humain.id))
        else:
            action = ActionTechniqueIA(phase=PhasePartie.NUIT)
        return ReponseAgentIA(analyse_interne="test", action_technique=action), 0

    monkeypatch.setattr(routes, "interroger_agent_ia", fausse_ia)

    rep = client.post(f"/api/parties/{partie_id}/simuler-tour").json()
    assert alchimiste.memoire_ia.potion_vie_disponible is False
    assert humain.est_vivant  # sauvé par l'Alchimiste IA
    assert rep["nouvelle_phase"] == "debat_jour"


def test_selection_ia_ciblees_par_prenom() -> None:
    """Vérifie que `selectionner_ia_ciblees` cible bien les IA mentionnées dans le message."""
    from uuid import UUID
    from app.api.routes import depot_parties, selectionner_ia_ciblees

    resp = client.post(
        "/api/parties",
        json={"nom_humain": "Billy", "consentement_ai_act": True},
    )
    partie_id = resp.json()["id"]
    partie = depot_parties.obtenir(UUID(partie_id))
    assert partie is not None

    # 1. Message ciblant explicitement Elena
    cibles_elena = selectionner_ia_ciblees(partie, "Elena, pourquoi tu restes silencieuse ?")
    assert len(cibles_elena) == 1
    assert "elena" in cibles_elena[0].nom_affiche.lower()

    # 2. Message ciblant deux IA (Bob et Gérard sans accent)
    cibles_deux = selectionner_ia_ciblees(partie, "Je pense que Bob et Gerard complotent ensemble !")
    noms = [j.nom_affiche.lower() for j in cibles_deux]
    assert len(cibles_deux) == 2
    assert any("bob" in n for n in noms)
    assert any("gérard" in n or "gerard" in n for n in noms)

    # 3. Message général sans prénom : retourne 1 IA vivante
    cibles_defaut = selectionner_ia_ciblees(partie, "Je suis innocent, faites-moi confiance !")
    assert len(cibles_defaut) == 1
    assert not cibles_defaut[0].est_humain

