import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, ".runtime", "real-opl-webui-canary");
const evidencePath = path.join(runtimeRoot, "evidence.json");
const providedWebuiUrl = String(process.env.OPL_REAL_WEBUI_URL || "").replace(/\/$/, "");
const configuredWebuiDir = String(process.env.OPL_REAL_WEBUI_DIR || "").trim();
const repoRuntimeWebuiDir = path.join(repoRoot, ".runtime", "opl-aion-shell");
const USERNAME = "portal-canary";

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(
    /sk-[a-z0-9]|gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl|password|qr-login\?token/i.test(serialized),
    false,
    `${label}_must_not_expose_secret_or_storage_fields`,
  );
}

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await close(server);
  return port;
}

function spawnNode(script, { port, env = {}, cwd = repoRoot } = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  return child;
}

function spawnWebui({ port, webuiDir }) {
  const dataDir = path.join(runtimeRoot, "webui-data");
  return spawn("bun", ["dist-server/server.mjs"], {
    cwd: webuiDir,
    env: {
      ...process.env,
      PORT: String(port),
      ALLOW_REMOTE: "true",
      OPL_WEBUI_AUTH_MODE: "none",
      OPL_WEBUI_USERNAME: USERNAME,
      DATA_DIR: dataDir,
      HOME: path.join(runtimeRoot, "home"),
      XDG_CACHE_HOME: path.join(runtimeRoot, "xdg-cache"),
      XDG_CONFIG_HOME: path.join(runtimeRoot, "xdg-config"),
      AIONUI_E2E_TEST: "1",
      AIONUI_EXTENSION_DEBUG: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    sleep(1500).then(() => false),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      sleep(500),
    ]);
  }
}

async function waitFor(url, { allowStatus = (status) => status < 500, timeoutMs = 30000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (allowStatus(response.status)) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

function buildWsUrl(httpUrl) {
  const parsed = new URL(httpUrl);
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function connectBridge(baseUrl) {
  const ws = new WebSocket(buildWsUrl(baseUrl));
  const pending = new Map();
  const streamEvents = [];

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.name === "ping") {
      ws.send(JSON.stringify({ name: "pong", data: { timestamp: Date.now() } }));
      return;
    }
    if (message.name === "chat.response.stream" || message.name === "conversation.turn.completed") {
      streamEvents.push({ name: message.name });
    }
    const entry = pending.get(message.name);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.name);
    entry.resolve(message.data);
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const invoke = (key, data, timeoutMs = 10000) => {
    const id = `real_webui_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const callbackEventName = `subscribe.callback-${key}${id}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(callbackEventName);
        reject(new Error(`timeout:${key}`));
      }, timeoutMs);
      pending.set(callbackEventName, { resolve, reject, timer });
      ws.send(JSON.stringify({
        name: `subscribe-${key}`,
        data: { id, data },
      }));
    });
  };

  return {
    invoke,
    streamEvents,
    close() {
      ws.close();
    },
  };
}

async function probeHttpSurface(webuiUrl) {
  const root = await fetch(`${webuiUrl}/`, { redirect: "manual" });
  assert.equal(root.status, 200, "real_webui_root_must_load");
  const html = await root.text();
  assert(html.includes("One Person Lab") || html.includes("<!doctype html>"), "real_webui_root_must_be_html_app");

  const authStatus = await getJson(`${webuiUrl}/api/auth/status`);
  assert.equal(authStatus.response.status, 200, "real_webui_auth_status_must_load");
  assert.equal(authStatus.json.success, true, "real_webui_auth_status_must_be_success");
  assert.equal(authStatus.json.authMode, "none", "real_webui_canary_must_use_no_auth_mode");

  const authUser = await getJson(`${webuiUrl}/api/auth/user`);
  assert.equal(authUser.response.status, 200, "real_webui_auth_user_must_load");
  assert.equal(authUser.json.user?.id, "opl-webui-noauth", "real_webui_no_auth_user_mismatch");
  assert.equal(authUser.json.user?.username, USERNAME, "real_webui_no_auth_username_mismatch");

  const productApi = {};
  for (const endpoint of ["/api/opl/system", "/api/opl/sessions", "/api/opl/messages"]) {
    const result = await getJson(`${webuiUrl}${endpoint}`);
    assert.equal(result.response.status, 200, `real_webui_${endpoint}_must_be_reachable_for_classification`);
    assert.equal(
      result.json.message,
      "API endpoint - bridge integration working",
      `real_webui_${endpoint}_must_be_catch_all_placeholder_not_product_api`,
    );
    productApi[endpoint] = {
      status: result.response.status,
      classification: "catch_all_placeholder_not_product_api",
    };
  }

  return {
    rootStatus: root.status,
    authStatus: {
      status: authStatus.response.status,
      authMode: authStatus.json.authMode,
      isAuthenticated: authStatus.json.isAuthenticated,
    },
    authUser: {
      status: authUser.response.status,
      userId: authUser.json.user?.id,
      username: authUser.json.user?.username,
    },
    productApi,
  };
}

