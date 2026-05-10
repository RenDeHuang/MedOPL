import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = process.cwd();
const oplRoot = path.resolve(process.env.OPL_REAL_UPSTREAM_DIR || "/home/dev/projects/one-person-lab");
const runtimeRoot = path.join(repoRoot, ".runtime", "real-opl-canary");
const evidencePath = path.join(runtimeRoot, "evidence.json");
const USER_ID = "portal-real-opl-canary-user";
const TENANT_ID = "tenant-real-opl-canary";
const WORKSPACE_ID = "workspace-real-opl-canary";
const WORKSPACE_SESSION_ID = "workspace-session-real-opl-canary";
const RESOURCE_BINDING_ID = "resource-binding-real-opl-canary";
const PROVIDER_KEY_REF = "provider-key-ref-real-opl-canary";
const RUNTIME_AGENT_ID = "runtime-agent-real-opl-canary";

function assertNoSecretLeak(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  assert.equal(
    /sk-[a-z0-9]|gflabtoken_raw_key|rawProviderKey|providerApiKey|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl/i.test(serialized),
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

function childOutputPush(child, streamName, chunk) {
  const key = `${streamName}Tail`;
  child[key] = `${child[key] || ""}${chunk}`;
  if (child[key].length > 16000) child[key] = child[key].slice(-16000);
}

async function spawnAndCollect(command, args, options = {}, stdin = "") {
  const child = spawn(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  if (stdin) child.stdin.write(stdin);
  child.stdin.end();
  const exitCode = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 0));
    child.on("error", () => resolve(1));
  });
  return { exitCode, stdout, stderr };
}

function isolatedOplEnv() {
  return {
    ...process.env,
    OPL_SKIP_SKILL_SYNC: "1",
    HOME: path.join(runtimeRoot, "home"),
    CODEX_HOME: path.join(runtimeRoot, "codex"),
    OPL_WORKSPACE_ROOT: path.join(runtimeRoot, "workspaces"),
  };
}

async function runOplCli(args, { stdin = "" } = {}) {
  return spawnAndCollect(process.execPath, ["--experimental-strip-types", path.join(oplRoot, "src", "cli.ts"), ...args], {
    cwd: oplRoot,
    env: isolatedOplEnv(),
  }, stdin);
}

function parseJsonLines(text = "") {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function probeRetiredWebCommand() {
  const result = await runOplCli(["web"]);
  const payload = JSON.parse(result.stderr.match(/\{[\s\S]*\}/)?.[0] || "{}");
  await mkdir(path.join(runtimeRoot, "logs"), { recursive: true });
  await writeFile(path.join(runtimeRoot, "logs", "opl-web.stdout.log"), result.stdout, "utf8");
  await writeFile(path.join(runtimeRoot, "logs", "opl-web.stderr.log"), result.stderr, "utf8");
  assert.equal(result.exitCode, 2, "real_opl_web_command_must_fail_closed");
  assert.equal(payload.error?.details?.retired, true, "real_opl_web_command_must_report_retired");
  assert.match(payload.error?.message || "", /retired/i, "real_opl_web_retired_message_required");
  return {
    command: "opl web",
    exitCode: result.exitCode,
    retired: true,
    errorCode: payload.error?.code || "",
    replacement: payload.error?.details?.replacement || "",
  };
}

async function probeAcpRuntime() {
  const requests = [
    { id: "initialize", command: "initialize" },
    { id: "session_list", command: "session_list", payload: { limit: 5 } },
    { id: "session_ledger", command: "session_ledger", payload: { limit: 5 } },
    { id: "workspace_list", command: "workspace_list" },
  ];
  const result = await runOplCli(["session", "runtime", "--acp"], {
    stdin: requests.map((request) => JSON.stringify(request)).join("\n"),
  });
  assert.equal(result.exitCode, 0, "real_opl_acp_runtime_must_start");
  const lines = parseJsonLines(result.stdout);
  const initialize = lines.find((line) => line.id === "initialize");
  const sessionList = lines.find((line) => line.id === "session_list");
  const sessionLedger = lines.find((line) => line.id === "session_ledger");
  const workspaceList = lines.find((line) => line.id === "workspace_list");
  assert.equal(initialize?.ok, true, "real_opl_acp_initialize_must_succeed");
  assert(initialize.result.commands.includes("session_create"), "real_opl_acp_must_support_session_create");
  assert(initialize.result.commands.includes("prompt"), "real_opl_acp_must_support_prompt");
  assert.equal(sessionList?.ok, true, "real_opl_acp_session_list_must_succeed");
  assert.equal(sessionLedger?.ok, true, "real_opl_acp_session_ledger_must_succeed");
  assert(workspaceList, "real_opl_acp_workspace_list_result_required");
  return {
    command: "opl session runtime --acp",
    exitCode: result.exitCode,
    surfaceId: initialize.result.surface_id,
    version: initialize.result.version,
    commands: initialize.result.commands,
    sessionListSurface: sessionList.result.surface_id,
    sessionLedgerSurface: sessionLedger.result.surface_id,
    workspaceList: workspaceList.ok === true
      ? {
          ok: true,
          surfaceId: workspaceList.result.surface_id,
        }
      : {
          ok: false,
          errorCode: workspaceList.error?.code || "",
          message: workspaceList.error?.message || "",
          adapterStatus: "capability_not_supported_until_mapping_exists",
        },
  };
}

function spawnNode(script, { port, env, stateRoot }) {
  const child = spawn(process.execPath, [script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      PORTAL_OPL_ADAPTER_STATE_ROOT: stateRoot,
      NODE_ENV: "test",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => childOutputPush(child, "stdout", chunk));
  child.stderr.on("data", (chunk) => childOutputPush(child, "stderr", chunk));
  return child;
}

async function stopChild(child) {
  if (!child || child.killed) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500),
  ]);
}

