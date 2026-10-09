import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.predictor import Predictor
from backend.schemas import (
    Country,
    CpiSelection,
    ModelInfo,
    Options,
    Prediction,
    ProjectInput,
    ReviewNote,
)

logger = logging.getLogger(__name__)


def create_app(predictor: Predictor | None = None, static_dir: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.predictor = predictor or Predictor.from_environment()
        yield

    app = FastAPI(title="Aid Project Risk Screening", version="0.1.0", lifespan=lifespan)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/model-info", response_model=ModelInfo)
    def model_info():
        return app.state.predictor.info

    @app.get("/api/options", response_model=Options)
    def options():
        return app.state.predictor.options()

    @app.get("/api/cpi-reference", response_model=CpiSelection)
    def cpi_reference(
        country: Country,
        approval_year: int = Query(ge=2000, le=2100),
        approval_month: int = Query(ge=1, le=12),
    ):
        try:
            return app.state.predictor.cpi_reference(country, approval_year, approval_month)
        except ValueError as error:
            raise HTTPException(422, str(error)) from None

    @app.post("/api/predict", response_model=Prediction)
    def predict(project: ProjectInput):
        engine = app.state.predictor
        if not engine.info.ready:
            raise HTTPException(503, "Es ist noch kein trainiertes Modell eingebunden.")
        try:
            engine.validate_project(project)
        except ValueError as error:
            raise HTTPException(422, str(error)) from None
        try:
            cpi = (
                CpiSelection(mode="manual", score=project.cpi_score, source="Manuelle Eingabe")
                if project.cpi_mode == "manual"
                else engine.cpi_reference(
                    project.country, project.approval_year, project.approval_month
                )
            )
            effective_project = project.model_copy(update={"cpi_score": cpi.score})
            estimates = engine.predict(effective_project)
            notes = engine.notes(effective_project)
            if cpi.reference_year is not None and project.approval_year - cpi.reference_year > 2:
                notes.append(
                    ReviewNote(
                        code="stale-cpi",
                        title="Ältere CPI-Referenz",
                        detail=(
                            "Die Referenz ist über zwei Jahre alt. "
                            "Ihre Aussagekraft fachlich prüfen."
                        ),
                    )
                )
            return Prediction(
                mode=engine.info.mode,
                model_version=engine.info.version,
                cpi=cpi,
                estimates=estimates,
                expected_cost_change_usd=round(
                    project.initial_budget_usd * estimates.expected_cost_change_ratio, 2
                ),
                notes=notes,
                limitations=engine.info.limitations,
            )
        except Exception:
            logger.exception("Prediction failed")
            raise HTTPException(
                503, "Das Modell konnte keine gültige Schätzung erzeugen."
            ) from None

    directory = static_dir or Path(os.getenv("STATIC_DIR", "frontend/dist"))
    if directory.is_dir():
        app.mount("/assets", StaticFiles(directory=directory / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        def index():
            return FileResponse(directory / "index.html")

    return app


app = create_app()
