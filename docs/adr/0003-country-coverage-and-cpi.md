# ADR 0003: Model-owned country coverage and time-aware CPI references

Status: accepted

## Context

Predictions outside training coverage would imply unsupported generalization. The
challenge data also contains multiple CPI scores per country/year, so reading an
arbitrary row or a full-dataset median is not a reliable official country reference.

## Decision

The trusted model manifest declares its training countries and sectors. The UI uses
only these options; the API rejects unsupported inputs independently. Demo coverage
matches the supplied dataset but is not described as an already trained model.

CPI is resolved server-side from optional, vetted country/year references with source
and publication date. Only references available by the start of the approval month
are eligible. Missing references remain missing; no fabricated defaults. Older values
receive a warning. Manual overrides are explicit and reset when country/date changes.
The response records the score and provenance actually used, not just a UI preview.

## Consequences

No database or external per-request API is needed. Model preparation must verify both
coverage and CPI provenance, and use identical point-in-time lookup during training.
Manual input remains the user's responsibility. Reference completeness and model
calibration remain prerequisites for meaningful forecasting, not properties of this demo.
