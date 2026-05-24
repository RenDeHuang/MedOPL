const retiredNodeV22ControlPlanePaths = Object.freeze([
  "/portal/api/v22/users/prepare",
  "/portal/api/v22/users/credit",
  "/portal/api/v22/provider-key",
  "/portal/api/v22/managed-environment/readiness",
  "/portal/api/v22/managed-environment/open",
]);

export const node_v22_provider_open_retired = Object.freeze({
  status: 410,
  source: "retired_go_control_plane",
  owner: "services/medopl-go-backend",
  paths: retiredNodeV22ControlPlanePaths,
});

export const providerKeyEntryBoundary = Object.freeze({
  route: "/api/v22/provider-key",
  source: "retired_go_control_plane",
  notPortalUserVisibleEntry: true,
});

export function createPortalApiV22UserCreditProviderKeyRoutes({
  sendJson,
} = {}) {
  return async function handleRetiredNodeV22ProviderOpenRoutes({ req, res, url }) {
    if (req.method !== "POST" || !retiredNodeV22ControlPlanePaths.includes(url.pathname)) return false;
    sendJson(res, {
      ok: false,
      error: "node_v22_provider_open_retired",
      status: "retired_go_control_plane",
      owner: "services/medopl-go-backend",
      goApiBase: "/api",
    }, 410);
    return true;
  };
}
