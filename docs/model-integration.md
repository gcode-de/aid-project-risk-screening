# Integrating trained models

Train offline. Install `uv sync --extra ml` and use the exact committed lockfile for
training and serving. Never load untrusted joblib/pickle files: deserialization executes
Python. There is deliberately no model-upload endpoint.

Mount these files read-only at `MODEL_DIR` and set `MODEL_MODE=model`:

- `success_pipeline.joblib`: complete sklearn pipeline with `predict_proba` and classes 0/1.
- `cost_pipeline.joblib`: complete pipeline with `predict`, returning **signed cost change**
  `(Final_Cost_USD - Initial_Budget_USD) / Initial_Budget_USD`. `0.18` means +18%,
  `-0.10` means 10% under budget. This is not a probability or a conditional estimate.
- `manifest.json`: the following contract, populated with real evaluation results:

```json
{
  "schema_version": 1,
  "version": "YOUR_VALIDATED_MODEL_VERSION",
  "features": ["Recipient_Country", "DAC_Sector_Code", "Initial_Budget_USD", "CPI_Score", "Approval_Month", "Approval_Year"],
  "training_year_min": 2005,
  "training_year_max": 2022,
  "budget_min_usd": 1000,
  "budget_max_usd": 200000000,
  "metrics": {},
  "limitations": ["Replace with measured validation limits and probability-calibration findings."]
}
```

The dates and budget bounds above illustrate the schema; replace them with actual training
coverage. Metrics belong to a held-out time period; use clear names such as
`success_brier_score`, `success_failure_recall`, `cost_mae_ratio`. Do not publish invented
metrics. Declare the success label definition and validation years in `limitations`.

Pipelines receive a one-row pandas DataFrame in the exact column order above. Country is
English text; DAC sector code is an integer; missing CPI is `NaN`. All encoders, imputers,
scalers and derived features must be fitted only on training data and saved in the pipeline.
Do not use final cost or realized evaluation lag as input features at approval time.

Probability output must be finite and between 0 and 1; cost change must be finite and at
least -1. Invalid predictions produce HTTP 503, never silently clipped numbers. The API
finds class 1 by label rather than assuming column order. Years and budgets outside the
manifest range produce visible warnings, not claims of validated forecasting ability.

Until integration, `MODEL_MODE=demo` returns fixed 64% success and +18% cost change.
Only dollar conversion and review notes respond to inputs. These fixtures are deliberately
independent of the source dataset and do not represent trained estimates.
