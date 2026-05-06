import { readJsonBody, sendJson } from "./http.mjs";

function errorPayload(error) {
  return {
    ok: false,
    error: String(error?.code || error?.message || "internal_error").trim() || "internal_error",
  };
}

export function createCloudProvisionerHttpHandler({ service }) {
  return async function handleCloudProvisioner(req, res) {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    try {
      if (req.method === "GET" && url.pathname === "/healthz") {
        sendJson(res, 200, service.healthz());
        return;
      }

      if (req.method === "POST" && url.pathname === "/v21/resources/compute/provision") {
        sendJson(res, 200, await service.provisionCompute(await readJsonBody(req)));
        return;
      }

      if (req.method === "POST" && url.pathname === "/v21/resources/storage/provision") {
        sendJson(res, 200, await service.provisionStorage(await readJsonBody(req)));
        return;
      }

      if (req.method === "POST" && url.pathname === "/v21/resources/compute/release") {
        sendJson(res, 200, await service.releaseCompute(await readJsonBody(req)));
        return;
      }

      if (req.method === "POST" && url.pathname === "/v21/resources/storage/release") {
        sendJson(res, 200, await service.releaseStorage(await readJsonBody(req)));
        return;
      }

      sendJson(res, 404, { ok: false, error: "not_found" });
    } catch (error) {
      sendJson(res, Number(error?.status) || 500, errorPayload(error));
    }
  };
}
