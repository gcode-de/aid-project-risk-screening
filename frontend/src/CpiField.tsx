import { useEffect, useState } from "react";
import { type CpiSelection, request } from "./api";

export default function CpiField({
  country,
  year,
  month,
}: {
  country: string;
  year: number;
  month: number;
}) {
  const [manual, setManual] = useState(false);
  const [reference, setReference] = useState<CpiSelection | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      country,
      approval_year: String(year),
      approval_month: String(month),
    });
    request<CpiSelection>(`/cpi-reference?${query}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then((value) => {
        if (!controller.signal.aborted) setReference(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [country, year, month]);
  return (
    <div className="wide cpi-field">
      <input type="hidden" name="cpi_mode" value={manual ? "manual" : "auto"} />
      <p className="cpi-title">CPI · Länderreferenz</p>
      {!manual && (
        <p className="help" role="status">
          {error
            ? "Referenz konnte nicht geladen werden. Bei der Prüfung wird sie erneut ermittelt."
            : reference?.score != null
              ? `CPI ${reference.score} · Referenzjahr ${reference.reference_year} · ${reference.source}`
              : reference
                ? "Keine geprüfte CPI-Referenz verfügbar. Die Prüfung ist auch ohne CPI möglich."
                : year >= 2000 && year <= 2100
                  ? "Länderreferenz wird geprüft …"
                  : "Bitte ein gültiges Genehmigungsjahr eingeben."}
        </p>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={manual}
          onChange={(event) => setManual(event.target.checked)}
        />
        CPI manuell eingeben
      </label>
      {manual && (
        <label>
          CPI-Wert <span className="unit">0–100</span>
          <input
            name="cpi"
            type="number"
            min="0"
            max="100"
            step="0.1"
            required
            aria-describedby="cpi-help"
          />
        </label>
      )}
      <p id="cpi-help" className="help">
        Korruptionswahrnehmungsindex: höhere Werte bedeuten weniger wahrgenommene Korruption. Kein
        Urteil über ein einzelnes Projekt. Automatisch werden nur vor dem Genehmigungsmonat
        verfügbare Referenzen genutzt.
      </p>
    </div>
  );
}
