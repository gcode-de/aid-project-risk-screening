import { useEffect, useState } from "react";
import {
  FieldError,
  type ModelInfo,
  type Options,
  type Prediction,
  type ProjectInput,
  request,
} from "./api";
import ProjectForm from "./ProjectForm";
import ResultPanel from "./ResultPanel";

export default function App() {
  const [setup, setSetup] = useState<{ info: ModelInfo; options: Options } | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [submitted, setSubmitted] = useState<ProjectInput | null>(null);
  const [changed, setChanged] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload deliberately retries the same request.
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setError(null);
    Promise.all([
      request<ModelInfo>("/model-info", { signal }),
      request<Options>("/options", { signal }),
    ])
      .then(([info, options]) => setSetup({ info, options }))
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Die Verbindung zum Backend ist nicht verfügbar. Bitte erneut versuchen.");
      });
    return () => controller.abort();
  }, [reload]);

  async function predict(project: ProjectInput) {
    setFieldErrors([]);
    setSubmitted(project);
    setChanged(false);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await request<Prediction>("/predict", { method: "POST", body: JSON.stringify(project) }),
      );
    } catch (error) {
      if (error instanceof FieldError) setFieldErrors(error.fields);
      const name = error && typeof error === "object" && "name" in error ? error.name : "";
      setError(
        name === "TimeoutError"
          ? "Das Zeitlimit der Prüfung wurde erreicht. Eingaben bleiben erhalten. Bitte erneut versuchen."
          : name === "AbortError"
            ? "Die Prüfung wurde abgebrochen. Eingaben bleiben erhalten. Bitte erneut versuchen."
            : error instanceof TypeError
              ? "Die Verbindung zum Backend ist unterbrochen. Eingaben bleiben erhalten. Bitte erneut versuchen."
              : error instanceof Error
                ? error.message
                : "Die Prüfung ist fehlgeschlagen. Eingaben bleiben erhalten. Bitte erneut versuchen.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Zum Inhalt
      </a>
      <main id="main">
        <div className="page-title">
          <h1>Projektprüfung</h1>
          {setup && setup.info.mode !== "model" && (
            <span className="badge">
              {setup.info.mode === "demo" ? "Demo · feste Werte" : "Nicht verfügbar"}
            </span>
          )}
        </div>
        {setup?.info.mode === "demo" && (
          <div className="mode-banner">
            <div>
              <strong>Demonstration · keine trainierte Vorhersage</strong>
              <p>
                64 % und +18 % sind feste Beispielwerte. Eingaben verändern nur Dollarbetrag und
                regelbasierte Prüfhinweise.
              </p>
            </div>
          </div>
        )}
        {setup && !setup.info.ready && (
          <div className="mode-banner">
            <div>
              <strong>Modell noch nicht eingebunden</strong>
              <p>
                Die API ist erreichbar. Für Vorhersagen muss ein validiertes Modell geladen werden.
              </p>
            </div>
          </div>
        )}
        {error && !setup && (
          <div className="error" role="alert">
            <p>{error}</p>
            {!setup && (
              <button type="button" onClick={() => setReload((value) => value + 1)}>
                Verbindung erneut prüfen
              </button>
            )}
          </div>
        )}
        {!setup && !error && <p role="status">Arbeitsbereich wird geladen …</p>}
        {setup && (
          <div className="screening-grid">
            <section className="form-panel">
              <div className="section-heading">
                <div>
                  <h2>Projekt erfassen</h2>
                </div>
              </div>
              <ProjectForm
                options={setup.options}
                demo={setup.info.mode === "demo"}
                busy={busy}
                ready={setup.info.ready}
                fieldErrors={fieldErrors}
                onSubmit={predict}
                onChange={() => {
                  setFieldErrors([]);
                  setChanged(true);
                  setResult(null);
                  setError(null);
                }}
              />
              {error && (
                <div className="error" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submitted && predict(submitted)}
                  >
                    Prüfung wiederholen
                  </button>
                </div>
              )}
              <p role="status" className="sr-only">
                {busy
                  ? "Prüfung läuft. Bitte warten …"
                  : result
                    ? "Ergebnis aktualisiert."
                    : changed
                      ? "Eingaben geändert. Bitte erneut prüfen."
                      : ""}
              </p>
            </section>
            <div aria-busy={busy}>
              <ResultPanel
                result={result}
                project={submitted}
                sectors={setup.options.sectors}
                info={setup.info}
                state={busy ? "running" : error ? "error" : changed ? "changed" : "idle"}
              />
            </div>
          </div>
        )}
        {setup && (
          <section className="context-info" aria-label="Einordnung">
            <h2>Einordnung</h2>
            <p>
              Die Schätzungen unterstützen die fachliche Prüfung. Prüfhinweise helfen, die nächsten
              Schritte zu priorisieren.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
