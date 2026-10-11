import { useEffect, useRef, useState } from "react";
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
  demo?: boolean;
  fieldErrors?: string[];
  onSubmit: (project: ProjectInput) => void;
  onChange: () => void;
};

export default function ProjectForm({
  options,
  busy,
  ready,
  demo = false,
  fieldErrors = [],
  onSubmit,
  onChange,
}: Props) {
  const [country, setCountry] = useState(
    options.countries.includes("Kenya") ? "Kenya" : options.countries[0],
  );
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(12);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const names: Record<string, string> = {
      country: "country",
      sector_code: "sector",
      initial_budget_usd: "budget",
      approval_month: "month",
      approval_year: "year",
      cpi_score: "cpi",
      cpi_mode: "cpi_mode",
    };
    if (fieldErrors.length)
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${names[fieldErrors[0]] || "budget"}"]`)
        ?.focus();
  }, [fieldErrors]);
  const invalid = (field: string) => fieldErrors.includes(field) || undefined;
  return (
    <form
      ref={formRef}
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
      <p className="help">
        Vorgefüllte Daten sind ein Beispielprojekt. Bitte durch eigene Projektdaten ersetzen.
      </p>
      <fieldset disabled={busy || !ready}>
        <legend className="sr-only">Projektdaten</legend>
        <div className="fields">
          <label>
            <span id="country-label">Empfängerland</span>
            <select
              name="country"
              aria-labelledby="country-label"
              aria-invalid={invalid("country")}
              aria-describedby={invalid("country") ? "country-error" : undefined}
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            >
              {options.countries.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
            {invalid("country") && (
              <span id="country-error" className="field-error">
                Bitte ein gültiges Empfängerland wählen.
              </span>
            )}
          </label>
          <label>
            <span id="sector-label">Sektor</span>
            <select
              name="sector"
              aria-labelledby="sector-label"
              aria-invalid={invalid("sector_code")}
              aria-describedby={invalid("sector_code") ? "sector-error" : undefined}
              defaultValue={12230 in options.sectors ? "12230" : Object.keys(options.sectors)[0]}
            >
              {Object.entries(options.sectors).map(([code, label]) => (
                <option value={code} key={code}>
                  {label}
                </option>
              ))}
            </select>
            {invalid("sector_code") && (
              <span id="sector-error" className="field-error">
                Bitte einen gültigen Sektor wählen.
              </span>
            )}
          </label>
          <label className="wide">
            Bewilligtes Budget <span className="unit">USD</span>
            <input
              name="budget"
              aria-invalid={invalid("initial_budget_usd")}
              aria-describedby={
                invalid("initial_budget_usd") ? "budget-help budget-error" : "budget-help"
              }
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000000000000"
              step="0.01"
              defaultValue="500000"
              required
            />
            {invalid("initial_budget_usd") && (
              <span id="budget-error" className="field-error">
                Bitte einen gültigen Budgetbetrag in USD eingeben.
              </span>
            )}
            <span id="budget-help" className="help">
              Ursprünglich bewilligter Betrag, ohne spätere Nachfinanzierung.
            </span>
          </label>
          <label>
            <span id="month-label">Genehmigungsmonat</span>
            <select
              name="month"
              aria-labelledby="month-label"
              aria-invalid={invalid("approval_month")}
              aria-describedby={invalid("approval_month") ? "month-error" : undefined}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {months.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            {invalid("approval_month") && (
              <span id="month-error" className="field-error">
                Bitte einen gültigen Genehmigungsmonat wählen.
              </span>
            )}
          </label>
          <label>
            <span id="year-label">Genehmigungsjahr</span>
            <input
              name="year"
              aria-labelledby="year-label"
              aria-invalid={invalid("approval_year")}
              aria-describedby={invalid("approval_year") ? "year-error" : undefined}
              type="number"
              inputMode="numeric"
              min="2000"
              max="2100"
              step="1"
              value={year || ""}
              onChange={(event) => setYear(Number(event.target.value))}
              required
            />
            {invalid("approval_year") && (
              <span id="year-error" className="field-error">
                Bitte ein Jahr zwischen 2000 und 2100 eingeben.
              </span>
            )}
          </label>
          <CpiField
            country={country}
            year={year}
            month={month}
            invalid={Boolean(invalid("cpi_score") || invalid("cpi_mode"))}
          />
        </div>
        <button className="primary" type="submit">
          {busy ? "Prüfung läuft …" : demo ? "Beispiel prüfen" : "Projekt prüfen"}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
      </fieldset>
      <p className="form-footnote">Eingaben werden nicht gespeichert.</p>
    </form>
  );
}
