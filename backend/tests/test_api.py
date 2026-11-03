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

