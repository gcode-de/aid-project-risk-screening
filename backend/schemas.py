from datetime import date
from typing import Literal, get_args

from pydantic import BaseModel, ConfigDict, Field

Country = Literal[
    "Colombia",
    "Federated States of Micronesia",
    "France",
    "Germany",
    "India",
    "Japan",
    "Kenya",
    "Lithuania",
    "Nigeria",
    "Philippines",
    "United Kingdom",
    "United States",
]
COUNTRIES = list(get_args(Country))
SectorCode = Literal[12191, 12220, 12230, 12264, 15122, 15123]
SECTORS = {
    12191: "Medizinische Dienstleistungen",
    12220: "Gesundheitsgrundversorgung",
    12230: "Infrastruktur",
    12264: "COVID-19-Kontrolle",
    15122: "Diplomatische Vertretungen",
    15123: "Verwaltung",
}


class ProjectInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    country: Country
    sector_code: SectorCode
    initial_budget_usd: float = Field(gt=0, le=1_000_000_000_000)
    cpi_score: float | None = Field(default=None, ge=0, le=100)
    cpi_mode: Literal["auto", "manual"] = "auto"
    approval_month: int = Field(ge=1, le=12, strict=True)
    approval_year: int = Field(ge=2000, le=2100, strict=True)


class CpiReference(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    country: Country
    reference_year: int = Field(ge=2000, le=2100)
    score: float = Field(ge=0, le=100)
    source: str = Field(min_length=1, max_length=500)
    available_from: date


class CpiSelection(BaseModel):
    mode: Literal["auto", "manual"] = "auto"
    score: float | None = Field(default=None, ge=0, le=100)
    reference_year: int | None = None
    source: str | None = None


class ReviewNote(BaseModel):
    code: str
    title: str
    detail: str


class Estimates(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    success_probability: float = Field(ge=0, le=1)
    expected_cost_change_ratio: float = Field(ge=-1)


class Prediction(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    mode: Literal["demo", "model"]
    model_version: str
    cpi: CpiSelection
    estimates: Estimates
    expected_cost_change_usd: float
    notes: list[ReviewNote]
    limitations: list[str]


class ModelInfo(BaseModel):
    mode: Literal["demo", "model", "unavailable"]
    version: str | None
    ready: bool
    limitations: list[str]
    metrics: dict[str, float] = Field(default_factory=dict)
    training_year_min: int | None = None
    training_year_max: int | None = None


class Options(BaseModel):
    countries: list[str]
    sectors: dict[int, str]
