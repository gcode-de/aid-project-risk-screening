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
  "countries": ["Kenya", "Germany"],
  "sector_codes": [12230, 12220],
  "cpi_references": [],
  "metrics": {},
  "limitations": ["Replace with measured validation limits and probability-calibration findings."]
}
```

The dates and budget bounds above illustrate the schema; replace them with actual training
coverage. Metrics belong to a held-out time period; use clear names such as
`success_brier_score`, `success_failure_recall`, `cost_mae_ratio`. Do not publish invented
metrics. Declare the success label definition and validation years in `limitations`.

`countries` and `sector_codes` must list only values actually represented in training.
They populate the UI and are enforced by the API. The demo uses the 12 countries and
6 sectors in the supplied challenge dataset, not a worldwide country list.

Optional `cpi_references` entries have `country`, `reference_year`, `score`, `source`
(a verifiable citation) and `available_from` (ISO publication date). Supply only vetted
references; no references means an explicit missing CPI, handled by the pipeline.
The server selects the latest reference available on or before the first day of the
approval month. This conservative cutoff avoids using information published later.
Training must use the same lookup semantics; never compute reference values from the
entire training/test dataset. A country is not assigned one timeless CPI score.
Automatic requests send `cpi_mode: "auto", cpi_score: null`; manual overrides send
`cpi_mode: "manual"` and a score. Results report the actual score and provenance.

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

## Schritt für Schritt: dein trainiertes Modell einbinden

Es gibt zwei Vorhersagen und deshalb zwei gespeicherte Pipelines. Eine Pipeline enthält
das Modell **und** seine Datenaufbereitung (z. B. Umgang mit fehlendem CPI und Umwandlung
der Ländernamen in Zahlen). So bekommt das Modell im Betrieb dieselben Eingaben wie im
Training. Die bereits implementierte API lädt beide Dateien beim Start.

1. Trainiere die Erfolgspipeline mit den sechs oben genannten Spalten und den Zielwerten
   `0` (nicht erfolgreich) und `1` (erfolgreich). Sie muss `predict_proba` unterstützen,
   zum Beispiel bei einer logistischen Regression.
2. Trainiere die Kostenpipeline auf die **relative Kostenabweichung**, nicht den
   Dollarbetrag. Das Ziel ist `(Final_Cost_USD - Initial_Budget_USD) / Initial_Budget_USD`.
   Nutze z. B. eine lineare Regression; positive Werte bedeuten Mehrkosten.
3. Prüfe beide Pipelines an zurückgehaltenen Daten. Speichere dann die vollständigen
   trainierten Pipelines aus deinem Trainingsskript oder Notebook:

   ```python
   from pathlib import Path
   import joblib

   output = Path("models")
   output.mkdir(exist_ok=True)
   # Beide Variablen müssen bereits vollständig trainierte sklearn-Pipelines sein.
   joblib.dump(success_pipeline, output / "success_pipeline.joblib")
   joblib.dump(cost_pipeline, output / "cost_pipeline.joblib")
   ```

4. Lege daneben die `manifest.json` nach dem Schema oben ab. Das ist der Steckbrief des
   Modells: Version, echte Trainingsbereiche, Länder, Sektoren, gemessene Testkennzahlen
   und Aussagegrenzen. Länder und Sektoren müssen aus dem Training stammen und außerdem
   im aktuell unterstützten API-Katalog enthalten sein (`backend/schemas.py`). Die
   Länderauswahl passt sich nach dem Neustart automatisch an diesen Steckbrief an.
5. Starte zunächst lokal mit dem vorhandenen Image:

   ```sh
   docker run --rm -p 127.0.0.1:8080:8000 \
     -e MODEL_MODE=model -e MODEL_DIR=/models \
     --mount type=bind,src="$(pwd)/models",dst=/models,readonly \
     docker.io/sgesang/aid-project-risk-screening:main
   ```

   `/api/model-info` muss `mode: "model"`, `ready: true` und deine Modellversion
   zurückgeben. Prüfe außerdem einen bekannten Testfall über das Formular und vergleiche
   seine Ergebnisse mit den Pipeline-Ausgaben im Notebook. `health` allein reicht nicht.

6. Für Proxmox kopierst du den Modellordner **in LXC 114**, beispielsweise nach
   `/opt/aid-project-risk-screening/models`. Er muss für den Containerbenutzer UID 10001
   lesbar sein (Ordner durchsuchbar, Dateien lesbar). Im Quadlet
   `/etc/containers/systemd/aid-project-risk-screening.container` ersetzt du den bisherigen
   `MODEL_MODE`-Eintrag und ergänzt unter `[Container]`:

   ```ini
   Environment=MODEL_MODE=model
   Environment=MODEL_DIR=/models
   Volume=/opt/aid-project-risk-screening/models:/models:ro
   ```

   Danach **innerhalb LXC 114**:

   ```sh
   systemctl daemon-reload
   systemctl restart aid-project-risk-screening.service
   curl --fail http://192.168.68.194:4175/api/model-info
   ```

   Prüfe anschließend auch `https://aid.samuelgesang.de/api/model-info` und eine
   Formularübermittlung. Im Modellmodus entfallen die Beispielkennzeichnungen automatisch.
   Die Modelldateien liegen außerhalb des Images und bleiben bei automatischen
   Image-Updates erhalten. Python und sklearn müssen zu den Versionen des Trainings
   passen; nutze dafür die eingecheckte `uv.lock`.

Ein automatischer CPI benötigt geprüfte `cpi_references` im Steckbrief. Ohne sie bleibt
der CPI ausdrücklich fehlend; die trainierte Pipeline muss dies verarbeiten können.
Keine Modellartefakte oder Rohdaten in das öffentliche GitHub-Repository hochladen.
