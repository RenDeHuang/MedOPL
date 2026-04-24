import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");
const runtimeRoot = path.join(repoRoot, ".runtime", "opl-runtime-bridge");
const stateFile = path.join(runtimeRoot, "state.json");
const artifactsRoot = path.join(runtimeRoot, "artifacts");

const PORT = Number(process.env.PORT || 8788);
const BASE_URL = process.env.OPL_RUNTIME_BRIDGE_PUBLIC_URL || `http://127.0.0.1:${PORT}`;
const LAUNCH_SECRET = process.env.OPL_LAUNCH_SECRET || "dev-opl-launch-secret-change-me";
const RUNNER_IMAGE = process.env.MED_AUTOSCIENCE_RUNNER_IMAGE || "med-autoscience-runner:local";
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || "med-agent-demo";

const emptyState = {
  version: "v1",
  launchTokens: [],
  workspaces: [],
  workspaceSessions: [],
  runtimeSessions: [],
  runs: [],
  runActions: [],
  artifacts: [],
  traceLinks: [],
  costRecords: [],
  events: [],
};

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";
}

function signLaunchPayload(payload) {
  return createHmac("sha256", LAUNCH_SECRET).update(payload).digest("hex");
}

function makeLaunchToken(record) {
  const body = Buffer.from(JSON.stringify(record), "utf8").toString("base64url");
  return `${body}.${signLaunchPayload(body)}`;
}

function verifyLaunchToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  const expected = signLaunchPayload(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (parsed.expiresAt && Date.parse(parsed.expiresAt) <= Date.now()) return null;
  return parsed;
}

async function ensureRuntime() {
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });
  if (!existsSync(stateFile)) {
    await writeState(emptyState);
  }
}

async function readState() {
  await ensureRuntime();
  const parsed = JSON.parse(await readFile(stateFile, "utf8"));
  return { ...emptyState, ...parsed };
}

