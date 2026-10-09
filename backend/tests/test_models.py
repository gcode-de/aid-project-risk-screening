import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.pipeline import Pipeline

from backend.main import create_app
from backend.predictor import FEATURES, Predictor
from backend.tests.test_api import PROJECT


@pytest.fixture
def model_dir(tmp_path):
    frame = pd.DataFrame(
        [
            ["Kenya", 12230, 500_000, 32, 12, 2020],
            ["Germany", 12220, 1_000_000, 80, 6, 2021],
        ],
        columns=FEATURES,
    )
    success = Pipeline([("model", DummyClassifier(strategy="prior"))]).fit(frame, [0, 1])
    costs = Pipeline([("model", DummyRegressor(strategy="constant", constant=-0.10))]).fit(
        frame, [0, 0]
    )
    joblib.dump(success, tmp_path / "success_pipeline.joblib")
    joblib.dump(costs, tmp_path / "cost_pipeline.joblib")
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "version": "test-fixture",
                "features": FEATURES,
                "training_year_min": 2005,
                "training_year_max": 2022,
                "budget_min_usd": 100_000,
                "budget_max_usd": 1_000_000,
                "countries": ["Kenya", "Germany"],
                "sector_codes": [12230, 12220],
                "metrics": {"fixture_only": 0.5},
                "limitations": ["Test-only dummy models."],
            }
        )
    )
    return tmp_path


def test_real_serialized_pipeline_and_negative_cost_change(model_dir):
    with TestClient(create_app(Predictor("model", model_dir))) as client:
        result = client.post("/api/predict", json=PROJECT).json()
        assert result["mode"] == "model"
        assert result["estimates"]["success_probability"] == 0.5
        assert result["expected_cost_change_usd"] == -50_000
        assert "year-outside-training" in [note["code"] for note in result["notes"]]


def test_missing_artifact_fails_startup(tmp_path):
    with pytest.raises(FileNotFoundError):
        Predictor("model", tmp_path)


def test_manifest_rejects_wrong_feature_order(model_dir):
    path = model_dir / "manifest.json"
    manifest = json.loads(path.read_text())
    manifest["features"] = list(reversed(FEATURES))
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="features"):
        Predictor("model", model_dir)


@pytest.mark.parametrize("cost", [np.nan, np.inf, -1.01, 1e308])
def test_invalid_model_output_never_reaches_client(model_dir, monkeypatch, cost):
    predictor = Predictor("model", model_dir)
    monkeypatch.setattr(predictor.cost_model, "predict", lambda frame: [cost])
    with TestClient(create_app(predictor)) as client:
        assert client.post("/api/predict", json=PROJECT).status_code == 503


def test_success_class_order_is_not_assumed(model_dir):
    path = model_dir / "success_pipeline.joblib"
    pipeline = joblib.load(path)
    pipeline.named_steps["model"].classes_ = np.array([1, 0])
    pipeline.named_steps["model"].class_prior_ = np.array([0.8, 0.2])
    joblib.dump(pipeline, path)
    predictor = Predictor("model", model_dir)
    with TestClient(create_app(predictor)) as client:
        result = client.post("/api/predict", json=PROJECT).json()
        assert result["estimates"]["success_probability"] == 0.8


def test_non_predictor_artifact_fails_startup(model_dir):
    joblib.dump({"not": "a model"}, model_dir / "cost_pipeline.joblib")
    with pytest.raises(ValueError, match="Artifacts must implement"):
        Predictor("model", model_dir)


def test_static_frontend_and_missing_assets(tmp_path: Path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<h1>Screening</h1>")
    with TestClient(create_app(Predictor("demo", tmp_path), tmp_path)) as client:
        assert "Screening" in client.get("/").text
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/missing").status_code == 404


def test_manifest_limits_country_and_sector_choices(model_dir):
    with TestClient(create_app(Predictor("model", model_dir))) as client:
        options = client.get("/api/options").json()
        assert options["countries"] == ["Germany", "Kenya"]
        assert set(options["sectors"]) == {"12220", "12230"}
        assert (
            client.post("/api/predict", json={**PROJECT, "country": "Nigeria"}).status_code == 422
        )
        assert (
            client.post("/api/predict", json={**PROJECT, "sector_code": 15122}).status_code == 422
        )
        assert (
            client.get(
                "/api/cpi-reference",
                params={"country": "Nigeria", "approval_year": 2024, "approval_month": 12},
            ).status_code
            == 422
        )


def test_cpi_lookup_respects_country_publication_and_missing_values(model_dir, monkeypatch):
    from backend.schemas import CpiReference

    predictor = Predictor("model", model_dir)
    predictor.manifest.cpi_references = [
        CpiReference(
            country="Kenya",
            reference_year=2020,
            score=31,
            source="Test reference, not official",
            available_from="2021-01-15",
        ),
        CpiReference(
            country="Kenya",
            reference_year=2023,
            score=33,
            source="Test reference 2023",
            available_from="2024-12-15",
        ),
    ]
    seen = []
    original = predictor.predict

    def capture(project):
        seen.append(project.cpi_score)
        return original(project)

    monkeypatch.setattr(predictor, "predict", capture)
    with TestClient(create_app(predictor)) as client:
        params = {"country": "Kenya", "approval_year": 2024, "approval_month": 12}
        reference = client.get("/api/cpi-reference", params=params).json()
        assert reference["score"] == 31  # December 15 is after the conservative cutoff.
        assert (
            client.get("/api/cpi-reference", params={**params, "country": "Germany"}).json()[
                "score"
            ]
            is None
        )
        assert (
            client.get("/api/cpi-reference", params={**params, "approval_year": 2020}).json()[
                "score"
            ]
            is None
        )
        assert (
            client.get("/api/cpi-reference", params={**params, "approval_year": 2025}).json()[
                "score"
            ]
            == 33
        )
        result = client.post(
            "/api/predict", json={**PROJECT, "cpi_mode": "auto", "cpi_score": None}
        ).json()
        assert result["cpi"] == reference
        assert seen == [31]
        assert "stale-cpi" in [note["code"] for note in result["notes"]]


def test_duplicate_cpi_reference_rejected(model_dir):
    path = model_dir / "manifest.json"
    manifest = json.loads(path.read_text())
    entry = {
        "country": "Kenya",
        "reference_year": 2023,
        "score": 31,
        "source": "Test only",
        "available_from": "2024-01-30",
    }
    manifest["cpi_references"] = [entry, entry]
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="duplicate CPI"):
        Predictor("model", model_dir)
