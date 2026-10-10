import type { Prediction } from "./api";

const percent = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });
const dollars = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function ResultPanel({ result }: { result: Prediction | null }) {
  if (!result)
    return (
      <section className="empty-state" aria-label="Noch kein Ergebnis">
        <svg
          className="empty-symbol"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M5 20V4M5 20h15M9 16v-5M13 16V7M17 16v-8" />
        </svg>
        <h2>Ergebnisse</h2>
        <p>
          Projektdaten eingeben und „Projekt prüfen“ wählen. Hier erscheinen die Schätzungen und
          Prüfhinweise.
        </p>
      </section>
    );
  const change = result.estimates.expected_cost_change_ratio;
  return (
    <section className="results" aria-label="Prüfergebnis">
      <div className="section-heading">
        <div>
          <h2>Prüfergebnis</h2>
        </div>
        <span className="badge">
          {result.mode === "demo" ? "Beispielausgabe" : "Modellschätzung"}
        </span>
      </div>
      {result.mode === "demo" && (
        <p className="demo-result">Feste Demonstrationswerte. Keine trainierte Vorhersage.</p>
      )}
      <div className="metric-grid">
        <div className="metric">
          <p>Erfolgswahrscheinlichkeit</p>
          <strong>{percent.format(result.estimates.success_probability)}</strong>
          <span>
            {result.mode === "demo"
              ? "Illustrativer Beispielwert"
              : "Für das dokumentierte Erfolgslabel"}
          </span>
        </div>
        <div className="metric">
          <p>Erwartete Kostenabweichung</p>
          <strong>
            {change > 0 ? "+" : ""}
            {percent.format(change)}
          </strong>
          <span>{change >= 0 ? "Über" : "Unter"} dem ursprünglichen Budget</span>
        </div>
      </div>
      <div className="cost-total">
        <span>{change >= 0 ? "Entsprechende Mehrkosten" : "Entsprechende Minderkosten"}</span>
        <strong>{dollars.format(Math.abs(result.expected_cost_change_usd))}</strong>
      </div>
      <div className="notes-header">
        <h3>Prüfhinweise</h3>
        <span>Regelbasiert</span>
      </div>
      <p className="help">
        Diese Hinweise sind keine Erklärung der Modellgewichtung und kein Nachweis eines
        Fehlverhaltens.
      </p>
      {result.notes.length ? (
        <ul className="notes">
          {result.notes.map((note, index) => (
            <li key={note.code}>
              <span className="note-number">0{index + 1}</span>
              <div>
                <h4>{note.title}</h4>
                <p>{note.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-notes">
          Keine der hinterlegten Prüfregeln trifft zu. Das ist keine Unbedenklichkeitsbescheinigung.
        </p>
      )}
      <details className="limitations">
        <summary>Modellstand und Aussagegrenzen</summary>
        <p>Version: {result.model_version}</p>
        <p>
          Verwendeter CPI: {result.cpi.score ?? "nicht verfügbar"}
          {result.cpi.mode === "manual"
            ? " · manuell eingegeben"
            : result.cpi.reference_year
              ? ` · Referenzjahr ${result.cpi.reference_year}`
              : ""}
          {result.cpi.source ? ` · ${result.cpi.source}` : ""}
        </p>
        <ul>
          {result.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
