# Aid Project Risk Screening

A focused portfolio project: React + TypeScript, FastAPI, and an explicit boundary for
trained models. The German interface supports a short presentation of project screening.
There is no database and no submitted input is persisted.

**Status:** API slice implemented. No trained model is included. Demo mode uses fixed,
clearly labelled illustrative numbers, never claimed to be analytical findings.

## API development

Requires Python 3.12 and [uv](https://docs.astral.sh/uv/).

```sh
uv sync --python 3.12 --extra ml
uv run pytest
uv run ruff check .
MODEL_MODE=demo uv run uvicorn backend.main:app --reload --host 127.0.0.1
```

API documentation: <http://127.0.0.1:8000/docs>.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Process liveness, independent of model availability |
| `GET /api/model-info` | Mode, readiness, version, metrics and limitations |
| `GET /api/options` | Supported countries and sector mapping |
| `POST /api/predict` | Validated project input and two separate estimates |

`MODEL_MODE` defaults to `unavailable`. Set `demo` explicitly for a demonstration or
`model` for trusted artifacts mounted at `MODEL_DIR` (default `models`). A broken
artifact fails startup; it never falls back to a demo.

## Documentation

- [Model integration](docs/model-integration.md)
- [Architecture decision](docs/adr/0001-small-stateless-service.md)
- [Slice log](docs/slices.md)

Source datasets, the hiring challenge, model binaries and credentials are excluded
from this public repository. The application does not imply any affiliation with a
consultancy or aid organization.

Code style follows [Ponytail](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md):
small complete changes, built-in capabilities first, validation and useful tests retained.
