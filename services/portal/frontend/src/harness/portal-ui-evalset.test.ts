import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import evalset from "./portal-ui-evalset.json";

const repoRoot = path.resolve(process.cwd(), "../../..");
const allowedStatuses = new Set(["done", "partial", "missing"]);

type MaybePartial = {
  nextRequiredChange?: string;
  status: string;
};

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
  it("defines harness-native executable ui truth instead of another heavy contract", () => {
    expect(evalset.version).toBe(3);
    expect(evalset.schemaVersion).toBe("2026-05-harness-native");
    expect(evalset.model).toBe("gpt-5.4");
    expect(evalset.scope.portalOnly).toBe(true);
    expect(evalset.scope.sourceOfExecutableUiTruth).toBe(true);
    expect(evalset.owners.contract).toBe("docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md");
    expect(evalset.owners.runner).toBe("scripts/smoke-test-v22-portal-frontend-surface-eval.mjs");
    expect(evalset.acceptance.unifiedRuntimeSuite).toBe("node scripts/smoke-test-v22-portal-runtime-suite.mjs --group all");
    expect(evalset.artifactPolicy.runtimeReportPath).toBe(".runtime/portal-surface-eval/report.json");
    expect(evalset.artifactPolicy.commitReports).toBe(false);
    expect(evalset.requiredDomAnchors).toEqual(["data-route-id", "data-component-id", "data-layout-id"]);
    expect(evalset.routes.length).toBeGreaterThan(0);
    expect(evalset.surfaces.length).toBeGreaterThan(0);
    expect(evalset.layouts.length).toBeGreaterThan(0);
    expect(evalset.apiShapes.length).toBeGreaterThan(0);
    expect(evalset.primitives.length).toBeGreaterThan(0);
    expect(evalset.copyRegistry.length).toBeGreaterThan(0);
    expect(evalset.fixtures.length).toBeGreaterThan(0);
    expect(evalset.visualRoutes.length).toBeGreaterThan(0);
  });

  it("keeps route identifiers canonical across routes, surfaces, page tasks, and api shapes", () => {
    const routeIds = new Set(evalset.routes.map((route) => route.id));
    for (const surface of evalset.surfaces) {
      expect(routeIds.has(surface.routeId)).toBe(true);
    }
    for (const pageTask of evalset.pageTasks) {
      expect(routeIds.has(pageTask.routeId)).toBe(true);
    }
    for (const apiShape of evalset.apiShapes) {
      expect(routeIds.has(apiShape.routeId)).toBe(true);
      expect(apiShape.requiredPaths.length).toBeGreaterThan(0);
    }
  });

  it("requires partial surfaces to declare the next concrete code change", () => {
    for (const route of evalset.routes) {
      expect(allowedStatuses.has(route.status)).toBe(true);
      exists(route.owner);
      if (route.status !== "done") {
        expect((route as MaybePartial).nextRequiredChange).toBeTruthy();
      }
    }

    for (const surface of evalset.surfaces) {
      expect(allowedStatuses.has(surface.status)).toBe(true);
      exists(surface.owner);
      if (surface.status !== "done") {
        expect((surface as MaybePartial).nextRequiredChange).toBeTruthy();
      }
    }
  });

  it("requires admin routes and surfaces to be explicit done surfaces before absorption", () => {
    const adminRoutes = evalset.routes.filter((route) => route.id.startsWith("admin."));
    expect(adminRoutes.length).toBeGreaterThanOrEqual(6);
    for (const route of adminRoutes) {
      expect(route.status).toBe("done");
      expect((route as MaybePartial).nextRequiredChange).toBeUndefined();
    }

    const adminSurfaces = evalset.surfaces.filter((surface) => surface.routeId.startsWith("admin."));
    expect(adminSurfaces.length).toBeGreaterThanOrEqual(7);
    for (const surface of adminSurfaces) {
      expect(surface.status).toBe("done");
      expect((surface as MaybePartial).nextRequiredChange).toBeUndefined();
    }
  });

  it("defines reusable primitive gates with anchored component files", () => {
    const primitiveIds = new Set(evalset.primitives.map((primitive) => primitive.primitiveId));
    for (const required of [
      "primitive.data_table",
      "primitive.pagination",
      "primitive.empty_state",
      "primitive.status_badge",
      "primitive.metric_card",
      "primitive.form_field",
      "primitive.filter_toolbar",
      "primitive.action_toolbar",
      "primitive.page_section",
    ]) {
      expect(primitiveIds.has(required)).toBe(true);
    }

    for (const primitive of evalset.primitives) {
      expect(primitive.status).toBe("done");
      exists(primitive.owner);
      const componentSource = source(primitive.owner);
      expect(componentSource).toContain(`data-primitive-id="${primitive.primitiveId}"`);
      expect(primitive.states.length).toBeGreaterThan(0);
    }
  });

  it("keeps visible copy in a registry that blocks internal terms and slash labels", () => {
    const registry = evalset.copyRegistry;
    expect(registry.length).toBeGreaterThan(20);
    for (const item of registry) {
      expect(item.routeId).toBeTruthy();
      expect(item.key).toBeTruthy();
      expect(item.text).toBeTruthy();
      expect(item.text).not.toContain("/");
      for (const forbidden of evalset.forbiddenCopy) {
        expect(item.text).not.toContain(forbidden);
      }
    }
  });

  it("defines fixture and visual route gates for browser-backed surfaces", () => {
    for (const fixture of evalset.fixtures) {
      expect(fixture.routeId).toBeTruthy();
      expect(fixture.owner).toBeTruthy();
      exists(fixture.owner);
      expect(fixture.states).toContain("ready");
      expect(fixture.states).toContain("empty");
    }

    for (const visualRoute of evalset.visualRoutes) {
      expect(visualRoute.path).toMatch(/^\//);
      expect(visualRoute.viewport.width).toBeGreaterThanOrEqual(390);
      expect(visualRoute.viewport.height).toBeGreaterThanOrEqual(760);
      expect(visualRoute.requiredSelectors.length).toBeGreaterThan(0);
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
