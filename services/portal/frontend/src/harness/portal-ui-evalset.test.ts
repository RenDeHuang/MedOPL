import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import evalset from "./portal-ui-evalset.json";

const repoRoot = path.resolve(process.cwd(), "../../..");
const allowedStatuses = new Set(["done", "partial", "missing"]);

function repoPath(filePath: string) {
  return path.join(repoRoot, filePath);
}

function source(filePath: string) {
  return readFileSync(repoPath(filePath), "utf8");
}

function exists(filePath: string) {
  expect(() => statSync(repoPath(filePath))).not.toThrow();
}

describe("portal ui evalset", () => {
  it("defines executable ui truth instead of another heavy contract", () => {
    expect(evalset.version).toBe(1);
    expect(evalset.model).toBe("gpt-5.4");
    expect(evalset.scope.portalOnly).toBe(true);
    expect(evalset.scope.sourceOfExecutableUiTruth).toBe(true);
    expect(evalset.requiredDomAnchors).toEqual(["data-route-id", "data-component-id", "data-layout-id"]);
    expect(evalset.routes.length).toBeGreaterThan(0);
    expect(evalset.surfaces.length).toBeGreaterThan(0);
    expect(evalset.layouts.length).toBeGreaterThan(0);
    expect(evalset.apiShapes.length).toBeGreaterThan(0);
  });

  it("requires partial surfaces to declare the next concrete code change", () => {
    for (const route of evalset.routes) {
      expect(allowedStatuses.has(route.status)).toBe(true);
      exists(route.owner);
      if (route.status !== "done") {
        expect(route.nextRequiredChange).toBeTruthy();
      }
    }

    for (const surface of evalset.surfaces) {
      expect(allowedStatuses.has(surface.status)).toBe(true);
      exists(surface.owner);
      if (surface.status !== "done") {
        expect(surface.nextRequiredChange).toBeTruthy();
      }
    }
  });

  it("keeps done surfaces anchored in their owner component", () => {
    for (const surface of evalset.surfaces.filter((item) => item.status === "done")) {
      const componentSource = source(surface.owner);
      expect(componentSource).toContain(`data-route-id="${surface.routeId}"`);
      expect(componentSource).toContain(`data-component-id="${surface.componentId}"`);
    }
  });
});
