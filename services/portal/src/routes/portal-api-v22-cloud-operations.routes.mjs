import {
  buildPortalProductionCloudOperationProjection,
  executePortalProductionStorageCreate,
} from "../domain/portal-cloud-operation-production.mjs";

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

export function createPortalApiV22CloudOperationsRoutes({
  readBody = async () => Buffer.from(""),
  sendJson,
  writeDb = async () => {},
  runnerMode = "fake-live",
  secretFile = "",
  runnerScript = "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs",
  repoRoot = "",
}) {
  async function handleStorageCreate({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/cloud-operations/storage/create") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const result = executePortalProductionStorageCreate(db, user, payload, {
      repoRoot,
      runnerMode,
      runnerScript,
      secretFile,
    });
    if (result.ok || result.persistDb) await writeDb(db);
    sendResult(sendJson, res, result, 202);
    return true;
  }

  async function handleProjection({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/v22/cloud-operations/projection") return false;
    const result = buildPortalProductionCloudOperationProjection(db, user, {
      workspaceId: url.searchParams.get("workspaceId") || "",
    });
    sendResult(sendJson, res, result);
    return true;
  }

  return async function handlePortalApiV22CloudOperationsRoutes(context) {
    if (await handleStorageCreate(context)) return true;
    if (await handleProjection(context)) return true;
    return false;
  };
}
