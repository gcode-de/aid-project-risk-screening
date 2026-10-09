import json
import math
import os
from datetime import date
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.schemas import (
    COUNTRIES,
    SECTORS,
    Country,
    CpiReference,
    CpiSelection,
    Estimates,
    ModelInfo,
    Options,
    ProjectInput,
    ReviewNote,
    SectorCode,
)

LIMITATION = "Prototyp zur Prüfungsvorbereitung. Keine automatische Förder- oder Auditentscheidung."
FEATURES = [
    "Recipient_Country",
    "DAC_Sector_Code",
    "Initial_Budget_USD",
    "CPI_Score",
    "Approval_Month",
    "Approval_Year",
]


class Manifest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    schema_version: Literal[1]
    version: str = Field(min_length=1)
    features: list[str]
    training_year_min: int
    training_year_max: int
    budget_min_usd: float = Field(gt=0)
    budget_max_usd: float = Field(gt=0)
    countries: list[Country] = Field(min_length=1)
    sector_codes: list[SectorCode] = Field(min_length=1)
    cpi_references: list[CpiReference] = Field(default_factory=list)
    metrics: dict[str, float]
    limitations: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_contract(self):
        if self.features != FEATURES:
            raise ValueError("Manifest features must match the documented input contract")
        if self.training_year_min > self.training_year_max:
            raise ValueError("Training years are reversed")
        if self.budget_min_usd > self.budget_max_usd:
            raise ValueError("Training budget bounds are reversed")
        if len(set(self.countries)) != len(self.countries):
            raise ValueError("Duplicate countries in manifest")
        if len(set(self.sector_codes)) != len(self.sector_codes):
            raise ValueError("Duplicate sectors in manifest")
        reference_keys = set()
        for reference in self.cpi_references:
            if reference.country not in self.countries:
                raise ValueError("CPI reference country is outside training coverage")
            if reference.reference_year > reference.available_from.year:
                raise ValueError("CPI reference cannot be published before its reference year")
            key = (reference.country, reference.reference_year, reference.available_from)
            if key in reference_keys:
                raise ValueError("Ambiguous duplicate CPI reference")
            reference_keys.add(key)
        return self