async function writeState(state) {
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function addEvent(state, type, detail) {
  state.events.push({
    id: randomUUID(),
    type,
    occurredAt: nowIso(),
    ...detail,
  });
}

function ensureWorkspace(state, input) {
  const workspaceId = slugify(input.workspaceId || input.workspace_id || "default");
  let workspace = state.workspaces.find((item) =>
    item.portalUserId === input.portalUserId &&
    item.workspaceId === workspaceId
  );
  if (!workspace) {
    workspace = {
      workspaceId,
      portalUserId: input.portalUserId,
      title: input.workspaceTitle || input.workspace_title || workspaceId,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.workspaces.push(workspace);
    addEvent(state, "workspace_registered", { portalUserId: input.portalUserId, workspaceId });
  }
  return workspace;
}

function createWorkspaceSession(state, input) {
  const workspace = ensureWorkspace(state, input);
  const session = {
    workspaceSessionId: input.workspaceSessionId || input.workspace_session_id || randomUUID(),
    portalUserId: input.portalUserId,
    workspaceId: workspace.workspaceId,
    sourceSurface: input.sourceSurface || "portal-control-plane",
    status: "active",
    createdAt: nowIso(),
    lastActiveAt: nowIso(),
  };
  state.workspaceSessions.push(session);
  addEvent(state, "workspace_session_created", session);
  return session;
}

function createRuntimeSession(state, input) {
  const runtimeSession = {
    runtimeSessionId: input.runtimeSessionId || input.runtime_session_id || randomUUID(),
    portalUserId: input.portalUserId,
    workspaceId: input.workspaceId,
    workspaceSessionId: input.workspaceSessionId,
    engine: input.engine || "opl-codex-default",
    status: "ready",
    namespace: K8S_NAMESPACE,
    image: RUNNER_IMAGE,
    createdAt: nowIso(),
    warmedAt: nowIso(),
  };
  state.runtimeSessions.push(runtimeSession);
  addEvent(state, "runtime_session_warmed", runtimeSession);
  return runtimeSession;
}

async function createRun(state, input) {
  const runId = input.runId || input.run_id || randomUUID();
  const workspaceId = slugify(input.workspaceId || input.workspace_id || "default");
  const workspaceSessionId = input.workspaceSessionId || input.workspace_session_id || "";
  const runtimeSessionId = input.runtimeSessionId || input.runtime_session_id || "";
  const portalUserId = input.portalUserId || input.portal_user_id || "";
  const artifactId = randomUUID();
  const artifactDir = path.join(artifactsRoot, portalUserId, workspaceId, runId);
  const reportPath = path.join(artifactDir, "med-autoscience-contract-report.md");
  const manifestPath = path.join(artifactDir, "k8s-job-contract.json");
  await mkdir(artifactDir, { recursive: true });
  await writeFile(reportPath, [
    "# Med Auto Science Contract Run",
    "",
    `- run_id: ${runId}`,
    `- portal_user_id: ${portalUserId}`,
    `- workspace_id: ${workspaceId}`,
    `- workspace_session_id: ${workspaceSessionId}`,
    `- runtime_session_id: ${runtimeSessionId}`,
    `- created_at: ${nowIso()}`,
    "",
    "This artifact proves the Portal -> AionUI/OPL -> OPL runtime -> med-autoscience control contract.",
    "",
  ].join("\n"), "utf8");
  await writeFile(manifestPath, `${JSON.stringify({
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: `med-autoscience-${runId}`,
      namespace: K8S_NAMESPACE,
      labels: {
        portal_user_id: portalUserId,
        user_id: portalUserId,
        workspace_id: workspaceId,
        workspace_session_id: workspaceSessionId,
        runtime_session_id: runtimeSessionId,
        run_id: runId,
        agent_id: "mas",
        tool_name: "med-autoscience",
        billing_scope: "run",
        cost_center: "research-foundry",
      },
    },
    spec: {
      template: {
        spec: {
          containers: [{ name: "runner", image: RUNNER_IMAGE }],
          restartPolicy: "Never",
        },
      },
    },
  }, null, 2)}\n`, "utf8");

  const run = {
    runId,
    portalUserId,
    workspaceId,
    workspaceSessionId,
    runtimeSessionId,
    kind: "med-autoscience",
    agentId: "mas",
    status: "completed",
    runnerImage: RUNNER_IMAGE,
    namespace: K8S_NAMESPACE,
    createdAt: nowIso(),
    startedAt: nowIso(),
    finishedAt: nowIso(),
    latencyMs: 1,
    tokenCount: Number(input.tokenCount || input.token_count || 0),
    model: input.model || "opl-runtime",
    userAgent: input.userAgent || input.user_agent || "",
  };
  state.runs.push(run);
  state.runActions.push({
    actionId: randomUUID(),
    runId,
    actionType: "contract_execution",
    summary: "Created med-autoscience run contract, artifact, trace, and cost records.",
    status: "completed",
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  });
  state.artifacts.push({
    artifactId,
    runId,
    portalUserId,
    workspaceId,
    kind: "output",
    objectKey: `opl-runtime-bridge/${portalUserId}/${workspaceId}/${runId}/med-autoscience-contract-report.md`,
    localPath: reportPath,
    sizeBytes: Buffer.byteLength(await readFile(reportPath)),
    contentType: "text/markdown",
    createdAt: nowIso(),
  });
  state.artifacts.push({
    artifactId: randomUUID(),
    runId,
    portalUserId,
    workspaceId,
    kind: "manifest",
    objectKey: `opl-runtime-bridge/${portalUserId}/${workspaceId}/${runId}/k8s-job-contract.json`,
    localPath: manifestPath,
    contentType: "application/json",
    createdAt: nowIso(),
  });
  state.traceLinks.push({
    traceId: randomUUID(),
    runId,
    portalUserId,
    workspaceId,
    traceProvider: "opl-runtime-bridge",
    traceName: "med-autoscience-contract-run",
    status: "completed",
    latencyMs: run.latencyMs,
    model: run.model,
    tokenCount: run.tokenCount,
    userAgent: run.userAgent,
    createdAt: nowIso(),
  });
  state.costRecords.push({
    costRecordId: randomUUID(),
    runId,
    portalUserId,
    workspaceId,
    cpuCost: 0,
    gpuCost: 0,
    storageCost: 0,
    vpnCost: 0,
    trafficCost: 0,
    totalCost: 0,
    pricingSource: "contract-zero-cost",
    status: "exact",
    createdAt: nowIso(),
  });
  addEvent(state, "run_completed", run);
  return run;
}

function buildBootstrap(state, launch) {
  const workspaces = state.workspaces.filter((item) => item.portalUserId === launch.portalUserId);
  const sessions = state.workspaceSessions.filter((item) => item.portalUserId === launch.portalUserId);
  const runs = state.runs.filter((item) => item.portalUserId === launch.portalUserId);
  return {
    version: "v1",
    resources: {
      system: { id: "opl-runtime-bridge", status: "ready" },
      engines: [{ id: "opl-codex-default", status: "ready" }],
      modules: [{ id: "medautoscience", status: "active" }],
      agents: [{ id: "mas", title: "Med Auto Science", status: "active" }],
      workspaces,
      sessions,
      progress: state.events.filter((item) => item.portalUserId === launch.portalUserId).slice(-20),
      artifacts: state.artifacts.filter((item) => item.portalUserId === launch.portalUserId),
    },
    launch,
    runs,
  };
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", BASE_URL);
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "opl-runtime-bridge", runtimeRoot });
    return;
  }

  if (req.method === "GET" && url.pathname === "/workbench") {
    const token = url.searchParams.get("launch_token") || "";
    const launch = verifyLaunchToken(token);
    if (!launch) {
      sendHtml(res, 401, "<h1>OPL launch token invalid</h1>");
      return;
    }
    const state = await readState();
    const runs = state.runs.filter((item) => item.workspaceSessionId === launch.workspaceSessionId);
    const artifacts = state.artifacts.filter((item) => runs.some((run) => run.runId === item.runId));
    sendHtml(res, 200, `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>OPL Workbench</title></head>
  <body style="font-family:system-ui;margin:32px;line-height:1.5">
    <h1>OPL Workbench Contract Surface</h1>
    <p>Portal 已进入 AionUI/OPL 主线，当前页面用于验证 launch、session、run、artifact 合同。</p>
    <pre>${JSON.stringify({ launch, runs, artifacts }, null, 2)}</pre>
  </body>
</html>`);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/launch-tokens") {
    const input = await readBody(req);
    const state = await readState();
    const workspace = ensureWorkspace(state, input);
    const workspaceSession = createWorkspaceSession(state, {
      ...input,
      workspaceId: workspace.workspaceId,
    });
    const runtimeSession = createRuntimeSession(state, {
      ...input,
      workspaceId: workspace.workspaceId,
      workspaceSessionId: workspaceSession.workspaceSessionId,
    });
    const launchRecord = {
      launchId: randomUUID(),
      portalUserId: input.portalUserId,
      portalUserEmail: input.portalUserEmail || "",
      workspaceId: workspace.workspaceId,
      workspaceTitle: workspace.title,
      workspaceSessionId: workspaceSession.workspaceSessionId,
      runtimeSessionId: runtimeSession.runtimeSessionId,
      source: "portal-control-plane",
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    const launchToken = makeLaunchToken(launchRecord);
    state.launchTokens.push({ ...launchRecord, launchToken });
    addEvent(state, "launch_token_created", launchRecord);
    await writeState(state);
    sendJson(res, 200, {
      ok: true,
      ...launchRecord,
      launchToken,
      workbenchUrl: `${BASE_URL}/workbench?launch_token=${encodeURIComponent(launchToken)}`,
      bootstrapUrl: `${BASE_URL}/api/workbench/bootstrap?launch_token=${encodeURIComponent(launchToken)}`,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/workbench/bootstrap") {
    const launch = verifyLaunchToken(url.searchParams.get("launch_token") || "");
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    const state = await readState();
    sendJson(res, 200, buildBootstrap(state, launch));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/runtime-sessions") {
    const input = await readBody(req);
    const state = await readState();
    const runtimeSession = createRuntimeSession(state, input);
    await writeState(state);
    sendJson(res, 200, { ok: true, runtimeSession });
    return;
  }

  const runMatch = url.pathname.match(/^\/api\/runtime-sessions\/([^/]+)\/runs$/);
  if (req.method === "POST" && runMatch) {
    const input = await readBody(req);
    const state = await readState();
    const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runMatch[1]);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return;
    }
    const run = await createRun(state, {
      ...input,
      portalUserId: runtimeSession.portalUserId,
      workspaceId: runtimeSession.workspaceId,
      workspaceSessionId: runtimeSession.workspaceSessionId,
      runtimeSessionId: runtimeSession.runtimeSessionId,
      userAgent: req.headers["user-agent"] || "",
    });
    await writeState(state);
    sendJson(res, 200, { ok: true, run });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runs") {
    const state = await readState();
    sendJson(res, 200, { ok: true, items: state.runs });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/artifacts") {
    const state = await readState();
    const files = await readdir(artifactsRoot, { recursive: true }).catch(() => []);
    sendJson(res, 200, { ok: true, items: state.artifacts, files });
    return;
  }

  sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
}

await ensureRuntime();
http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { ok: false, error: String(error.message || error) });
  });
}).listen(PORT, () => {
  console.log(JSON.stringify({ ok: true, service: "opl-runtime-bridge", port: PORT, baseUrl: BASE_URL }, null, 2));
});
