import { useState } from "react";
import type { Options, ProjectInput } from "./api";
import CpiField from "./CpiField";

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
  const [country, setCountry] = useState(
    options.countries.includes("Kenya") ? "Kenya" : options.countries[0],
  );
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(12);
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
          cpi_mode: data.get("cpi_mode") === "manual" ? "manual" : "auto",
          cpi_score: data.get("cpi_mode") === "manual" ? Number(data.get("cpi")) : null,
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
            <select
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {options.countries.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
          </label>
          <label>
            Sektor
            <select
              name="sector"
              defaultValue={12230 in options.sectors ? "12230" : Object.keys(options.sectors)[0]}
            >
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
          <label>
            Genehmigungsmonat
            <select
              name="month"
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
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
              value={year || ""}
              onChange={(event) => setYear(Number(event.target.value))}
              required
            />
          </label>
          <CpiField
            key={`${country}:${year}:${month}`}
            country={country}
            year={year}
            month={month}
          />
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
