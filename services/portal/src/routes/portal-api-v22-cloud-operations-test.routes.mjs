import {
  buildPortalCloudOperationTestProjection,
  executePortalCloudOperationTestFakeLive,
} from "../domain/portal-cloud-operation-test-bridge.mjs";

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

export function createPortalApiV22CloudOperationsTestRoutes({
  readBody = async () => Buffer.from(""),
  sendJson,
  writeDb = async () => {},
}) {
  async function handleFakeLive({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/cloud-operations/test/fake-live") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const result = executePortalCloudOperationTestFakeLive(db, user, payload);
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result);
    return true;
  }

  async function handleProjection({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/v22/cloud-operations/test/projection") return false;
    const result = buildPortalCloudOperationTestProjection(db, user, {
      workspaceId: url.searchParams.get("workspaceId") || "",
    });
    sendResult(sendJson, res, result);
    return true;
  }

  return async function handlePortalApiV22CloudOperationsTestRoutes(context) {
    if (await handleFakeLive(context)) return true;
    if (await handleProjection(context)) return true;
    return false;
  };
}
