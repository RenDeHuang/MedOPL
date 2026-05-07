import { releaseManagedEnvironment } from "../domain/managed-environment-release-flow.mjs";

function parseJsonBodyOrEmpty(raw = Buffer.from("")) {
  const source = String(raw || "").trim();
  if (!source) return {};
  return JSON.parse(source);
}

function statusFromResult(result = {}) {
  return Number(result.status || (result.ok ? 200 : 400));
}

function sendResult(sendJson, res, result = {}) {
  const { status: _status, ...payload } = result;
  sendJson(res, payload, statusFromResult(result));
}

export function createPortalApiV22ManagedEnvironmentReleaseRoutes({
  readBody = async () => Buffer.from(""),
  sendJson,
  writeDb = async () => {},
}) {
  async function handleRelease({ req, res, url, db, user }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/v22/managed-environment/release") return false;
    const payload = parseJsonBodyOrEmpty(await readBody(req));
    const result = releaseManagedEnvironment(db, user, payload);
    if (result.ok) await writeDb(db);
    sendResult(sendJson, res, result);
    return true;
  }

  return async function handlePortalApiV22ManagedEnvironmentReleaseRoutes(context) {
    if (await handleRelease(context)) return true;
    return false;
  };
}
