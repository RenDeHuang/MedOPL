import { buildCanonicalPortalStatePayload } from "../domain/portal-api-payloads.mjs";

export function createPortalApiStateRoutes({
  activeUserStatus,
  buildUserBillingSummary,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  sendJson,
}) {
  return async function handlePortalApiStateRoutes({ req, res, url, db, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname !== "/portal/api/canonical-state" && url.pathname !== "/portal/api/state") return false;
    const payload = buildCanonicalPortalStatePayload(db, user, {
      activeUserStatus,
      buildUserBillingSummary,
      currentServerPlanSelection,
      currentTaskSpaceForUser,
      workspaceId: url.searchParams.get("workspaceId") || "",
    });
    sendJson(res, payload);
    return true;
  };
}
