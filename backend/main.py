import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.predictor import Predictor
from backend.schemas import COUNTRIES, SECTORS, ModelInfo, Options, Prediction, ProjectInput

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
        return Options(countries=COUNTRIES, sectors=SECTORS)

    @app.post("/api/predict", response_model=Prediction)
    def predict(project: ProjectInput):
        engine = app.state.predictor
        if not engine.info.ready:
            raise HTTPException(503, "Es ist noch kein trainiertes Modell eingebunden.")
        try:
            estimates = engine.predict(project)
            return Prediction(
                mode=engine.info.mode,
                model_version=engine.info.version,
                estimates=estimates,
                expected_cost_change_usd=round(
                    project.initial_budget_usd * estimates.expected_cost_change_ratio, 2
                ),
                notes=engine.notes(project),
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
