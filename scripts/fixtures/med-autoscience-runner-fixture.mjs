import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";

const PORT = Number(process.env.MED_AUTOSCIENCE_RUNNER_FIXTURE_PORT || process.env.PORT || 18920);
const root = path.resolve(process.env.MED_AUTOSCIENCE_RUNNER_FIXTURE_ROOT || path.join(".runtime", "med-autoscience-runner-fixture"));
const workspaces = new Map();
const runs = new Map();

function nowIso() {
  return new Date().toISOString();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function workspaceKey(customerId, workspaceId) {
  return `${customerId || "default"}:${workspaceId || "default"}`;
}

function workspaceRoot(customerId, workspaceId) {
  return path.join(root, "workspaces", customerId || "default", workspaceId || "default");
}

async function listFiles(dir) {
  await mkdir(dir, { recursive: true });
  const names = await readdir(dir);
  const files = [];
  for (const name of names) {
    const fullPath = path.join(dir, name);
    const meta = await stat(fullPath);
    if (!meta.isFile()) continue;
    files.push({
      name,
      path: fullPath,
      sizeBytes: meta.size,
      mtime: meta.mtime.toISOString(),
      contentType: name.endsWith(".md") ? "text/markdown" : "application/octet-stream",
      objectKey: `fixture/${name}`,
    });
  }
  return files;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === "GET" && url.pathname === "/healthz") {
      sendJson(res, 200, { ok: true, service: "med-autoscience-runner-fixture" });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/workspaces") {
      const input = await readBody(req);
      const customerId = input.customerId || input.portalUserId || input.userId || "demo-customer";
      const workspaceId = input.workspaceId || "default";
      const workspace = {
        customerId,
        portalUserId: input.portalUserId || customerId,
        userId: input.userId || customerId,
        workspaceId,
        workspaceSessionId: input.workspaceSessionId || "",
        runtimeSessionId: input.runtimeSessionId || "",
        root: workspaceRoot(customerId, workspaceId),
        createdAt: nowIso(),
      };
      await mkdir(path.join(workspace.root, "outputs"), { recursive: true });
      workspaces.set(workspaceKey(customerId, workspaceId), workspace);
      sendJson(res, 200, { ok: true, workspace });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/runs") {
      const input = await readBody(req);
      const customerId = input.customerId || input.portalUserId || input.userId || "demo-customer";
      const workspaceId = input.workspaceId || "default";
      const runId = input.runId || randomUUID();
      const workspace = workspaces.get(workspaceKey(customerId, workspaceId)) || {
        root: workspaceRoot(customerId, workspaceId),
      };
      const outputDir = path.join(workspace.root, "outputs");
      await mkdir(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${runId}-fixture-report.md`);
      await writeFile(outputPath, [
        "# Med Auto Science Fixture Output",
        "",
        `- runId: ${runId}`,
        `- portalUserId: ${input.portalUserId || customerId}`,
        `- workspaceId: ${workspaceId}`,
        `- workspaceSessionId: ${input.workspaceSessionId || ""}`,
        `- runtimeSessionId: ${input.runtimeSessionId || ""}`,
        "",
      ].join("\n"), "utf8");
      const run = {
        runId,
        portalUserId: input.portalUserId || customerId,
        customerId,
        userId: input.userId || customerId,
        workspaceId,
        workspaceSessionId: input.workspaceSessionId || "",
        runtimeSessionId: input.runtimeSessionId || "",
        agentId: input.agentId || "mas",
        toolName: input.toolName || "med-autoscience",
        billingScope: input.billingScope || "run",
        costCenter: input.costCenter || "research-foundry",
        namespace: input.namespace || "fixture",
        jobName: `med-autoscience-${runId}`,
        manifestPath: path.join(workspace.root, "runtime", `job-${runId}.yaml`),
        status: "submitted",
        createdAt: nowIso(),
      };
      runs.set(runId, run);
      sendJson(res, 200, { ok: true, run });
      return;
    }
    const statusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/status$/);
    if (req.method === "GET" && statusMatch) {
      const run = runs.get(decodeURIComponent(statusMatch[1]));
      if (!run) {
        sendJson(res, 404, { ok: false, error: "run_not_found" });
        return;
      }
      sendJson(res, 200, { ok: true, run: { ...run, status: "succeeded", finishedAt: nowIso() } });
      return;
    }
    const logsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/logs$/);
    if (req.method === "GET" && logsMatch) {
      sendJson(res, 200, { ok: true, logs: `fixture logs for ${decodeURIComponent(logsMatch[1])}` });
      return;
    }
    const outputsMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/([^/]+)\/outputs$/);
    if (req.method === "GET" && outputsMatch) {
      const customerId = decodeURIComponent(outputsMatch[1]);
      const workspaceId = decodeURIComponent(outputsMatch[2]);
      const outputs = await listFiles(path.join(workspaceRoot(customerId, workspaceId), "outputs"));
      sendJson(res, 200, { ok: true, outputs });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error.message || error) });
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    ok: true,
    service: "med-autoscience-runner-fixture",
    port: PORT,
    baseUrl: `http://127.0.0.1:${PORT}`,
  }, null, 2));
});
