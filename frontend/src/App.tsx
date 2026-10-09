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
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Aid Portfolio Startseite">
          <span className="brand-mark" aria-hidden="true">
            a<span>.</span>
          </span>
          <span>
            AID
            <br />
            <b>PORTFOLIO</b>
          </span>
        </a>
        <p className="nav-label">ARBEITSBEREICH</p>
        <div className="nav-active">
          <span aria-hidden="true">▦</span> Projektprüfung <span className="nav-dot" />
        </div>
        <div className="sidebar-bottom">
          <span className="sidebar-line" />
          <p>
            Gute Entscheidungen
            <br />
            beginnen mit guten Fragen.
          </p>
          <span>ANALYTICS / PROTOTYPE</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Portfolio <span className="crumb">/</span> <strong>Projektprüfung</strong>
          </span>
          <span className="top-status">
            <i /> {setup?.info.mode === "model" ? "Modell verbunden" : "Präsentationsprototyp"}
          </span>
        </header>
        <main id="main">
          <div className="page-title">
            <div>
              <p className="eyebrow">PROJECT RISK SCREENING</p>
              <h1>
                Projekte verstehen.
                <br />
                <span>Prüfungen fokussieren.</span>
              </h1>
              <p className="intro">
                Eine nachvollziehbare Grundlage für die nächste fachliche Prüfung.
              </p>
            </div>
            <span className="version-tag">POC / 01</span>
          </div>
          {setup?.info.mode === "demo" && (
            <div className="mode-banner">
              <span className="banner-icon" aria-hidden="true">
                i
              </span>
              <div>
                <strong>Demonstrationsmodus</strong>
                <p>
                  Die Oberfläche ist funktionsfähig. Angezeigte Schätzungen sind feste Beispielwerte
                  – ein trainiertes Modell folgt.
                </p>
              </div>
              <span className="badge">DEMO</span>
            </div>
          )}
          {setup && !setup.info.ready && (
            <div className="mode-banner">
              <div>
                <strong>Modell noch nicht eingebunden</strong>
                <p>
                  Die API ist erreichbar. Für Vorhersagen muss ein validiertes Modell geladen oder
                  der Demo-Modus ausdrücklich aktiviert werden.
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
                    <p className="eyebrow">01 / PROJEKTDATEN</p>
                    <h2>Projekt erfassen</h2>
                  </div>
                  <span className="small-symbol" aria-hidden="true">
                    ↗
                  </span>
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
          <footer>
            <span>Für eine fundierte Prüfung. Die Verantwortung bleibt beim Menschen.</span>
            <span>REACT + FASTAPI</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
