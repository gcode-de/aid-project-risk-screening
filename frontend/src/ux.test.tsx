import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";

const info = {
  mode: "demo",
  version: "demo-fixture-v1",
  ready: true,
  limitations: ["Keine Prognose."],
  metrics: {},
};
const options = { countries: ["Kenya", "Germany"], sectors: { 12230: "Infrastruktur" } };
const prediction = {
  mode: "demo",
  model_version: "demo-fixture-v1",
  cpi: { mode: "auto", score: null },
  estimates: { success_probability: 0.64, expected_cost_change_ratio: 0.18 },
  expected_cost_change_usd: 90000,
  notes: [],
  limitations: ["Keine Prognose."],
};
function setupResponse(url: unknown) {
  return new Response(
    JSON.stringify(
      String(url).endsWith("model-info")
        ? info
        : String(url).endsWith("options")
          ? options
          : String(url).includes("cpi-reference")
            ? prediction.cpi
            : prediction,
    ),
  );
}
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => setupResponse(url)),
  ),
);
afterEach(() => vi.unstubAllGlobals());

it("hands off running, completed and changed states without stealing focus", async () => {
  const user = userEvent.setup();
  render(<App />);
  const submit = await screen.findByRole("button", { name: "Beispiel prüfen" });
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementation((url) =>
    String(url).endsWith("predict")
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(setupResponse(url)),
  );
  await user.click(submit);
  expect(screen.getByRole("region", { name: "Prüfung läuft" })).toHaveTextContent("Bitte warten");
  expect(screen.queryByText(/Projektdaten eingeben und/)).not.toBeInTheDocument();
  finish(setupResponse("predict"));
  await screen.findByRole("heading", { name: "Prüfergebnis" });
  expect(screen.getByRole("heading", { name: "Prüfergebnis" })).not.toHaveFocus();
  expect(screen.queryByRole("link", { name: "Zum Ergebnis" })).not.toBeInTheDocument();
  expect(screen.getByText("Ergebnis aktualisiert.")).toHaveClass("sr-only");
  fireEvent.change(screen.getByLabelText(/Bewilligtes Budget/), { target: { value: "600000" } });
  expect(screen.getByRole("region", { name: "Eingaben geändert" })).toHaveTextContent(
    "erneut prüfen",
  );
  expect(screen.queryByText("64 %")).not.toBeInTheDocument();
});

it.each(["TimeoutError", "AbortError"])("localizes %s and permits retry", async (name) => {
  render(<App />);
  const submit = await screen.findByRole("button", { name: "Beispiel prüfen" });
  vi.mocked(fetch).mockRejectedValue(new DOMException("raw failure", name));
  fireEvent.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Zeitlimit|abgebrochen/);
  expect(screen.getByRole("button", { name: "Prüfung wiederholen" })).toBeEnabled();
});

it("links server field errors and focuses the first invalid input without losing data", async () => {
  render(<App />);
  const submit = await screen.findByRole("button", { name: "Beispiel prüfen" });
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({
        detail: [
          { loc: ["body", "initial_budget_usd"], msg: "raw server message", type: "value_error" },
        ],
      }),
      { status: 422 },
    ),
  );
  fireEvent.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Bitte die markierten Eingaben prüfen",
  );
  const budget = screen.getByLabelText(/Bewilligtes Budget/);
  await waitFor(() => expect(budget).toHaveFocus());
  expect(budget).toHaveAttribute("aria-invalid", "true");
  expect(budget).toHaveAttribute("aria-describedby", expect.stringContaining("budget-error"));
  expect(screen.getByText("Bitte einen gültigen Budgetbetrag in USD eingeben.")).toBeVisible();
  expect(budget).toHaveValue(500000);
  fireEvent.change(budget, { target: { value: "600000" } });
  expect(budget).not.toHaveAttribute("aria-invalid", "true");
});

it("recovers from a network failure with preserved inputs and explicit retry", async () => {
  const user = userEvent.setup();
  render(<App />);
  const submit = await screen.findByRole("button", { name: "Beispiel prüfen" });
  fireEvent.change(screen.getByLabelText(/Bewilligtes Budget/), { target: { value: "123456" } });
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (String(url).endsWith("predict")) throw new TypeError("Failed to fetch");
    return setupResponse(url);
  });
  await user.click(submit);
  expect(await screen.findByRole("alert")).toHaveTextContent("Verbindung");
  expect(screen.getByRole("alert")).toHaveTextContent("Eingaben bleiben erhalten");
  expect(screen.getByLabelText(/Bewilligtes Budget/)).toHaveValue(123456);
  vi.mocked(fetch).mockImplementation(async (url) => setupResponse(url));
  await user.click(screen.getByRole("button", { name: "Prüfung wiederholen" }));
  expect(await screen.findByRole("heading", { name: "Prüfergebnis" })).toBeVisible();
  await waitFor(() => expect(screen.getByText("Ergebnis aktualisiert.")).toHaveClass("sr-only"));
});

it.each([
  ["country", "Empfängerland", "gültiges Empfängerland"],
  ["sector_code", "Sektor", "gültigen Sektor"],
  ["approval_year", "Genehmigungsjahr", "Jahr zwischen 2000 und 2100"],
  ["approval_month", "Genehmigungsmonat", "gültigen Genehmigungsmonat"],
  ["cpi_score", /CPI-Wert/, "CPI-Wert zwischen 0 und 100"],
])("associates validation for %s", async (field, label, message) => {
  render(<App />);
  const submit = await screen.findByRole("button", { name: "Beispiel prüfen" });
  if (field === "cpi_score") {
    fireEvent.click(screen.getByLabelText("CPI manuell eingeben"));
    fireEvent.change(screen.getByLabelText(/CPI-Wert/), { target: { value: "31" } });
  }
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({ detail: [{ loc: ["body", field], msg: "raw", type: "value_error" }] }),
      { status: 422 },
    ),
  );
  fireEvent.click(submit);
  await screen.findByRole("alert");
  const input = screen.getByLabelText(label);
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription(expect.stringContaining(String(message)));
});
