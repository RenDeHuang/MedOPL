import { buildCanonicalPortalStatePayload } from "../domain/portal-api-payloads.mjs";
import {
  createOplWorkSession,
  downloadOplOutputArtifact,
  runOplWorkWithFiles,
  uploadOplWorkspaceFile,
} from "../domain/opl-work-flow.mjs";

function parseJsonBodyOrEmpty(raw = Buffer.from("")) {
  const source = String(raw || "").trim();
  if (!source) return {};
  return JSON.parse(source);
}

function text(value) {
  return String(value ?? "").trim();
}

function statusFromResult(result = {}) {
  return Number(result.status || (result.ok ? 200 : 400));
}

function sendResult(sendJson, res, result = {}, successStatus = 200) {
  const status = result.ok ? Number(result.status || successStatus) : statusFromResult(result);
  const { status: _status, ...payload } = result;
  sendJson(res, payload, status);
}

function workspaceIdFromPayload(payload = {}) {
  return text(payload.workspaceId || payload.workspace_id);
}

function activeBindingForWorkspace(db = {}, user = {}, workspaceId = "") {
  const ownerUserId = text(user.id);
  const targetWorkspaceId = text(workspaceId);
  return (Array.isArray(db.workspaceResourceBindings) ? db.workspaceResourceBindings : [])
    .find((item) =>
      text(item.userId || item.ownerUserId) === ownerUserId &&
      text(item.workspaceId) === targetWorkspaceId &&
      text(item.status || "active") === "active"
    ) || null;
}

function internalResourceBindingState(binding = null) {
  if (!binding) return null;
  const resourceBindingId = text(binding.resourceBindingId || binding.id);
  if (!resourceBindingId) return null;
  return {
    resourceBindingId,
    id: resourceBindingId,
    auditTag: text(binding.auditTag),
  };
}

function buildState(db, user, payload = {}, {
  activeUserStatus,
  buildUserBillingSummary,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
} = {}) {
  const workspaceId = workspaceIdFromPayload(payload);
  const state = buildCanonicalPortalStatePayload(db, user, {
    activeUserStatus,
    buildUserBillingSummary,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
    workspaceId,
  });
  const resourceBinding = internalResourceBindingState(activeBindingForWorkspace(db, user, workspaceId));
  if (resourceBinding) state.resourceBinding = resourceBinding;
  return state;
}

export function createPortalApiV22OplWorkRoutes({
  activeUserStatus,
  buildUserBillingSummary,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  readBody = async () => Buffer.from(""),
  sendJson,
  writeDb = async () => {},
}) {
  const stateDeps = {
    activeUserStatus,
    buildUserBillingSummary,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
  };

  async function handleCreateSession({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/opl-work/sessions") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const state = buildState(db, user, payload, stateDeps);
    const result = createOplWorkSession(db, user, payload, { state });
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result, 201);
    return true;
  }

  async function handleUploadFile({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/opl-work/files") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const state = buildState(db, user, payload, stateDeps);
    const result = uploadOplWorkspaceFile(db, user, payload, { state });
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result, 201);
    return true;
  }

  async function handleRun({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/opl-work/runs") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const state = buildState(db, user, payload, stateDeps);
    const result = runOplWorkWithFiles(db, user, payload, { state });
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result, 201);
    return true;
  }

  async function handleDownload({ req, res, url, db, user }) {
    if (req.method !== "GET") return false;
    const match = url.pathname.match(/^\/portal\/api\/v22\/opl-work\/artifacts\/([^/]+)\/download$/);
    if (!match) return false;
    const payload = {
      workspaceId: url.searchParams.get("workspaceId") || url.searchParams.get("workspace_id") || "",
      fileRef: decodeURIComponent(match[1] || ""),
    };
    const state = buildState(db, user, payload, stateDeps);
    const result = downloadOplOutputArtifact(db, user, payload, { state });
    sendResult(sendJson, res, result);
    return true;
  }

  return async function handlePortalApiV22OplWorkRoutes(context) {
    if (await handleCreateSession(context)) return true;
    if (await handleUploadFile(context)) return true;
    if (await handleRun(context)) return true;
    if (await handleDownload(context)) return true;
    return false;
  };
}