class Predictor:
    def __init__(self, mode: str, model_dir: Path):
        self.manifest = None
        self.success_model = None
        self.cost_model = None
        if mode == "model":
            import joblib

            self.manifest = Manifest.model_validate_json((model_dir / "manifest.json").read_text())
            # Only operator-provided, trusted artifacts: joblib can execute Python code.
            self.success_model = joblib.load(model_dir / "success_pipeline.joblib")
            self.cost_model = joblib.load(model_dir / "cost_pipeline.joblib")
            if not callable(getattr(self.success_model, "predict_proba", None)) or not callable(
                getattr(self.cost_model, "predict", None)
            ):
                raise ValueError("Artifacts must implement predict_proba and predict")
            classes = list(self.success_model.classes_)
            if len(classes) != 2 or set(classes) != {0, 1}:
                raise ValueError("Success pipeline must classify 0 and 1")
            self.success_index = classes.index(1)
            self.info = ModelInfo(
                mode="model",
                version=self.manifest.version,
                ready=True,
                limitations=[LIMITATION, *self.manifest.limitations],
                metrics=self.manifest.metrics,
                training_year_min=self.manifest.training_year_min,
                training_year_max=self.manifest.training_year_max,
            )
        elif mode == "demo":
            self.info = ModelInfo(
                mode="demo",
                version="demo-fixture-v1",
                ready=True,
                limitations=[
                    "Illustrative Demo: 64 % und +18 % sind feste Beispielwerte, keine Prognose.",
                    "Eingaben verändern nur den Dollarbetrag und regelbasierte Prüfhinweise.",
                    LIMITATION,
                ],
            )
        elif mode == "unavailable":
            self.info = ModelInfo(
                mode="unavailable",
                version=None,
                ready=False,
                limitations=["Es ist noch kein trainiertes Modell eingebunden."],
            )
        else:
            raise ValueError("MODEL_MODE must be unavailable, demo or model")

    @classmethod
    def from_environment(cls):
        return cls(os.getenv("MODEL_MODE", "unavailable"), Path(os.getenv("MODEL_DIR", "models")))

    def options(self) -> Options:
        return Options(
            countries=sorted(self.manifest.countries) if self.manifest else COUNTRIES,
            sectors={code: SECTORS[code] for code in self.manifest.sector_codes}
            if self.manifest
            else SECTORS,
        )

    def validate_project(self, project: ProjectInput) -> None:
        if project.country not in self.options().countries:
            raise ValueError("Für dieses Land enthält das Modell keine Trainingsdaten.")
        if project.sector_code not in self.options().sectors:
            raise ValueError("Für diesen Sektor enthält das Modell keine Trainingsdaten.")
        if project.cpi_mode == "auto" and project.cpi_score is not None:
            raise ValueError(
                "Im automatischen Modus wird der CPI ausschließlich serverseitig ermittelt."
            )
        if project.cpi_mode == "manual" and project.cpi_score is None:
            raise ValueError("Für die manuelle CPI-Eingabe ist ein Wert erforderlich.")

    def cpi_reference(self, country: Country, year: int, month: int) -> CpiSelection:
        if country not in self.options().countries:
            raise ValueError("Für dieses Land enthält das Modell keine Trainingsdaten.")
        # Month precision: use only references published by the first day of that month.
        cutoff = date(year, month, 1)
        references = (
            [
                item
                for item in self.manifest.cpi_references
                if item.country == country and item.available_from <= cutoff
            ]
            if self.manifest
            else []
        )
        if not references:
            return CpiSelection()
        item = max(references, key=lambda item: (item.reference_year, item.available_from))
        return CpiSelection(
            score=item.score, reference_year=item.reference_year, source=item.source
        )

    def predict(self, project: ProjectInput) -> Estimates:
        if self.info.mode == "demo":
            return Estimates(success_probability=0.64, expected_cost_change_ratio=0.18)
        if not self.info.ready:
            raise RuntimeError("No model loaded")

        import pandas as pd

        frame = pd.DataFrame(
            [
                [
                    project.country,
                    project.sector_code,
                    project.initial_budget_usd,
                    project.cpi_score if project.cpi_score is not None else math.nan,
                    project.approval_month,
                    project.approval_year,
                ]
            ],
            columns=FEATURES,
        )
        return Estimates(
            success_probability=float(
                self.success_model.predict_proba(frame)[0][self.success_index]
            ),
            expected_cost_change_ratio=float(self.cost_model.predict(frame)[0]),
        )

    def notes(self, project: ProjectInput) -> list[ReviewNote]:
        notes = []
        if project.initial_budget_usd in {50_000, 100_000, 500_000, 1_000_000}:
            notes.append(
                ReviewNote(
                    code="round-budget",
                    title="Wiederkehrender Budgetbetrag",
                    detail=("Standardisierte Förderstufe prüfen. Kein Manipulationsnachweis."),
                )
            )
        if project.cpi_score is None:
            notes.append(
                ReviewNote(
                    code="missing-cpi",
                    title="CPI-Wert fehlt",
                    detail="Datenlücke: Das Modell muss fehlende Werte verarbeiten können.",
                )
            )
        if project.approval_month in {9, 12}:
            notes.append(
                ReviewNote(
                    code="approval-timing",
                    title="Genehmigungszeitpunkt prüfen",
                    detail="Haushaltsfristen klären. Der Monat allein belegt kein höheres Risiko.",
                )
            )
        if self.manifest:
            if (
                not self.manifest.training_year_min
                <= project.approval_year
                <= self.manifest.training_year_max
            ):
                notes.append(
                    ReviewNote(
                        code="year-outside-training",
                        title="Jahr außerhalb der Trainingsdaten",
                        detail="Die Übertragbarkeit auf diesen Zeitraum ist nicht nachgewiesen.",
                    )
                )
            if (
                not self.manifest.budget_min_usd
                <= project.initial_budget_usd
                <= self.manifest.budget_max_usd
            ):
                notes.append(
                    ReviewNote(
                        code="budget-outside-training",
                        title="Budget außerhalb der Trainingsdaten",
                        detail="Die Übertragbarkeit auf diese Budgetgröße ist nicht nachgewiesen.",
                    )
                )
        return notes


if __name__ == "__main__":
    print(json.dumps(Manifest.model_json_schema(), indent=2))