async function probeBridgeSession(webuiUrl, label = "direct") {
  const bridge = await connectBridge(webuiUrl);
  const conversationId = `portal-webui-${label}-canary-${Date.now()}`;
  try {
    const workspace = path.join(runtimeRoot, "workspace", label);
    const created = await bridge.invoke("create-conversation", {
      id: conversationId,
      type: "acp",
      name: `Portal WebUI ${label} Canary`,
      extra: {
        workspace,
        backend: "codex",
        customWorkspace: true,
        isHealthCheck: true,
        presetContext: "Portal WebUI canary. Do not read secrets.",
      },
    }, 30000);
    assert.equal(created?.id, conversationId, `${label}_bridge_conversation_id_mismatch`);
    assert.equal(created?.type, "acp", `${label}_bridge_conversation_type_mismatch`);
    assert.equal(created?.source, "aionui", `${label}_bridge_conversation_source_mismatch`);

    const conversations = await bridge.invoke("database.get-user-conversations", { page: 0, pageSize: 20 }, 15000);
    assert(Array.isArray(conversations), `${label}_bridge_conversation_list_must_be_array`);
    assert(
      conversations.some((conversation) => conversation?.id === conversationId),
      `${label}_bridge_created_conversation_must_roundtrip_from_database`,
    );

    const messages = await bridge.invoke("database.get-conversation-messages", { conversation_id: conversationId }, 15000);
    assert(Array.isArray(messages), `${label}_bridge_messages_must_be_array`);

    return {
      label,
      transport: "websocket_bridge",
      conversationId,
      created: true,
      source: created.source,
      databaseConversationRoundtrip: true,
      messageQueryRoundtrip: true,
      initialMessageCount: messages.length,
    };
  } finally {
    await bridge.invoke("remove-conversation", { id: conversationId }, 10000).catch(() => null);
    bridge.close();
  }
}

async function probeBridgeMessageCapability(webuiUrl) {
  const bridge = await connectBridge(webuiUrl);
  const conversationId = `portal-webui-message-canary-${Date.now()}`;
  try {
    await bridge.invoke("create-conversation", {
      id: conversationId,
      type: "acp",
      name: "Portal WebUI Message Canary",
      extra: {
        workspace: path.join(runtimeRoot, "workspace", "message"),
        backend: "codex",
        customWorkspace: true,
        isHealthCheck: true,
        presetContext: "Portal WebUI message canary. Do not read secrets.",
      },
    }, 30000);

    const messageId = `message-${Date.now()}`;
    const result = await bridge.invoke("chat.send.message", {
      conversation_id: conversationId,
      msg_id: messageId,
      input: "Portal WebUI canary: respond with OK only.",
      files: [],
    }, 10000).then(
      (payload) => ({ ok: true, payload }),
      (error) => ({ ok: false, error: String(error.message || error) }),
    );

    await sleep(1000);
    let messages = [];
    let messageQueryOk = false;
    try {
      messages = await bridge.invoke("database.get-conversation-messages", { conversation_id: conversationId }, 5000);
      messageQueryOk = Array.isArray(messages);
    } catch {}

    const explicitReply = String(result.payload?.reply || result.payload?.response || result.payload?.text || "").trim();
    if (result.ok && result.payload?.success === true && explicitReply && messageQueryOk && messages.length > 0) {
      return {
        classification: "real_webui_message_roundtrip",
        sendReturned: true,
        messageQueryRoundtrip: true,
        persistedMessageCount: messages.length,
        streamEventCount: bridge.streamEvents.length,
      };
    }

    return {
      classification: "capability_not_supported",
      reason: result.ok ? "message_send_did_not_persist_reply" : result.error,
      sendReturned: result.ok,
      messageQueryRoundtrip: messageQueryOk,
      persistedMessageCount: Array.isArray(messages) ? messages.length : null,
      streamEventCount: bridge.streamEvents.length,
    };
  } finally {
    await bridge.invoke("remove-conversation", { id: conversationId }, 5000).catch(() => null);
    bridge.close();
  }
}

