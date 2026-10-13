import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "./App";
import CpiField from "./CpiField";

beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url) =>
        new Response(
          JSON.stringify(
            String(url).endsWith("model-info")
              ? {
                  mode: "demo",
                  ready: true,
                  version: "demo-fixture-v1",
                  metrics: {},
                  limitations: [],
                }
              : String(url).endsWith("options")
                ? { countries: ["Kenya", "Germany"], sectors: { 12230: "Infrastruktur" } }
                : { mode: "auto", score: null },
          ),
        ),
    ),
  ),
);
afterEach(() => vi.unstubAllGlobals());

it("opens CPI help on click and closes with Escape", async () => {
  const user = userEvent.setup();
  render(<CpiField country="Kenya" year={2024} month={12} />);
  const help = screen.getByText(/Der CPI beschreibt/);
  const toggle = screen.getByLabelText("CPI erklären");
  expect(help).not.toBeVisible();
  await user.click(toggle);
  expect(help).toBeVisible();
  await user.keyboard("{Escape}");
  expect(help).not.toBeVisible();
  expect(toggle).toHaveFocus();
  await user.click(toggle);
  expect(help).toBeVisible();
});

it.each([
  ["Empfängerland", "Germany", "Empfängerland"],
  ["Genehmigungsjahr", "2023", "Genehmigungszeitpunkt"],
  ["Genehmigungsmonat", "11", "Genehmigungszeitpunkt"],
])("announces safe CPI reset after changing %s", async (label, value, reason) => {
  render(<App />);
  await screen.findByRole("button", { name: "Beispiel prüfen" });
  fireEvent.click(screen.getByLabelText("CPI manuell eingeben"));
  fireEvent.change(screen.getByLabelText(/CPI-Wert/), { target: { value: "31" } });
  const dependency = screen.getByLabelText(label);
  dependency.focus();
  fireEvent.change(dependency, { target: { value } });
  expect(await screen.findByText(/Manueller CPI wurde zurückgesetzt/)).toHaveTextContent(reason);
  expect(screen.getByText(/Manueller CPI wurde zurückgesetzt/)).toHaveAttribute("role", "status");
  expect(screen.getByLabelText("CPI manuell eingeben")).not.toBeChecked();
  expect(screen.queryByLabelText(/CPI-Wert/)).not.toBeInTheDocument();
  expect(dependency).toHaveFocus();
  const form = dependency.closest("form");
  if (!form) throw new Error("Expected dependency inside form");
  expect(new FormData(form).get("cpi_mode")).toBe("auto");
  expect(new FormData(form).get("cpi")).toBeNull();
});

it("moves focus to the persistent CPI checkbox when a focused override disappears", async () => {
  const { rerender } = render(<CpiField country="Kenya" year={2024} month={12} />);
  fireEvent.click(screen.getByLabelText("CPI manuell eingeben"));
  screen.getByLabelText(/CPI-Wert/).focus();
  rerender(<CpiField country="Germany" year={2024} month={12} />);
  await waitFor(() => expect(screen.getByLabelText("CPI manuell eingeben")).toHaveFocus());
  expect(screen.queryByLabelText(/CPI-Wert/)).not.toBeInTheDocument();
});
