import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const portalDbFile = path.join(repoRoot, ".runtime", "portal", "portal-db.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function k8sLabelSafe(value = "") {
  const safe = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return safe || "default";
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("free_port_failed"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function spawnService(label, cwd, entrypoint, env) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  return child;
}

async function waitFor(url, label) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`${label}_not_ready`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `${url} failed: ${JSON.stringify(payload)}`);
  return payload;
}

function startBillingFixture(plan) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };

    if (url.pathname === "/status") {
      send(200, { ok: true, tencentBillingEnabled: true, tencentPriceEnabled: true, tencentCloudConfigured: true });
      return;
    }
    if (url.pathname === "/billing") {
      send(200, {
        ok: true,
        source: "tencent_cloud_bill",
        cloudSource: "tencent_cloud",
        totals: { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: [],
      });
      return;
    }
    if (url.pathname === "/pending") {
      send(200, { ok: true, runs: [], riskByWorkspace: [] });
      return;
    }
    if (url.pathname === "/server-plans") {
      send(200, {
        ok: true,
        source: "tencent_cloud_price",
        configured: true,
        priceEnabled: true,
        catalogCount: 1,
        items: [plan],
      });
      return;
    }
    send(404, { ok: false, error: "not_found" });
  });
}

function startPortalInternalFixture() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://fixture");
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    };
    if (req.method === "POST" && url.pathname === "/portal/internal/resource-orders/prepare-run") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const resourceOrderId = `order-${String(body.runId || "missing-run")}`;
      send(200, {
        ok: true,
        resourceOrderId,
        order: {
          id: resourceOrderId,
          status: "frozen",
          workspaceId: body.workspaceId || "",
          workspaceSessionId: body.workspaceSessionId || "",
          serverPlanId: body.serverPlanId || "",
          estimatedHours: Number(body.estimatedHours || 0),
          idempotencyKey: body.idempotencyKey || "",
        },
      });
      return;
    }
    send(404, { ok: false, error: "not_found" });
  });
}