async function waitFor(url, { allowStatus = (status) => status < 500 } = {}) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (allowStatus(response.status)) return response;
    } catch {}
    await sleep(100);
  }
  throw new Error(`timeout_waiting_for:${url}`);
}

async function postJson(url, payload, { bearer = "" } = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(payload),
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function getJson(url, { bearer = "" } = {}) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    redirect: "manual",
  });
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

async function probeGatewayFailClosed() {
  const port = await freePort();
  const gatewayUrl = `http://127.0.0.1:${port}`;
  const gateway = spawnNode("services/opl-web-gateway/src/server.mjs", {
    port,
    stateRoot: path.join(runtimeRoot, "gateway-state"),
    env: {
      OPL_WEB_GATEWAY_PUBLIC_URL: gatewayUrl,
      OPL_UPSTREAM_URL: "http://127.0.0.1:9",
      PORTAL_OPL_ADAPTER_URL: "http://127.0.0.1:9",
      PORTAL_PUBLIC_URL: "http://portal.local",
    },
  });
  try {
    await waitFor(`${gatewayUrl}/healthz`);
    const status = await getJson(`${gatewayUrl}/status`);
    assert.equal(status.response.status, 200, "gateway_status_must_be_available");
    assert.equal(status.json.runtime.upstreamConfigured, true, "gateway_must_record_explicit_real_opl_upstream_url");
    const root = await fetch(`${gatewayUrl}/`, { redirect: "manual" });
    const rootPayload = await root.json().catch(() => ({}));
    assert.equal(root.status, 502, "gateway_must_fail_closed_when_real_opl_web_is_unavailable");
    assertNoSecretLeak(rootPayload, "gateway_fail_closed_payload");
    return {
      gatewayUrl,
      upstreamUrl: status.json.runtime.upstreamUrl,
      rootStatus: root.status,
      rootError: rootPayload.message || "",
    };
  } finally {
    await stopChild(gateway);
  }
}

