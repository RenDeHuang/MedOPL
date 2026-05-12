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
    expect(evalset.version).toBe(5);
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
    expect(evalset.pageComposition.length).toBeGreaterThan(0);
    expect(evalset.surfaceStates.length).toBeGreaterThan(0);
    expect(evalset.componentFixtures.length).toBeGreaterThan(0);
    expect(evalset.designTokens.length).toBeGreaterThan(0);
    expect(evalset.presentationRules.length).toBeGreaterThan(0);
    expect(evalset.visualWorkbench.basePath).toBe("/__portal-harness/components");
    expect(evalset.screenshotRegression.runner).toBe("playwright");
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
    for (const composition of evalset.pageComposition) {
      expect(routeIds.has(composition.routeId)).toBe(true);
      expect(composition.sections.length).toBeGreaterThan(0);
    }
    for (const fixture of evalset.componentFixtures) {
      expect(routeIds.has(fixture.routeId)).toBe(true);
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

  it("fixes each page task into productized composition sections", () => {
    const routeIdsWithTasks = new Set(evalset.pageTasks.map((task) => task.routeId));
    const requiredRoutes = [
      "overview",
      "resources",
      "workspace",
      "billing",
      "trace",
      "admin.system",
      "admin.dashboard",
      "admin.users",
      "admin.billing_ops",
      "admin.usage",
      "admin.audit",
    ];

    for (const routeId of requiredRoutes) {
      expect(routeIdsWithTasks.has(routeId)).toBe(true);
      const composition = evalset.pageComposition.find((item) => item.routeId === routeId);
      expect(composition).toBeTruthy();
      if (!composition) throw new Error(`composition_missing:${routeId}`);
      expect(composition.layoutId).toMatch(/^layout\./);
      expect(composition.task).toBe(evalset.pageTasks.find((item) => item.routeId === routeId)?.task);
      expect(composition.sections.map((section) => section.kind)).toContain("metrics");
      expect(composition.sections.map((section) => section.kind)).toContain("actions");
      const primarySection = composition.sections.find((section) => ["primaryTable", "primaryList", "primaryPanel"].includes(section.kind));
      expect(primarySection).toBeTruthy();
      for (const section of composition.sections) {
        expect(section.sectionId).toBeTruthy();
        expect(section.componentIds.length).toBeGreaterThan(0);
        for (const componentId of section.componentIds) {
          expect(evalset.surfaces.some((surface) => surface.componentId === componentId)).toBe(true);
        }
      }
    }
  });

  it("aligns surface states with the TypeScript registry", () => {
    const surfaceStateIds = new Set(evalset.surfaceStates.map((state) => state.componentId));
    const doneSurfaceIds = new Set(evalset.surfaces.filter((item) => item.status === "done").map((surface) => surface.componentId));
    expect(surfaceStateIds).toEqual(doneSurfaceIds);

    const registrySource = source(evalset.owners.surfaceRegistry);
    for (const state of evalset.surfaceStates) {
      expect(state.question).toBeTruthy();
      expect(state.states.length).toBeGreaterThan(0);
      expect(state.invariants.length).toBeGreaterThan(0);
      expect(registrySource).toContain(`componentId: "${state.componentId}"`);
      const ownerSource = source(evalset.surfaces.find((surface) => surface.componentId === state.componentId)?.owner || "");
      expect(ownerSource).toContain(`data-component-id="${state.componentId}"`);
    }
  });

  it("defines component fixtures for every done surface and stores concrete state examples", () => {
    const fixtureIds = new Set(evalset.componentFixtures.map((fixture) => fixture.componentId));
    const statesByComponent = new Map(evalset.surfaceStates.map((state) => [state.componentId, state.states]));
    for (const surface of evalset.surfaces.filter((item) => item.status === "done")) {
      expect(fixtureIds.has(surface.componentId)).toBe(true);
    }

    for (const fixture of evalset.componentFixtures) {
      exists(fixture.owner);
      expect(fixture.requiredStates).toEqual(statesByComponent.get(fixture.componentId));
      const fixturePayload = JSON.parse(source(fixture.owner));
      expect(fixturePayload[fixture.componentId]).toBeTruthy();
      for (const requiredState of fixture.requiredStates) {
        expect(fixturePayload[fixture.componentId][requiredState]).toBeTruthy();
      }
    }
  });

  it("keeps design token gates executable through Tailwind config and shared primitives", () => {
    const tokenIds = new Set(evalset.designTokens.map((token) => token.tokenId));
    for (const required of [
      "token.color.primary",
      "token.color.dark",
      "token.font.sans",
      "token.radius",
      "token.shadow.card",
      "primitive.class.btn",
      "primitive.class.input",
      "primitive.class.card",
      "primitive.class.table_shell",
      "primitive.class.empty_state",
    ]) {
      expect(tokenIds.has(required)).toBe(true);
    }

    const styleSource = source("services/portal/frontend/src/style.css");
    const tailwindSource = source("services/portal/frontend/tailwind.config.ts");
    for (const token of evalset.designTokens) {
      expect(["tailwind", "style", "component"]).toContain(token.source);
      expect(token.requiredIn).toBeTruthy();
      const ownerSource = token.requiredIn.endsWith("tailwind.config.ts") ? tailwindSource : source(token.requiredIn);
      expect(ownerSource).toContain(token.assertion);
      if (token.source === "style") {
        expect(styleSource).toContain(token.assertion);
      }
    }
  });

  it("defines presentation rules that block internal copy and wrong display primitives", () => {
    const ruleIds = new Set(evalset.presentationRules.map((rule) => rule.ruleId));
    for (const required of [
      "presentation.metric_first",
      "presentation.table_for_many_objects",
      "presentation.filters_before_table",
      "presentation.actions_are_explicit",
      "presentation.no_slash_copy",
      "presentation.no_internal_terms",
      "presentation.single_primary_task",
    ]) {
      expect(ruleIds.has(required)).toBe(true);
    }

    for (const rule of evalset.presentationRules) {
      expect(rule.description).toBeTruthy();
      expect(rule.assertion).toBeTruthy();
      expect(["static", "browser", "static_and_browser"]).toContain(rule.enforcedBy);
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

  it("defines evalset-driven component workbench routes and screenshot regression gates", () => {
    expect(evalset.coverage.componentFixturesMustHaveBrowseableRoutes).toBe(true);
    expect(evalset.coverage.screenshotBaselinesMustBeCommitted).toBe(true);
    expect(evalset.visualWorkbench.status).toBe("done");
    expect(evalset.visualWorkbench.basePath).toBe("/__portal-harness/components");
    expect(evalset.visualWorkbench.indexRouteName).toBe("portal-harness-components");
    expect(evalset.visualWorkbench.detailRouteName).toBe("portal-harness-component-state");
    expect(evalset.visualWorkbench.source).toBe("portal-ui-evalset.json + harness fixtures");
    expect(evalset.visualWorkbench.requiredGroupBy).toEqual(["route", "domain", "state"]);
    expect(source("services/portal/frontend/src/router/index.ts")).toContain("/__portal-harness/components");
    exists(evalset.visualWorkbench.owner);

    expect(evalset.screenshotRegression.status).toBe("done");
    expect(evalset.screenshotRegression.runner).toBe("playwright");
    expect(evalset.screenshotRegression.command).toBe("npm --prefix services/portal/frontend run test:visual");
    expect(evalset.screenshotRegression.baselineDir).toBe("services/portal/frontend/tests/visual/portal-surfaces.visual.ts-snapshots");
    expect(evalset.screenshotRegression.routes.map((route) => route.routeId)).toEqual([
      "overview",
      "billing",
      "resources",
      "workspace",
      "trace",
      "admin.system",
      "admin.users",
    ]);
    exists("services/portal/frontend/playwright.config.ts");
    exists("services/portal/frontend/tests/visual/portal-surfaces.visual.ts");
    expect(JSON.parse(source("services/portal/frontend/package.json")).scripts["test:visual"]).toBe("playwright test");
  });

  it("keeps done surfaces anchored in their owner component", () => {
    for (const surface of evalset.surfaces.filter((item) => item.status === "done")) {
      const componentSource = source(surface.owner);
      expect(componentSource).toContain(`data-route-id="${surface.routeId}"`);
      expect(componentSource).toContain(`data-component-id="${surface.componentId}"`);
    }
  });
});
