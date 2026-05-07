import { buildCanonicalPortalStatePayload } from "../domain/portal-api-payloads.mjs";
import { openManagedEnvironment } from "../domain/managed-environment-open-flow.mjs";
import {
  bindV22GflabProviderKey,
  creditV22PortalUser,
  ensureV22PortalUser,
  managedEnvironmentReadinessFromState,
} from "../domain/user-credit-provider-key-flow.mjs";

export const providerKeyEntryBoundary = Object.freeze({
  route: "/portal/api/v22/provider-key",
  source: "OPL entry/preflight",
  notPortalUserVisibleEntry: true,
});

function parseJsonBodyOrEmpty(raw = Buffer.from("")) {
  const source = String(raw || "").trim();
  if (!source) return {};
  return JSON.parse(source);
}

function statusFromResult(result = {}) {
  return Number(result.status || (result.ok ? 200 : 400));
}

function sendResult(sendJson, res, result = {}, successStatus = 200) {
  const status = result.ok ? successStatus : statusFromResult(result);
  const { status: _status, ...payload } = result;
  sendJson(res, payload, status);
}

export function createPortalApiV22UserCreditProviderKeyRoutes({
  activeUserStatus,
  buildUserBillingSummary,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  providerSecretStore,
  readBody = async () => Buffer.from(""),
  sendJson,
  writeDb = async () => {},
}) {
  async function handlePrepareUser({ req, res, url, db }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/users/prepare") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const result = ensureV22PortalUser(db, payload);
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result, result.created ? 201 : 200);
    return true;
  }

  async function handleCreditUser({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/users/credit") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const result = creditV22PortalUser(db, payload, user);
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result);
    return true;
  }

  async function handleProviderKey({ req, res, url, db, user }) {
    // Backend secret boundary retained for OPL entry/preflight reuse; Portal user UI must not expose it as a key entry.
    if (req.method !== "POST" || url.pathname !== providerKeyEntryBoundary.route) return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const result = await bindV22GflabProviderKey(db, user, payload, { providerSecretStore });
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result);
    return true;
  }

  async function handleReadiness({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/managed-environment/readiness") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const state = buildCanonicalPortalStatePayload(db, user, {
      activeUserStatus,
      buildUserBillingSummary,
      currentServerPlanSelection,
      currentTaskSpaceForUser,
      workspaceId: payload.workspaceId || payload.workspace_id || "",
    });
    const result = managedEnvironmentReadinessFromState(state);
    sendResult(sendJson, res, result);
    return true;
  }

  async function handleManagedEnvironmentOpen({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/managed-environment/open") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const state = buildCanonicalPortalStatePayload(db, user, {
      activeUserStatus,
      buildUserBillingSummary,
      currentServerPlanSelection,
      currentTaskSpaceForUser,
      workspaceId: payload.workspaceId || payload.workspace_id || "",
    });
    const result = openManagedEnvironment(db, user, payload, { state });
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result, result.created ? 201 : 200);
    return true;
  }

  return async function handlePortalApiV22UserCreditProviderKeyRoutes(context) {
    if (await handlePrepareUser(context)) return true;
    if (await handleCreditUser(context)) return true;
    if (await handleProviderKey(context)) return true;
    if (await handleManagedEnvironmentOpen(context)) return true;
    if (await handleReadiness(context)) return true;
    return false;
  };
}
