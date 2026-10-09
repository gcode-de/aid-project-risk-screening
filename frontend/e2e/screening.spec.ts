import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("screens a project through the real FastAPI service", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demonstrationsmodus")).toBeVisible();
  await page.getByLabel(/Bewilligtes Budget/).fill("1000000");
  await page.getByLabel("Wert nicht verfügbar").check();
  await page.getByRole("button", { name: "Projekt prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toBeVisible();
  await expect(page.getByText("180.000 $", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CPI-Wert fehlt" })).toBeVisible();
  await expect(
    page.getByText("Feste Demonstrationswerte. Keine trainierte Vorhersage."),
  ).toBeVisible();
  await page.getByLabel("Genehmigungsjahr").fill("2023");
  await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toHaveCount(0);
});

test("rejects invalid budget before submitting", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Bewilligtes Budget/).fill("-100");
  await page.getByRole("button", { name: "Projekt prüfen" }).click();
  expect(
    await page
      .getByLabel(/Bewilligtes Budget/)
      .evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(false);
  await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toHaveCount(0);
});

test("form and result meet automated accessibility checks", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Demonstrationsmodus")).toBeVisible();
  const initial = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    initial.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Projekt prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((item) => ({
      id: item.id,
      targets: item.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/screening-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("API outage gives a retry control", async ({ page }) => {
  await page.route("**/api/model-info", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Verbindung");
  await page.unroute("**/api/model-info");
  await page.getByRole("button", { name: "Verbindung erneut prüfen" }).click();
  await expect(page.getByRole("button", { name: "Projekt prüfen" })).toBeEnabled();
});
