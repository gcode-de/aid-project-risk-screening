import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { ModelInfo, Options, Prediction } from "./api";
import ProjectForm from "./ProjectForm";
import ResultPanel from "./ResultPanel";

const info: ModelInfo = {
  mode: "demo",
  version: "demo-fixture-v1",
  ready: true,
  limitations: ["Keine Prognose."],
  metrics: {},
};
const options: Options = { countries: ["Kenya", "Germany"], sectors: { 12230: "Infrastruktur" } };
const prediction: Prediction = {
  cpi: { mode: "auto", score: null, reference_year: null, source: null },
  mode: "demo",
  model_version: "demo-fixture-v1",
  estimates: { success_probability: 0.64, expected_cost_change_ratio: 0.18 },
  expected_cost_change_usd: 90_000,
  notes: [],
  limitations: ["Feste Beispielwerte."],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.endsWith("model-info")
        ? info
        : url.endsWith("options")
          ? options
          : url.includes("cpi-reference")
            ? prediction.cpi
            : prediction;
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("project screening", () => {
  it("restricts country choices to the supplied training coverage", async () => {
    const submit = vi.fn();
    const user = userEvent.setup();
    render(
      <ProjectForm
        options={{ countries: ["Germany"], sectors: { 12220: "Basisgesundheit" } }}
        busy={false}
        ready
        onSubmit={submit}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Empfängerland")).toHaveValue("Germany");
    expect(screen.queryByRole("option", { name: "Kenya" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Projekt prüfen" }));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "Germany",
        sector_code: 12220,
        cpi_score: null,
        cpi_mode: "auto",
      }),
    );
  });

  it("shows a sourced automatic CPI without sending the preview as a manual score", async () => {
    vi.mocked(fetch).mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).includes("cpi-reference")
              ? { mode: "auto", score: 31, reference_year: 2023, source: "Fixture source" }
              : String(url).endsWith("model-info")
                ? info
                : String(url).endsWith("options")
                  ? options
                  : prediction,
          ),
        ),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/CPI 31 · Referenzjahr 2023 · Fixture source/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Projekt prüfen" }));
    await screen.findByText("Prüfergebnis");
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/predict");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      cpi_mode: "auto",
      cpi_score: null,
    });
  });

  it("labels demo values and submits the API contract", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Demonstrationsmodus");
    await user.click(screen.getByRole("button", { name: "Projekt prüfen" }));
    expect(await screen.findByText("Prüfergebnis")).toBeVisible();
    expect(
      screen.getByText("Feste Demonstrationswerte. Keine trainierte Vorhersage."),
    ).toBeVisible();
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/predict");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      country: "Kenya",
      sector_code: 12230,
      initial_budget_usd: 500_000,
      cpi_mode: "auto",
      cpi_score: null,
      approval_month: 12,
      approval_year: 2024,
    });
  });

  it("accepts manual CPI zero and resets it when the country changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByLabelText("CPI manuell eingeben"));
    await user.type(screen.getByLabelText(/CPI-Wert/), "0");
    await user.click(screen.getByRole("button", { name: "Projekt prüfen" }));
    await screen.findByText("Prüfergebnis");
    const call = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/predict");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ cpi_mode: "manual", cpi_score: 0 });
    await user.selectOptions(screen.getByLabelText("Empfängerland"), "Germany");
    expect(screen.getByLabelText("CPI manuell eingeben")).not.toBeChecked();
    expect(screen.queryByLabelText(/CPI-Wert/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("country=Germany"),
        expect.any(Object),
      ),
    );
  });

  it("removes stale results when the user edits input", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Projekt prüfen" }));
    await screen.findByText("Prüfergebnis");
    fireEvent.change(screen.getByLabelText(/Bewilligtes Budget/), { target: { value: "100000" } });
    expect(screen.queryByText("Prüfergebnis")).not.toBeInTheDocument();
  });

  it("disables prediction when no model is loaded", async () => {
    vi.mocked(fetch).mockImplementation(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("model-info")
              ? { ...info, mode: "unavailable", ready: false }
              : options,
          ),
        ),
    );
    render(<App />);
    await screen.findByText("Modell noch nicht eingebunden");
    expect(screen.getByRole("button", { name: "Projekt prüfen" })).toBeDisabled();
  });

  it("offers recovery after connection failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Verbindung");
    expect(screen.getByRole("button", { name: "Verbindung erneut prüfen" })).toBeVisible();
  });

  it("surfaces prediction errors and re-enables submission", async () => {
    render(<App />);
    await screen.findByText("Demonstrationsmodus");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: "Modell nicht verfügbar" }), { status: 503 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Projekt prüfen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Modell nicht verfügbar");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Projekt prüfen" })).toBeEnabled(),
    );
  });

  it("renders underspending without calling it extra cost", () => {
    render(
      <ResultPanel
        result={{
          ...prediction,
          estimates: { ...prediction.estimates, expected_cost_change_ratio: -0.1 },
          expected_cost_change_usd: -50_000,
        }}
      />,
    );
    expect(screen.getByText("Entsprechende Minderkosten")).toBeVisible();
    expect(screen.getByText("Unter dem ursprünglichen Budget")).toBeVisible();
  });
});
