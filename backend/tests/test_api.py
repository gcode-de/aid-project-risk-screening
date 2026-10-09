from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.predictor import Predictor

PROJECT = {
    "country": "Kenya",
    "sector_code": 12230,
    "initial_budget_usd": 500_000,
    "cpi_score": 32,
    "cpi_mode": "manual",
    "approval_month": 12,
    "approval_year": 2024,
}


@pytest.fixture
def client():
    with TestClient(create_app(Predictor("demo", Path("unused")))) as client:
        yield client


def test_health_and_options(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    options = client.get("/api/options").json()
    assert "Kenya" in options["countries"]
    assert options["sectors"]["12230"] == "Infrastruktur"


def test_demo_is_explicit_and_computes_dollars(client):
    result = client.post("/api/predict", json=PROJECT).json()
    assert result["mode"] == "demo"
    assert result["estimates"]["success_probability"] == 0.64
    assert result["expected_cost_change_usd"] == 90_000
    assert "keine Prognose" in result["limitations"][0]
    assert {note["code"] for note in result["notes"]} == {"round-budget", "approval-timing"}


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("initial_budget_usd", 0),
        ("initial_budget_usd", -1),
        ("cpi_score", 101),
        ("cpi_score", -1),
        ("approval_month", 13),
        ("approval_month", 1.5),
        ("approval_year", 1800),
        ("country", "Unknown"),
        ("sector_code", 99999),
        ("unexpected", "field"),
    ],
)
def test_rejects_invalid_input(client, field, value):
    assert client.post("/api/predict", json={**PROJECT, field: value}).status_code == 422


def test_missing_cpi_is_preserved_as_note(client):
    result = client.post(
        "/api/predict", json={**PROJECT, "cpi_score": None, "cpi_mode": "auto"}
    ).json()
    assert "missing-cpi" in [note["code"] for note in result["notes"]]


def test_unavailable_is_not_a_silent_demo_fallback():
    with TestClient(create_app(Predictor("unavailable", Path("unused")))) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/model-info").json()["ready"] is False
        assert client.post("/api/predict", json=PROJECT).status_code == 503


def test_invalid_mode_fails_at_startup():
    with pytest.raises(ValueError, match="MODEL_MODE"):
        Predictor("typo", Path("unused"))


def test_prediction_failure_returns_safe_error(client, monkeypatch):
    def fail(_project):
        raise ValueError("sensitive implementation detail")

    monkeypatch.setattr(client.app.state.predictor, "predict", fail)
    response = client.post("/api/predict", json=PROJECT)
    assert response.status_code == 503
    assert "sensitive" not in response.text


def test_unknown_api_path_is_not_html(client):
    assert client.get("/api/unknown").status_code == 404


@pytest.mark.parametrize(("mode", "score"), [("auto", 32), ("manual", None)])
def test_cpi_mode_contract_cannot_be_bypassed(client, mode, score):
    response = client.post("/api/predict", json={**PROJECT, "cpi_mode": mode, "cpi_score": score})
    assert response.status_code == 422


def test_manual_zero_is_not_treated_as_missing(client):
    result = client.post("/api/predict", json={**PROJECT, "cpi_score": 0}).json()
    assert result["cpi"]["score"] == 0
    assert result["cpi"]["mode"] == "manual"
    assert "missing-cpi" not in [note["code"] for note in result["notes"]]