async function listen(server) {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${port}`;
}

async function createFakeKubectl(runtimeRoot) {
  const filePath = path.join(runtimeRoot, process.platform === "win32" ? "fake-kubectl-success.cmd" : "fake-kubectl-success.sh");
  if (process.platform === "win32") {
    await writeFile(filePath, `@echo off
setlocal

if "%1"=="get" (
  if "%2"=="namespace" (
    echo {"kind":"Namespace","metadata":{"name":"%3"}}
    exit /b 0
  )
)

if "%1"=="create" (
  if "%2"=="namespace" (
    echo namespace/%3 created
    exit /b 0
  )
)

if "%1"=="auth" (
  if "%2"=="can-i" (
    echo yes
    exit /b 0
  )
)

if "%1"=="apply" (
  echo job.batch/fake-job configured
  exit /b 0
)

echo ok
exit /b 0
`, "utf8");
  } else {
    await writeFile(filePath, `#!/usr/bin/env bash
set -euo pipefail

if [ "\${1:-}" = "get" ] && [ "\${2:-}" = "namespace" ]; then
  printf '{"kind":"Namespace","metadata":{"name":"%s"}}\\n' "\${3:-}"
  exit 0
fi

if [ "\${1:-}" = "create" ] && [ "\${2:-}" = "namespace" ]; then
  printf 'namespace/%s created\\n' "\${3:-}"
  exit 0
fi

if [ "\${1:-}" = "auth" ] && [ "\${2:-}" = "can-i" ]; then
  echo yes
  exit 0
fi

if [ "\${1:-}" = "apply" ]; then
  echo job.batch/fake-job configured
  exit 0
fi

echo ok
exit 0
`, "utf8");
    await chmod(filePath, 0o755);
  }
  return filePath;
}

async function loginPortal(baseUrl) {
  const body = new URLSearchParams({
    email: process.env.PORTAL_ADMIN_EMAIL || "zitadel-admin@zitadel.localhost",
    password: process.env.PORTAL_ADMIN_PASSWORD || "Password1!",
  });
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  assert(response.status === 302, `login_failed:${response.status}`);
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/portal_session=([^;]+)/);
  assert(match, "portal_session_missing");
  return `portal_session=${match[1]}`;
}

async function ensurePortalWallet(userId, minBalance = 100) {
  const raw = await readFile(portalDbFile, "utf8");
  const db = JSON.parse(raw);
  db.wallets = Array.isArray(db.wallets) ? db.wallets : [];
  const wallet = db.wallets.find((item) => item.userId === userId);
  if (wallet) {
    wallet.balance = Math.max(Number(wallet.balance || 0), minBalance);
    wallet.updatedAt = new Date().toISOString();
  } else {
    db.wallets.push({
      userId,
      balance: minBalance,
      updatedAt: new Date().toISOString(),
    });
  }
  await writeFile(portalDbFile, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

async function main() {
  const plan = {
    id: "gpu-a10-v10",
    name: "A10 24G",
    provider: "tencent",
    region: "ap-guangzhou",
    zone: "ap-guangzhou-6",
    instanceType: "SA3.LARGE8",
    cpu: 8,
    memoryGb: 32,
    gpu: 1,
    gpuCount: 1,
    nodePool: "gpu-pool-a10",
    runtimeClass: "nvidia",
    nodeSelector: {
      "node.kubernetes.io/instance-type": "SA3.LARGE8",
      "pool.medopl.ai/name": "gpu-pool-a10",
    },
    tolerations: [
      { key: "nvidia.com/gpu", operator: "Exists", value: "", effect: "NoSchedule" },
    ],
    podNetworkingMode: "vpc_cni",
    requiresEniPod: true,
    podAnnotations: {
      "tke.cloud.tencent.com/eni-ip": "true",
    },
    cpuRequest: "8",
    cpuLimit: "8",
    memoryRequest: "32Gi",
    memoryLimit: "32Gi",
    storageRequest: "20Gi",
    storageLimit: "50Gi",
    minBillableHours: 1,
    riskFactor: 1.2,
    reservationFloor: 20,
    priceStatus: "quoted",
    salable: true,
    currency: "CNY",
    originalPrice: 18.6,
    discountPrice: 16.8,
    unitPrice: 16.8,
    provisioningMode: "schedule_to_node_pool",
    selectionNote: "选择后调度到 GPU 节点池。",
  };

  const runtimeRoot = await mkdtemp(path.join(tmpdir(), "opl-v10-chain-"));
  const fakeKubectl = await createFakeKubectl(runtimeRoot);
  const billingServer = startBillingFixture(plan);
  const billingUrl = await listen(billingServer);
  const portalInternalServer = startPortalInternalFixture();
  const portalInternalUrl = await listen(portalInternalServer);
  const runnerPort = await freePort();
  const runnerUrl = `http://127.0.0.1:${runnerPort}`;
  const adapterPort = await freePort();
  const adapterUrl = `http://127.0.0.1:${adapterPort}`;
  const portalPort = await freePort();
  const portalUrl = `http://127.0.0.1:${portalPort}`;

  const runner = spawnService("runner", path.join(repoRoot, "adapters", "med-autoscience-runner"), "src/server.mjs", {
    ...process.env,
    MED_AUTOSCIENCE_RUNNER_PORT: String(runnerPort),
    PORTAL_STORAGE_MODE: "json",
    KUBECTL_BIN: fakeKubectl,
  });
  const adapter = spawnService("adapter", path.join(repoRoot, "services", "opl-runtime-bridge"), "src/server.mjs", {
    ...process.env,
    PORT: String(adapterPort),
    PORTAL_STORAGE_MODE: "json",
    PORTAL_OPL_ADAPTER_PUBLIC_URL: adapterUrl,
    PORTAL_OPL_ADAPTER_STATE_ROOT: path.join(runtimeRoot, "adapter-state"),
    OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
    MED_AUTOSCIENCE_RUNNER_URL: runnerUrl,
    PORTAL_INTERNAL_BASE_URL: portalInternalUrl,
  });
  const portal = spawnService("portal", path.join(repoRoot, "services", "portal"), "src/server.mjs", {
    ...process.env,
    PORT: String(portalPort),
    PORTAL_OIDC_ENABLED: "0",
    PORTAL_STORAGE_MODE: "json",
    BILLING_SERVICE_URL: billingUrl,
    PORTAL_OPL_ADAPTER_URL: adapterUrl,
    OPL_WEB_URL: "http://127.0.0.1:19999/opl-web",
  });

  try {
    await waitFor(`${runnerUrl}/healthz`, "runner");
    await waitFor(`${adapterUrl}/healthz`, "adapter");
    await waitFor(`${portalUrl}/healthz`, "portal");

    const cookie = await loginPortal(portalUrl);
    const me = await requestJson(`${portalUrl}/portal/api/me`, {
      headers: { cookie },
    });
    await ensurePortalWallet(me.id, 100);
    const selected = await requestJson(`${portalUrl}/portal/api/server-plans/select`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ task: "default", planId: plan.id }),
    });
    assert(selected.selectedServerPlan?.id === plan.id, "server_plan_selection_not_persisted");

    const launch = await requestJson(`${portalUrl}/portal/api/opl/launch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({ task: "default" }),
    });
    assert(launch.launchToken, "launch_token_missing");

    const runResponse = await requestJson(`${adapterUrl}/api/opl-launch/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        launchToken: launch.launchToken,
        agentId: "mas",
        toolName: "med-autoscience",
      }),
    });
    const run = runResponse.run;
    assert(run.serverPlanId === plan.id, `run_server_plan_mismatch:${run.serverPlanId}`);
    assert(run.instanceType === plan.instanceType, `run_instance_type_mismatch:${run.instanceType}`);
    assert(run.resourceOrderId === `order-${run.runId}`, `run_resource_order_mismatch:${run.resourceOrderId}`);
    assert(run.runtimeClass === plan.runtimeClass, `run_runtime_class_mismatch:${run.runtimeClass}`);
    assert(run.nodePool === plan.nodePool, `run_node_pool_mismatch:${run.nodePool}`);
    assert(run.podNetworkingMode === plan.podNetworkingMode, `run_pod_networking_mode_mismatch:${run.podNetworkingMode}`);
    assert(run.requiresEniPod === true, "run_requires_eni_pod_mismatch");
    assert(run.podAnnotations?.["tke.cloud.tencent.com/eni-ip"] === "true", "run_pod_annotations_missing_tke_eni");

    const manifest = await readFile(run.manifestPath, "utf8");
    assert(manifest.includes(`server_plan_id: "${plan.id}"`), "manifest_missing_server_plan_label");
    assert(manifest.includes(`instance_type: "${k8sLabelSafe(plan.instanceType)}"`), "manifest_missing_instance_type_label");
    assert(manifest.includes(`resource_order_id: "${run.resourceOrderId}"`), "manifest_missing_resource_order_label");
    assert(manifest.includes(`- name: RESOURCE_ORDER_ID`), "manifest_missing_resource_order_env_name");
    assert(manifest.includes(`value: "${run.resourceOrderId}"`), "manifest_missing_resource_order_env_value");
    assert(manifest.includes(`- name: INSTANCE_TYPE`), "manifest_missing_instance_type_env_name");
    assert(manifest.includes(`value: "${plan.instanceType}"`), "manifest_missing_instance_type_env_value");
    assert(manifest.includes(`runtimeClassName: "${plan.runtimeClass}"`), "manifest_missing_runtime_class");
    assert(manifest.includes(`tke.cloud.tencent.com/eni-ip: "true"`), "manifest_missing_tke_eni_annotation");
    assert(manifest.includes(`cpu: "${plan.cpuRequest}"`), "manifest_missing_cpu_request");
    assert(manifest.includes(`memory: "${plan.memoryRequest}"`), "manifest_missing_memory_request");
    assert(manifest.includes(`ephemeral-storage: "${plan.storageRequest}"`), "manifest_missing_storage_request");
    for (const [key, value] of Object.entries(plan.nodeSelector)) {
      assert(manifest.includes(`${key}: "${value}"`), `manifest_missing_node_selector:${key}`);
    }

    console.log(JSON.stringify({
      ok: true,
      selectedServerPlanId: selected.selectedServerPlan.id,
      runtimeSessionId: launch.runtimeSession.runtimeSessionId,
      runId: run.runId,
      manifestPath: run.manifestPath,
    }, null, 2));
  } finally {
    portal.kill();
    adapter.kill();
    runner.kill();
    billingServer.close();
    portalInternalServer.close();
    await rm(runtimeRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