async function probeGatewayToWebui(webuiUrl) {
  const gatewayPort = await freePort();
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port: gatewayPort,
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: webuiUrl,
      PORTAL_OPL_ADAPTER_URL: "http://127.0.0.1:9",
      PORTAL_PUBLIC_URL: "http://portal.local",
      OPL_WEBUI_AUTH_MODE: "none",
    },
  });
  try {
    await waitFor(`${gatewayUrl}/healthz`);
    const status = await getJson(`${gatewayUrl}/status`);
    assert.equal(status.response.status, 200, "gateway_real_webui_status_must_load");
    assert.equal(status.json.runtime.upstreamUrl, webuiUrl, "gateway_real_webui_upstream_url_mismatch");

    const root = await fetch(`${gatewayUrl}/`, { redirect: "manual" });
    assert.equal(root.status, 200, "gateway_must_proxy_real_webui_root");
    const html = await root.text();
    assert(html.includes("/portal-launch.js"), "gateway_must_inject_launch_script_into_real_webui");
    assert(html.includes("opl-portal-direct-entry"), "gateway_must_mark_direct_entry_on_real_webui");

    const forbiddenUrl = new URL(gatewayUrl);
    forbiddenUrl.searchParams.set("launchToken", "blocked");
    const forbidden = await fetch(forbiddenUrl, { redirect: "manual" });
    assert.equal(forbidden.status, 400, "gateway_must_reject_launch_token_query_for_real_webui");

    const bridge = await probeBridgeSession(gatewayUrl, "gateway");
    return {
      gatewayUrl,
      upstreamUrl: status.json.runtime.upstreamUrl,
      rootStatus: root.status,
      launchScriptInjected: true,
      forbiddenSecretQueryStatus: forbidden.status,
      websocketBridgeProxy: bridge,
    };
  } finally {
    await stopChild(gateway);
  }
}

async function startOrUseWebui() {
  if (providedWebuiUrl) {
    await waitFor(`${providedWebuiUrl}/api/auth/status`);
    return { webuiUrl: providedWebuiUrl, child: null, source: "provided_url" };
  }

  const webuiDir = configuredWebuiDir
    ? path.resolve(configuredWebuiDir)
    : repoRuntimeWebuiDir;
  await readFile(path.join(webuiDir, "dist-server", "server.mjs"), "utf8");
  await readFile(path.join(webuiDir, "out", "renderer", "index.html"), "utf8");
  const port = await freePort();
  const child = spawnWebui({ port, webuiDir });
  const webuiUrl = `http://127.0.0.1:${port}`;
  await waitFor(`${webuiUrl}/api/auth/status`, { timeoutMs: 60000 });
  return { webuiUrl, child, source: "local_dist_server" };
}

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(path.join(runtimeRoot, "workspace"), { recursive: true });

const webui = await startOrUseWebui();

try {
  const httpSurface = await probeHttpSurface(webui.webuiUrl);
  const bridgeSession = await probeBridgeSession(webui.webuiUrl, "direct");
  const bridgeMessage = await probeBridgeMessageCapability(webui.webuiUrl);
  const gateway = await probeGatewayToWebui(webui.webuiUrl);

  const evidence = {
    ok: true,
    contract: "v22_real_opl_webui_canary",
    checkedAt: new Date().toISOString(),
    webui: {
      source: webui.source,
      webuiDir: providedWebuiUrl ? null : (configuredWebuiDir ? path.resolve(configuredWebuiDir) : repoRuntimeWebuiDir),
      url: webui.webuiUrl,
    },
    findings: {
      httpSurface,
      bridgeSession,
      bridgeMessage,
      gateway,
    },
    capabilityClassification: {
      browserWebui: "real_webui_process_available",
      httpProductApi: "capability_not_supported",
      httpProductApiReason: "/api/opl/* is a generic catch-all response, not a real Product API contract",
      websocketBridgeSession: "real_webui_bridge_roundtrip",
      websocketBridgeMessage: bridgeMessage.classification,
      gatewayProxy: "real_webui_gateway_proxy_roundtrip",
    },
  };

  assertNoSecretLeak(evidence, "real_opl_webui_canary_evidence");
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    ok: true,
    contract: evidence.contract,
    evidencePath,
    findings: evidence.findings,
    capabilityClassification: evidence.capabilityClassification,
  }, null, 2));
} finally {
  await stopChild(webui.child);
}
