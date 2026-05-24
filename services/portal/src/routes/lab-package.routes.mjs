const RETIRED_NODE_LAB_API_PATHS = new Set([
  "/portal/api/lab-packages",
  "/portal/api/lab-subscription",
  "/portal/api/lab-entitlement",
  "/portal/api/lab-packages/activate",
  "/portal/api/lab-packages/upgrade",
]);

function sendRetiredNodeLabApi(sendJson, res) {
  sendJson(res, {
    ok: false,
    error: "node_lab_api_retired",
    businessMessage: "Node Portal lab API has been retired. Use the Go control-plane /api/lab-* endpoints.",
  }, 410);
  return true;
}

export function createLabPackageRoutes({ sendJson }) {
  return async function handleLabPackageRoutes({ res, url }) {
    if (!RETIRED_NODE_LAB_API_PATHS.has(url.pathname)) return false;
    return sendRetiredNodeLabApi(sendJson, res);
  };
}
