import evalset from "./portal-ui-evalset.json";
import overviewFixture from "./fixtures/overview.fixture.json";
import billingFixture from "./fixtures/billing.fixture.json";
import resourcesFixture from "./fixtures/resources.fixture.json";
import workspaceFixture from "./fixtures/workspace.fixture.json";
import traceFixture from "./fixtures/trace.fixture.json";
import adminSystemFixture from "./fixtures/admin-system.fixture.json";
import adminDashboardFixture from "./fixtures/admin-dashboard.fixture.json";
import adminUsersFixture from "./fixtures/admin-users.fixture.json";
import adminBillingOpsFixture from "./fixtures/admin-billing-ops.fixture.json";
import adminUsageFixture from "./fixtures/admin-usage.fixture.json";
import adminAuditFixture from "./fixtures/admin-audit.fixture.json";

type FixturePayload = Record<string, Record<string, unknown>>;

const fixturesByOwner: Record<string, FixturePayload> = {
  "services/portal/frontend/src/harness/fixtures/overview.fixture.json": overviewFixture,
  "services/portal/frontend/src/harness/fixtures/billing.fixture.json": billingFixture,
  "services/portal/frontend/src/harness/fixtures/resources.fixture.json": resourcesFixture,
  "services/portal/frontend/src/harness/fixtures/workspace.fixture.json": workspaceFixture,
  "services/portal/frontend/src/harness/fixtures/trace.fixture.json": traceFixture,
  "services/portal/frontend/src/harness/fixtures/admin-system.fixture.json": adminSystemFixture,
  "services/portal/frontend/src/harness/fixtures/admin-dashboard.fixture.json": adminDashboardFixture,
  "services/portal/frontend/src/harness/fixtures/admin-users.fixture.json": adminUsersFixture,
  "services/portal/frontend/src/harness/fixtures/admin-billing-ops.fixture.json": adminBillingOpsFixture,
  "services/portal/frontend/src/harness/fixtures/admin-usage.fixture.json": adminUsageFixture,
  "services/portal/frontend/src/harness/fixtures/admin-audit.fixture.json": adminAuditFixture,
};

export type PortalWorkbenchSurface = {
  routeId: string;
  componentId: string;
  domain: string;
  owner: string;
  selector: string;
  question: string;
  invariants: string[];
  states: string[];
  fixtureOwner: string;
};

export type PortalWorkbenchFixtureState = PortalWorkbenchSurface & {
  state: string;
  statePath: string;
  payload: unknown;
};

export const portalComponentWorkbench = evalset.visualWorkbench;
export const portalScreenshotRegression = evalset.screenshotRegression;

function domainFrom(componentId: string) {
  return componentId.split(".")[0] || "portal";
}

const statesByComponent = new Map(evalset.surfaceStates.map((item) => [item.componentId, item]));
const fixtureByComponent = new Map(evalset.componentFixtures.map((item) => [item.componentId, item]));

export const portalWorkbenchSurfaces: PortalWorkbenchSurface[] = evalset.surfaces
  .filter((surface) => surface.status === "done")
  .map((surface) => {
    const state = statesByComponent.get(surface.componentId);
    const fixture = fixtureByComponent.get(surface.componentId);
    return {
      routeId: surface.routeId,
      componentId: surface.componentId,
      domain: domainFrom(surface.componentId),
      owner: surface.owner,
      selector: surface.selector,
      question: state?.question || "",
      invariants: state?.invariants || [],
      states: state?.states || [],
      fixtureOwner: fixture?.owner || "",
    };
  });

export const portalWorkbenchFixtureStates: PortalWorkbenchFixtureState[] = portalWorkbenchSurfaces.flatMap((surface) => {
  const fixture = fixtureByComponent.get(surface.componentId);
  const payload = fixture ? fixturesByOwner[fixture.owner]?.[surface.componentId] : undefined;
  return surface.states.map((state) => ({
    ...surface,
    state,
    statePath: `${portalComponentWorkbench.basePath}/${surface.componentId}/${state}`,
    payload: payload?.[state],
  }));
});

export function findWorkbenchFixtureState(componentId: string, state: string) {
  return portalWorkbenchFixtureStates.find((item) => item.componentId === componentId && item.state === state);
}

export function groupWorkbenchSurfacesByRoute() {
  return groupBy(portalWorkbenchSurfaces, (item) => item.routeId);
}

export function groupWorkbenchSurfacesByDomain() {
  return groupBy(portalWorkbenchSurfaces, (item) => item.domain);
}

export function groupWorkbenchStatesByState() {
  return groupBy(portalWorkbenchFixtureStates, (item) => item.state);
}

function groupBy<T>(items: T[], keyOf: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = keyOf(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}
