import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768]) {
  test(`readable controls and unclipped result at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Beispiel prüfen" })).toBeEnabled();
    await page.getByLabel("Empfängerland").selectOption("Federated States of Micronesia");
    const sector = page.getByLabel("Sektor");
    const longestSector = await sector.locator("option").evaluateAll(
      (options) =>
        options
          .map((option) => ({
            value: (option as HTMLOptionElement).value,
            length: option.textContent?.length ?? 0,
          }))
          .sort((a, b) => b.length - a.length)[0]?.value,
    );
    if (!longestSector) throw new Error("No sector options available");
    await sector.selectOption(longestSector);
    const metrics = await page.evaluate(() => {
      const inputs = [
        ...document.querySelectorAll<HTMLElement>(
          '.fields select, .fields input:not([type="checkbox"]):not([type="hidden"])',
        ),
      ];
      const checkbox = document.querySelector<HTMLElement>(".checkbox");
      const help = document.querySelector(".help");
      const fields = document.querySelector(".fields");
      if (!checkbox || !help || !fields) throw new Error("Required form elements missing");
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        inputs: inputs.map((el) => ({
          font: parseFloat(getComputedStyle(el).fontSize),
          height: el.getBoundingClientRect().height,
        })),
        help: parseFloat(getComputedStyle(help).fontSize),
        checkbox: checkbox.getBoundingClientRect().height,
        columns: getComputedStyle(fields).gridTemplateColumns.split(" ").length,
      };
    });
    expect(metrics.overflow).toBe(false);
    expect(metrics.inputs.every((el) => el.font >= 16 && el.height >= 44)).toBe(true);
    expect(metrics.help).toBeGreaterThanOrEqual(14);
    expect(metrics.checkbox).toBeGreaterThanOrEqual(44);
    if (width <= 540) expect(metrics.columns).toBe(1);
    await expect(page.getByLabel(/Bewilligtes Budget/)).toHaveAttribute("inputmode", "decimal");
    await expect(page.getByLabel("Genehmigungsjahr")).toHaveAttribute("inputmode", "numeric");
    await page.getByRole("button", { name: "Beispiel prüfen" }).click();
    await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toBeVisible();
    await page.getByRole("link", { name: "Zum Ergebnis" }).click();
    await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `test-results/readable-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}

test("200 percent CSS zoom preserves reflow and keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Beispiel prüfen" })).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Beispiel prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toBeVisible();
  expect(
    await page
      .locator(".primary")
      .evaluate((button) => getComputedStyle(button).transitionDuration),
  ).toBe("0s");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Zum Ergebnis" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Prüfergebnis" })).toBeFocused();
});
