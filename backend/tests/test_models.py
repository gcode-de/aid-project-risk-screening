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


@pytest.mark.parametrize("cost", [np.nan, np.inf, -1.01])
def test_invalid_model_output_never_reaches_client(model_dir, monkeypatch, cost):
    predictor = Predictor("model", model_dir)
    monkeypatch.setattr(predictor.cost_model, "predict", lambda frame: [cost])
    with TestClient(create_app(predictor)) as client:
        assert client.post("/api/predict", json=PROJECT).status_code == 503


def test_success_class_order_is_not_assumed(model_dir, monkeypatch):
    predictor = Predictor("model", model_dir)
    predictor.success_index = 0
    monkeypatch.setattr(predictor.success_model, "predict_proba", lambda frame: [[0.8, 0.2]])
    with TestClient(create_app(predictor)) as client:
        result = client.post("/api/predict", json=PROJECT).json()
        assert result["estimates"]["success_probability"] == 0.8


def test_static_frontend_and_missing_assets(tmp_path: Path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<h1>Screening</h1>")
    with TestClient(create_app(Predictor("demo", tmp_path), tmp_path)) as client:
        assert "Screening" in client.get("/").text
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/missing").status_code == 404
