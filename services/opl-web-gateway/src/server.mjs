import http from "node:http";
import { URL } from "node:url";
import {
  RUNTIME_BRIDGE_PREFIX,
  BASE_URL,
  LAUNCH_SCRIPT_PATH,
  NATIVE_AUTH_USER_PATHS,
  OPL_UPSTREAM_URL,
  PORT,
  PORTAL_RUNTIME_BRIDGE_URL,
  buildStatusPayload,
} from "./config.mjs";
import { handleAuthUser, handleNativeLogin, isOpenWebUiAuthPath } from "./portal-auth-bridge.mjs";
import { portalLaunchClientScript } from "./launch-client-script.mjs";
import { proxy, proxyUpgrade, writeUpgradeFailure } from "./proxy.mjs";
import { sendJson } from "./http-utils.mjs";

function sendUpstreamRequired(res) {
  sendJson(res, 503, {
    ok: false,
    service: "opl-web-gateway",
    error: "opl_upstream_url_required",
    message: "OPL_UPSTREAM_URL is required before proxying clean upstream OPL Web.",
  });
}

export function createOplWebGatewayServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", BASE_URL);
      if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/status")) {
        sendJson(res, 200, buildStatusPayload());
        return;
      }
      if (req.method === "GET" && url.pathname === LAUNCH_SCRIPT_PATH) {
        res.writeHead(200, {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-cache, no-store, must-revalidate",
        });
        res.end(portalLaunchClientScript());
        return;
      }
      if (req.method === "GET" && NATIVE_AUTH_USER_PATHS.has(url.pathname)) {
        if (await handleAuthUser(req, res, { openWebUi: isOpenWebUiAuthPath(url.pathname) })) return;
      }
      if (await handleNativeLogin(req, res, url)) return;
      if (url.pathname === RUNTIME_BRIDGE_PREFIX || url.pathname.startsWith(`${RUNTIME_BRIDGE_PREFIX}/`)) {
        await proxy(req, res, PORTAL_RUNTIME_BRIDGE_URL, RUNTIME_BRIDGE_PREFIX);
        return;
      }
      if (!OPL_UPSTREAM_URL) {
        sendUpstreamRequired(res);
        return;
      }
      await proxy(req, res, OPL_UPSTREAM_URL);
    } catch (error) {
      sendJson(res, 502, {
        ok: false,
        service: "opl-web-gateway",
        message: String(error.message || error),
      });
    }
  });

  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url || "/", BASE_URL);
      if (url.pathname === RUNTIME_BRIDGE_PREFIX || url.pathname.startsWith(`${RUNTIME_BRIDGE_PREFIX}/`)) {
        proxyUpgrade(req, socket, head, PORTAL_RUNTIME_BRIDGE_URL, RUNTIME_BRIDGE_PREFIX);
        return;
      }
      if (!OPL_UPSTREAM_URL) {
        writeUpgradeFailure(socket, 503, "opl_upstream_url_required");
        return;
      }
      proxyUpgrade(req, socket, head, OPL_UPSTREAM_URL);
    } catch (error) {
      writeUpgradeFailure(socket, 502, String(error.message || error));
    }
  });

  return server;
}

const server = createOplWebGatewayServer();
server.listen(PORT, "0.0.0.0", () => {
  console.log(JSON.stringify({
    ...buildStatusPayload(),
    port: PORT,
  }, null, 2));
});
