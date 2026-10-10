import { useEffect, useState } from "react";
import { type ModelInfo, type Options, type Prediction, type ProjectInput, request } from "./api";
import ProjectForm from "./ProjectForm";
import ResultPanel from "./ResultPanel";

export default function App() {
  const [setup, setSetup] = useState<{ info: ModelInfo; options: Options } | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

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
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await request<Prediction>("/predict", { method: "POST", body: JSON.stringify(project) }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Die Prüfung ist fehlgeschlagen.");
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
          {setup && (
            <span className="badge">
              {setup.info.mode === "model" ? "Modellschätzung" : "Prototyp"}
            </span>
          )}
        </div>
        {setup && !setup.info.ready && (
          <div className="mode-banner">
            <div>
              <strong>Modell noch nicht eingebunden</strong>
              <p>
                Die API ist erreichbar. Für Vorhersagen muss ein validiertes Modell geladen oder der
                Demo-Modus ausdrücklich aktiviert werden.
              </p>
            </div>
          </div>
        )}
        {error && (
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
                busy={busy}
                ready={setup.info.ready}
                onSubmit={predict}
                onChange={() => {
                  setResult(null);
                  setError(null);
                }}
              />
            </section>
            <div aria-live="polite" aria-busy={busy}>
              <ResultPanel result={result} />
            </div>
          </div>
        )}
        {setup && (
          <section className="context-info" aria-label="Einordnung">
            <h2>{setup.info.mode === "demo" ? "Demonstrationsmodus" : "Einordnung"}</h2>
            <p>
              {setup.info.mode === "demo"
                ? "Die Schätzungen sind feste Beispielwerte; ein trainiertes Modell ist noch nicht eingebunden. "
                : "Die Schätzungen unterstützen die fachliche Prüfung. "}
              Prüfhinweise dienen zur Priorisierung und belegen kein Fehlverhalten.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
