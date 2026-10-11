import type { ModelInfo, Prediction, ProjectInput } from "./api";

const percent = new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 0 });
const dollars = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("de-DE", { maximumSignificantDigits: 6 });

type Props = {
  result: Prediction | null;
  state?: "idle" | "running" | "changed" | "error";
  project?: ProjectInput | null;
  sectors?: Record<string, string>;
  info?: ModelInfo;
};

export default function ResultPanel({
  result,
  state = "idle",
  project,
  sectors = {},
  info,
}: Props) {
  if (!result) {
    const titles = {
      idle: "Ergebnisse",
      running: "Prüfung läuft",
      changed: "Eingaben geändert",
      error: "Prüfung fehlgeschlagen",
    };
    const descriptions = {
      idle: "Projektdaten eingeben und die Prüfung starten. Hier erscheinen die Schätzungen und Prüfhinweise.",
      running: "Bitte warten. Die Prüfung wird ausgeführt; noch kein Ergebnis verfügbar.",
      changed: "Die bisherige Aussage ist nicht mehr gültig. Bitte erneut prüfen.",
      error:
        "Kein Ergebnis verfügbar. Eingaben bleiben erhalten; bitte den Fehler beim Formular prüfen und erneut versuchen.",
    };
    return (
      <section
        className="empty-state"
        aria-label={state === "idle" ? "Noch kein Ergebnis" : titles[state]}
      >
        <h2>{titles[state]}</h2>
        <p>{descriptions[state]}</p>
      </section>
    );
  }
  const change = result.estimates.expected_cost_change_ratio;
  const cpi = `${result.cpi.score ?? "nicht verfügbar"}${result.cpi.mode === "manual" ? " · manuell eingegeben, keine geprüfte Quellenreferenz" : ` · automatisch${result.cpi.reference_year ? ` · Referenzjahr ${result.cpi.reference_year}` : ""}${result.cpi.source ? ` · ${result.cpi.source}` : " · Quellenreferenz nicht verfügbar"}`}`;
  const outsideYears =
    project &&
    info?.training_year_min != null &&
    info.training_year_max != null &&
    (project.approval_year < info.training_year_min ||
      project.approval_year > info.training_year_max);
  return (
    <section className="results" aria-label="Prüfergebnis">
      <div className="section-heading">
        <h2 id="result-heading" tabIndex={-1}>
          Prüfergebnis
        </h2>
        <span className="badge">
          {result.mode === "demo" ? "Beispielausgabe" : "Modellschätzung"}
        </span>
      </div>
      {result.mode === "demo" && (
        <p className="demo-result">Feste Demonstrationswerte. Keine trainierte Vorhersage.</p>
      )}
      {project && (
        <section className="input-summary" aria-label="Eingegebene Grundlage">
          <h3>Eingegebene Grundlage</h3>
          <dl>
            <dt>Empfängerland</dt>
            <dd>{project.country}</dd>
            <dt>Sektor</dt>
            <dd>
              {sectors[project.sector_code] ?? "Sektorcode"} ({project.sector_code})
            </dd>
            <dt>Bewilligtes Budget</dt>
            <dd>{new Intl.NumberFormat("de-DE").format(project.initial_budget_usd)} USD</dd>
            <dt>Genehmigung</dt>
            <dd>
              {new Intl.DateTimeFormat("de-DE", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(project.approval_year, project.approval_month - 1, 1)))}
            </dd>
            <dt>Verwendeter CPI (0–100)</dt>
            <dd>{cpi}</dd>
          </dl>
        </section>
      )}
      <div className="metric-grid">
        <div className="metric">
          <p>Erfolgswahrscheinlichkeit</p>
          <strong>{percent.format(result.estimates.success_probability)}</strong>
          <span>
            {result.mode === "demo"
              ? "Illustrativer Beispielwert"
              : "Wahrscheinlichkeit für das Erfolgslabel des eingebundenen Modells"}
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
      <p className="help">
        Kostenabweichung = (Endkosten − bewilligtes Budget) / bewilligtes Budget. Der Dollarbetrag
        entspricht dieser Abweichung × bewilligtes Budget, nicht den Gesamtkosten.
      </p>
      <p className="help">
        Unsicherheit / Konfidenzintervall: nicht verfügbar. Die Erfolgswahrscheinlichkeit ist kein
        Gesamtrisikoscore.
      </p>
      {result.mode === "model" && (
        <section className="model-context" aria-label="Modellgrundlage und Aussagegrenzen">
          <h3>Modellgrundlage und Aussagegrenzen</h3>
          <p>Version: {result.model_version}</p>
          {info?.success_definition && info.evaluation_horizon ? (
            <>
              <p>Erfolgsdefinition: {info.success_definition}</p>
              <p>Bewertungshorizont: {info.evaluation_horizon}</p>
            </>
          ) : (
            <p>
              Erfolgsdefinition und Bewertungshorizont: nicht verfügbar oder unvollständig. Vor
              einer fachlichen Verwendung vom Modellverantwortlichen bestätigen lassen.
            </p>
          )}
          {info?.model_card_url && /^https?:\/\//i.test(info.model_card_url) ? (
            <a href={info.model_card_url} target="_blank" rel="noopener noreferrer">
              Modellkarte öffnen
            </a>
          ) : (
            <p>Modellkarte: nicht verfügbar.</p>
          )}
          <p>
            Trainingszeitraum:{" "}
            {info?.training_year_min != null && info.training_year_max != null
              ? `${info.training_year_min}–${info.training_year_max}`
              : "nicht verfügbar"}
          </p>
          {outsideYears && (
            <p className="field-error">
              Genehmigungsjahr außerhalb des Trainingszeitraums. Übertragbarkeit nicht nachgewiesen.
            </p>
          )}
          <p>
            Validierungskennzahlen (vom Backend geliefert, keine projektbezogene Sicherheit):{" "}
            {info && Object.keys(info.metrics ?? {}).length
              ? Object.entries(info.metrics ?? {})
                  .map(([key, value]) => `${key}: ${number.format(value)}`)
                  .join(" · ")
              : "nicht verfügbar"}
          </p>
          <ul>
            {Array.from(new Set([...result.limitations, ...(info?.limitations ?? [])])).map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </section>
      )}
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
              <span className="note-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h4>{note.title}</h4>
                <dl className="rule-detail">
                  <dt>Auslöser</dt>
                  <dd>
                    {note.trigger ??
                      "Auslöser nicht von der API geliefert; Regelbeschreibung fachlich prüfen."}
                  </dd>
                  <dt>Bedeutung</dt>
                  <dd>{note.meaning ?? note.detail}</dd>
                  <dt>Grenze</dt>
                  <dd>
                    {note.limits ??
                      "Kein Nachweis von Fehlverhalten; keine Erklärung der Modellgewichtung."}
                  </dd>
                  <dt>Nächster Prüfschritt</dt>
                  <dd>
                    {note.next_step ??
                      "Regelbeschreibung mit den Projektunterlagen abgleichen; fehlende Nachweise dokumentieren."}
                  </dd>
                </dl>
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
        <p>Verwendeter CPI: {cpi}</p>
        <ul>
          {result.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
