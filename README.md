# Aid Project Risk Screening

A focused portfolio project: React + TypeScript, FastAPI, and an explicit boundary for
trained models. The German interface supports a short presentation of project screening.
There is no database and no submitted input is persisted.

**Status:** API and React interface implemented. No trained model is included. Demo mode uses fixed,
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

In a second terminal (Node 24 LTS):

```sh
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Vite forwards `/api` to FastAPI. The production build
is served directly by FastAPI, so the browser always uses one origin.

```sh
cd frontend
npm test
npm run lint
npm run build
npm run api:types
```

Frontend types are generated from FastAPI's OpenAPI schema; regenerate them after API
changes. Form tests cover submission, missing CPI, stale results, unavailable models,
network failures and negative cost changes. There are no remotely loaded fonts or assets.

For browser tests, first build the frontend, then run `npx playwright install chromium`
and `npm run test:e2e` in `frontend/`. Playwright starts the actual FastAPI application,
checks desktop/mobile flows and runs automated accessibility checks on both views.
Port 8000 must be free. Screenshots and failure traces appear under `frontend/test-results/`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Process liveness, independent of model availability |
| `GET /api/model-info` | Mode, readiness, version, metrics and limitations |
| `GET /api/options` | Supported countries and sector mapping |
| `GET /api/cpi-reference` | Optional, time-aware CPI reference for a supported country |
| `POST /api/predict` | Validated project input and two separate estimates |

`MODEL_MODE` defaults to `unavailable`. Set `demo` explicitly for a demonstration or
`model` for trusted artifacts mounted at `MODEL_DIR` (default `models`). A broken
artifact fails startup; it never falls back to a demo.

## Documentation

- [Model integration](docs/model-integration.md)
- [Architecture decision](docs/adr/0001-small-stateless-service.md)
- [Country coverage and CPI](docs/adr/0003-country-coverage-and-cpi.md)
- [Slice log](docs/slices.md)

Source datasets, the hiring challenge, model binaries and credentials are excluded
from this public repository. The application does not imply any affiliation with a
consultancy or aid organization.

Code style follows [Ponytail](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md):
small complete changes, built-in capabilities first, validation and useful tests retained.
