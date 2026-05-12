import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const evalset = JSON.parse(readFileSync(path.resolve("src/harness/portal-ui-evalset.json"), "utf8"));

const screenshotRoutes = evalset.screenshotRegression.routes;

test.describe("Portal component visual workbench", () => {
  test("renders the generated component index", async ({ page }) => {
    await page.goto(evalset.visualWorkbench.basePath);
    await expect(page.locator('[data-component-id="portal-harness.component_index"]')).toBeVisible();
    await expect(page.locator('[data-component-id="portal-harness.component_state"]')).toBeVisible();
    await expect(page).toHaveScreenshot("portal-harness-components-index.png", {
      fullPage: true,
      animations: "disabled",
    });
  });

  for (const route of screenshotRoutes) {
    test(`captures ${route.routeId} fixture state`, async ({ page }) => {
      await page.goto(route.fixturePath);
      await expect(page.locator('[data-component-id="portal-harness.component_state"]')).toBeVisible();
      await expect(page.locator("body")).toContainText(route.surfaceId);
      await expect(page).toHaveScreenshot(`${route.routeId.replaceAll(".", "-")}-${route.surfaceId.replaceAll(".", "-")}-fixture.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
});
