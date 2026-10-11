import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { ModelInfo, Prediction, ProjectInput } from "./api";
import ResultPanel from "./ResultPanel";

const project: ProjectInput = {
  country: "Kenya",
  sector_code: 12230,
  initial_budget_usd: 500000,
  approval_year: 2024,
  approval_month: 12,
  cpi_mode: "auto",
  cpi_score: null,
};
const result: Prediction = {
  mode: "demo",
  model_version: "demo-fixture-v1",
  cpi: { mode: "auto", score: 31, reference_year: 2023, source: "Verified test source" },
  estimates: { success_probability: 0.64, expected_cost_change_ratio: 0.18 },
  expected_cost_change_usd: 90000,
  notes: [],
  limitations: ["Keine automatische Förderentscheidung."],
};
const info: ModelInfo = {
  mode: "model",
  version: "test-model",
  ready: true,
  metrics: { success_brier_score: 0.12 },
  training_year_min: 2005,
  training_year_max: 2022,
  limitations: ["Test-only measured limitation."],
};

it("ties results to the submitted input and visible CPI provenance", () => {
  render(
    <ResultPanel
      result={result}
      project={project}
      sectors={{ 12230: "Infrastruktur" }}
      info={info}
    />,
  );
  const summary = screen.getByRole("region", { name: "Eingegebene Grundlage" });
  for (const value of [
    "Kenya",
    "Infrastruktur (12230)",
    /500.000.*USD/,
    "Dezember 2024",
    /31.*Referenzjahr 2023.*Verified test source/,
  ]) {
    expect(within(summary).getByText(value)).toBeVisible();
  }
  expect(
    screen.getByText(/\(Endkosten − bewilligtes Budget\) \/ bewilligtes Budget/),
  ).toBeVisible();
  expect(screen.getByText(/Unsicherheit.*nicht verfügbar/)).toBeVisible();
});

it("keeps real-model coverage and absent definitions honest and visible", () => {
  render(<ResultPanel result={{ ...result, mode: "model" }} project={project} info={info} />);
  expect(screen.getByText(/Trainingszeitraum: 2005–2022/)).toBeVisible();
  expect(screen.getByText(/Genehmigungsjahr außerhalb/)).toBeVisible();
  expect(
    screen.getByText(/Erfolgsdefinition und Bewertungshorizont.*nicht verfügbar/),
  ).toBeVisible();
  expect(screen.getByText(/Modellkarte.*nicht verfügbar/)).toBeVisible();
  expect(screen.getByText(/success_brier_score: 0,12/)).toBeVisible();
  expect(screen.getByText("Test-only measured limitation.")).toBeVisible();
});

it("shows server-supplied approved metadata without invented validation or unsafe links", () => {
  render(
    <ResultPanel
      result={{ ...result, mode: "model" }}
      project={project}
      info={{
        ...info,
        success_definition: "Approved test label",
        evaluation_horizon: "Approved test horizon",
        model_card_url: "https://example.org/model-card",
      }}
    />,
  );
  expect(screen.getByText(/Approved test label/)).toBeVisible();
  expect(screen.getByText(/Approved test horizon/)).toBeVisible();
  expect(screen.getByRole("link", { name: "Modellkarte öffnen" })).toHaveAttribute(
    "href",
    "https://example.org/model-card",
  );
});

it("renders the stale-CPI note captured from the synthetic FastAPI response", () => {
  // TestClient: Kenya, reference 2020, approval December 2024, dummy model.
  const note = {
    code: "stale-cpi",
    title: "Ältere CPI-Referenz",
    detail: "Die Referenz ist über zwei Jahre alt. Ihre Aussagekraft fachlich prüfen.",
    trigger: "CPI-Referenzjahr: 2020; Genehmigungsjahr: 2024; Abstand: 4 Jahre (über zwei Jahre).",
    meaning:
      "Die verwendete Länderreferenz liegt zeitlich weiter vom Genehmigungsjahr entfernt; ihre Aussagekraft fachlich prüfen.",
    limits:
      "Eine ältere Länderreferenz belegt weder projektspezifisches Risiko noch Fehlverhalten und erklärt nicht die Modellgewichtung.",
    next_step:
      "Referenzquelle und Veröffentlichungsdatum prüfen; eine neuere, vor dem Genehmigungsmonat veröffentlichte Länderreferenz suchen oder das Fehlen geeigneter Daten dokumentieren.",
  };
  render(
    <ResultPanel
      result={{
        ...result,
        mode: "model",
        cpi: {
          mode: "auto",
          score: 31,
          reference_year: 2020,
          source: "Synthetic test reference, not official",
        },
        notes: [note],
      }}
      project={project}
      info={info}
    />,
  );
  for (const text of [note.trigger, note.meaning, note.limits, note.next_step]) {
    expect(screen.getByText(text)).toBeVisible();
  }
  expect(screen.queryByText(/Auslöser nicht von der API geliefert/)).not.toBeInTheDocument();
});

it("renders structured rule evidence and a legacy fallback without inventing triggers", () => {
  render(
    <ResultPanel
      result={{
        ...result,
        notes: [
          {
            code: "test",
            title: "Test rule",
            detail: "Legacy explanation",
            trigger: "Exact input",
            meaning: "Review meaning",
            limits: "No evidence of misconduct",
            next_step: "Check document",
          },
          { code: "legacy", title: "Legacy rule", detail: "Legacy-only detail" },
        ],
      }}
      project={project}
    />,
  );
  expect(screen.getByText("Exact input")).toBeVisible();
  expect(screen.getByText("Check document")).toBeVisible();
  expect(screen.getByText("No evidence of misconduct")).toBeVisible();
  expect(screen.getByText(/Auslöser nicht von der API geliefert/)).toBeVisible();
  expect(screen.getByText("Legacy-only detail")).toBeVisible();
  expect(
    screen.getByText(/Diese Hinweise sind keine Erklärung der Modellgewichtung/),
  ).toBeVisible();
});