async function probeAdapterAcpLoop() {
  const adapterPort = await freePort();
  const adapterUrl = `http://127.0.0.1:${adapterPort}`;
  const stateRoot = path.join(runtimeRoot, "adapter-acp-state");
  await rm(stateRoot, { recursive: true, force: true });
  const adapter = spawnNode("services/opl-runtime-bridge/src/server.mjs", {
    port: adapterPort,
    stateRoot,
    env: {
      PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
      OPL_WEB_URL: "http://127.0.0.1:9",
      OPL_PRODUCT_API_URL: "",
      OPL_RUNTIME_MODE: "acp",
      OPL_ACP_RUNTIME_DIR: oplRoot,
      OPL_ACP_RUNTIME_TIMEOUT_MS: "15000",
      OPL_SKIP_SKILL_SYNC: "1",
      HOME: path.join(runtimeRoot, "home"),
      CODEX_HOME: path.join(runtimeRoot, "codex"),
      OPL_WORKSPACE_ROOT: path.join(runtimeRoot, "workspaces"),
    },
  });
  try {
    await waitFor(`${adapterUrl}/healthz`);
    const launch = await postJson(`${adapterUrl}/api/opl-launch/tokens`, {
      portalUserId: USER_ID,
      portalUserEmail: "real-opl-canary@example.test",
      portalUserName: "Real OPL Canary",
      tenantId: TENANT_ID,
      ownerId: USER_ID,
      sessionOwnerId: USER_ID,
      traceOwnerId: USER_ID,
      artifactOwnerId: USER_ID,
      storageOwnerId: USER_ID,
      workspaceId: WORKSPACE_ID,
      workspaceTitle: "Real OPL Canary Workspace",
      workspacePath: path.join(runtimeRoot, "workspaces", WORKSPACE_ID),
      workspaceSessionId: WORKSPACE_SESSION_ID,
      sourceSurface: "real-opl-canary",
      mode: "full_runtime",
      resourceBindingId: RESOURCE_BINDING_ID,
      computeInstanceId: "compute-real-opl-canary",
      storageBucketId: "storage-real-opl-canary",
      runtimeAgentId: RUNTIME_AGENT_ID,
      providerConfig: {
        providerConfigured: true,
        providerConfigStatus: "configured",
        providerKeyRef: PROVIDER_KEY_REF,
        providerConfigSecretRef: PROVIDER_KEY_REF,
        providerName: "gflab",
      },
      providerConfigSecretRef: PROVIDER_KEY_REF,
    });
    assert.equal(launch.response.status, 200, "adapter_acp_launch_must_succeed");
    assert.equal(launch.json.ok, true, "adapter_acp_launch_payload_must_be_ok");
    assert(launch.json.launchToken, "adapter_acp_launch_token_required");
    assertNoSecretLeak({
      oplWebUrl: launch.json.oplWebUrl,
      bootstrapUrl: launch.json.bootstrapUrl,
    }, "adapter_acp_public_launch_urls");

    const bootstrap = await getJson(`${adapterUrl}/api/opl/bootstrap`, { bearer: launch.json.launchToken });
    assert.equal(bootstrap.response.status, 200, "adapter_acp_bootstrap_must_succeed");
    assert.equal(bootstrap.json.opl.health.source, "opl_acp_runtime", "adapter_bootstrap_must_use_real_opl_acp_runtime");
    assert(bootstrap.json.system.commands.includes("initialize"), "adapter_bootstrap_must_return_acp_commands");
    assert.equal(bootstrap.json.identity.workspaceId, WORKSPACE_ID, "adapter_bootstrap_workspace_mismatch");
    assertNoSecretLeak(bootstrap.json, "adapter_acp_bootstrap");

    const bound = await postJson(`${adapterUrl}/api/opl/sessions/bind`, {
      oplSessionId: "real-opl-canary-opl-session",
      status: "ready",
    }, { bearer: launch.json.launchToken });
    assert.equal(bound.response.status, 200, "adapter_acp_session_bind_must_succeed");
    assert.equal(bound.json.runtimeSession.oplSessionId, "real-opl-canary-opl-session", "adapter_session_bind_opl_session_mismatch");
    assert.equal(bound.json.runtimeSession.workspaceId, WORKSPACE_ID, "adapter_session_bind_workspace_mismatch");
    assert.equal(bound.json.runtimeSession.resourceBindingId, RESOURCE_BINDING_ID, "adapter_session_bind_resource_binding_mismatch");
    assertNoSecretLeak(bound.json, "adapter_acp_session_bind");

    const state = JSON.parse(await readFile(path.join(stateRoot, "state.json"), "utf8"));
    assert((state.events || []).some((event) => event.type === "opl_session_bound"), "adapter_state_must_record_opl_session_bound_event");
    assert((state.events || []).some((event) => event.type === "opl_bootstrap_loaded"), "adapter_state_must_record_real_acp_bootstrap_loaded");
    const runtimeSession = (state.runtimeSessions || []).find((item) => item.workspaceId === WORKSPACE_ID);
    assert(runtimeSession, "adapter_state_runtime_session_required");
    assert.equal(runtimeSession.oplSessionId, "real-opl-canary-opl-session", "adapter_state_opl_session_mismatch");

    return {
      adapterUrl,
      launchId: launch.json.launchId,
      runtimeSessionId: launch.json.runtimeSessionId,
      oplSessionId: bound.json.runtimeSession.oplSessionId,
      bootstrapSource: bootstrap.json.opl.health.source,
      commandCount: bootstrap.json.system.commands.length,
      eventTypes: [...new Set((state.events || []).map((event) => event.type))].sort(),
    };
  } finally {
    await stopChild(adapter);
  }
}

await mkdir(runtimeRoot, { recursive: true });

const web = await probeRetiredWebCommand();
const acp = await probeAcpRuntime();
const gateway = await probeGatewayFailClosed();
const adapter = await probeAdapterAcpLoop();

const evidence = {
  ok: true,
  contract: "v22_real_opl_canary",
  checkedAt: new Date().toISOString(),
  oplRoot,
  findings: {
    productApiWeb: {
      existsInMainRepo: false,
      webCommand: web,
      productApiEndpoints: {
        "/api/opl/system": "not_exposed_by_one_person_lab_main_repo_web",
        "/api/opl/messages": "not_exposed_by_one_person_lab_main_repo_web",
        "/api/opl/sessions": "not_exposed_by_one_person_lab_main_repo_web",
      },
    },
    acpRuntime: acp,
    gatewayFailClosed: gateway,
    adapterAcpLoop: adapter,
  },
  nextAdapterMapping: {
    productApi: "requires separate WebUI/Product API provider such as opl-aion-shell or future upstream HTTP surface",
    acp: "usable public boundary for bootstrap/session bind through initialize/session_list/session_ledger; other advertised commands must be mapped and verified individually",
    unsupportedUntilMapped: ["browser WebUI Product API", "workspace_list ACP projection", "message prompt without provider secret canary", "file upload to upstream WebUI"],
  },
};

assertNoSecretLeak(evidence, "real_opl_canary_evidence");
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: true,
  contract: evidence.contract,
  evidencePath,
  findings: evidence.findings,
}, null, 2));
