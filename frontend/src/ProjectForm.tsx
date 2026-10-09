import { useState } from "react";
import type { Options, ProjectInput } from "./api";

const months = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

type Props = {
  options: Options;
  busy: boolean;
  ready: boolean;
  onSubmit: (project: ProjectInput) => void;
  onChange: () => void;
};

export default function ProjectForm({ options, busy, ready, onSubmit, onChange }: Props) {
  const [missingCpi, setMissingCpi] = useState(false);
  return (
    <form
      onChange={onChange}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit({
          country: String(data.get("country")) as ProjectInput["country"],
          sector_code: Number(data.get("sector")) as ProjectInput["sector_code"],
          initial_budget_usd: Number(data.get("budget")),
          cpi_score: missingCpi ? null : Number(data.get("cpi")),
          approval_month: Number(data.get("month")),
          approval_year: Number(data.get("year")),
        });
      }}
    >
      <fieldset disabled={busy || !ready}>
        <legend className="sr-only">Projektdaten</legend>
        <div className="fields">
          <label>
            Empfängerland
            <select name="country" defaultValue="Kenya">
              {options.countries.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
          </label>
          <label>
            Sektor
            <select name="sector" defaultValue="12230">
              {Object.entries(options.sectors).map(([code, label]) => (
                <option value={code} key={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Bewilligtes Budget <span className="unit">USD</span>
            <input
              name="budget"
              type="number"
              min="0.01"
              max="1000000000000"
              step="0.01"
              defaultValue="500000"
              required
            />
            <span className="help">
              Ursprünglich bewilligter Betrag, ohne spätere Nachfinanzierung.
            </span>
          </label>
          <div className="wide cpi-field">
            <label htmlFor="cpi">
              CPI-Wert <span className="unit">0–100</span>
            </label>
            <input
              id="cpi"
              name="cpi"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue="32"
              required={!missingCpi}
              disabled={missingCpi}
              aria-describedby="cpi-help"
            />
            <label className="checkbox">
              <input
                type="checkbox"
                checked={missingCpi}
                onChange={(event) => setMissingCpi(event.target.checked)}
              />{" "}
              Wert nicht verfügbar
            </label>
            <p id="cpi-help" className="help">
              Korruptionswahrnehmungsindex: höhere Werte bedeuten weniger wahrgenommene Korruption.
              Kein Urteil über ein einzelnes Projekt.
            </p>
          </div>
          <label>
            Genehmigungsmonat
            <select name="month" defaultValue="12">
              {months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <label>
            Genehmigungsjahr
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              step="1"
              defaultValue="2024"
              required
            />
          </label>
        </div>
        <button className="primary" type="submit">
          {busy ? "Prüfung läuft …" : "Projekt prüfen"}
          <span aria-hidden="true">↗</span>
        </button>
      </fieldset>
      <p className="form-footnote">Eingaben werden nicht gespeichert.</p>
    </form>
  );
}
