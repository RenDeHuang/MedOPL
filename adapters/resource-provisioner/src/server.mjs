import http from "node:http";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const runtimeRoot = path.join(repoRoot, ".runtime", "resource-provisioner");
const ordersFile = path.join(runtimeRoot, "orders.json");

const PORT = Number(process.env.RESOURCE_PROVISIONER_PORT || process.env.PORT || 18893);
const BUILD_SHA = String(process.env.BUILD_SHA || "dev").trim() || "dev";
const BUILD_TIME = String(process.env.BUILD_TIME || "unknown").trim() || "unknown";
const PROVISIONING_ENABLED = String(process.env.RESOURCE_PROVISIONING_ENABLED || "0") === "1";
const TENCENT_CLOUD_SECRET_ID = String(process.env.TENCENT_CLOUD_SECRET_ID || "").trim();
const TENCENT_CLOUD_SECRET_KEY = String(process.env.TENCENT_CLOUD_SECRET_KEY || "").trim();
const TENCENT_CLOUD_TOKEN = String(process.env.TENCENT_CLOUD_TOKEN || "").trim();
const TENCENT_CLOUD_REGION = String(process.env.TENCENT_CLOUD_REGION || "ap-guangzhou").trim();
const TENCENT_TKE_ENDPOINT = String(process.env.TENCENT_TKE_ENDPOINT || "tke.tencentcloudapi.com").trim();
const TENCENT_TKE_VERSION = String(process.env.TENCENT_TKE_VERSION || "2018-05-25").trim();
const TENCENT_TKE_CLUSTER_ID = String(process.env.TENCENT_TKE_CLUSTER_ID || "").trim();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return createHmac("sha256", key).update(value).digest(encoding);
}

function tencentCloudConfigured() {
  return Boolean(TENCENT_CLOUD_SECRET_ID && TENCENT_CLOUD_SECRET_KEY);
}

async function callTencentCloud({ action, region, payload = {} }) {
  if (!tencentCloudConfigured()) {
    const error = new Error("tencent_cloud_credentials_not_configured");
    error.status = 503;
    throw error;
  }
  const service = "tke";
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${TENCENT_TKE_ENDPOINT}\n`;
  const signedHeaders = "content-type;host";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const secretDate = hmac(`TC3${TENCENT_CLOUD_SECRET_KEY}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  const signature = hmac(secretSigning, stringToSign, "hex");
  const authorization = `TC3-HMAC-SHA256 Credential=${TENCENT_CLOUD_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const headers = {
    authorization,
    "content-type": "application/json; charset=utf-8",
    host: TENCENT_TKE_ENDPOINT,
    "x-tc-action": action,
    "x-tc-region": region || TENCENT_CLOUD_REGION,
    "x-tc-timestamp": String(timestamp),
    "x-tc-version": TENCENT_TKE_VERSION,
  };
  if (TENCENT_CLOUD_TOKEN) headers["x-tc-token"] = TENCENT_CLOUD_TOKEN;

  const response = await fetch(`https://${TENCENT_TKE_ENDPOINT}`, {
    method: "POST",
    headers,
    body,
  });
  const result = await response.json().catch(() => ({}));
  const apiError = result?.Response?.Error;
  if (!response.ok || apiError) {
    const error = new Error(apiError?.Message || `tencent_tke_${action}_failed:${response.status}`);
    error.status = response.status;
    error.code = apiError?.Code || "";
    error.payload = result;
    throw error;
  }
  return result.Response || {};
}

async function readOrders() {
  try {
    return JSON.parse(await readFile(ordersFile, "utf8"));
  } catch {
    return { orders: [] };
  }
}

async function writeOrders(state) {
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(ordersFile, JSON.stringify(state, null, 2), "utf8");
}

function firstString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function arrayFrom(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

function labelValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "unknown";
}

function appendTags(payload, context) {
  const existing = arrayFrom(payload.Tags);
  const tags = [
    { Key: "tenant_id", Value: context.tenantId },
    { Key: "workspace_id", Value: context.workspaceId },
    { Key: "run_id", Value: context.runId },
    { Key: "server_plan_id", Value: context.serverPlanId },
  ].filter((item) => item.Value);
  return [...existing, ...tags.filter((tag) => !existing.some((item) => item.Key === tag.Key))];
}

function appendLabels(payload, context) {
  const existing = arrayFrom(payload.Labels);
  const labels = [
    { Name: "gaofenglab/tenant-id", Value: labelValue(context.tenantId) },
    { Name: "gaofenglab/workspace-id", Value: labelValue(context.workspaceId) },
    { Name: "gaofenglab/server-plan-id", Value: labelValue(context.serverPlanId) },
  ].filter((item) => item.Value);
  return [...existing, ...labels.filter((label) => !existing.some((item) => item.Name === label.Name))];
}

function parseObjectString(value, fieldName) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      const error = new Error(`${fieldName}_invalid_json`);
      error.status = 422;
      throw error;
    }
  }
  if (typeof value === "object") return value;
  return null;
}

function buildProvisionContext(input) {
  const plan = input.serverPlan && typeof input.serverPlan === "object" ? input.serverPlan : input;
  return {
    tenantId: firstString(input.tenantId, input.tenant_id, input.customerId, input.customer_id),
    workspaceId: firstString(input.workspaceId, input.workspace_id),
    runId: firstString(input.runId, input.run_id),
    serverPlanId: firstString(input.serverPlanId, input.server_plan_id, plan.id, "default"),
    region: firstString(input.region, plan.region, TENCENT_CLOUD_REGION),
    mode: firstString(input.provisioningMode, input.provisioning_mode, plan.provisioningMode, "schedule_to_node_pool"),
    plan,
  };
}

function buildIdempotencyKey(context) {
  return [context.tenantId, context.workspaceId, context.runId, context.serverPlanId, context.mode]
    .map((item) => String(item || ""))
    .join(":");
}

function buildCreateNodePoolPayload(context) {
  const plan = context.plan;
  const rawPayload = parseObjectString(
    plan.nodePoolCreatePayload || plan.provisionerPayload || plan.provisioningPayload,
    "node_pool_create_payload",
  );
  if (!rawPayload) {
    const error = new Error("node_pool_create_payload_required");
    error.status = 422;
    throw error;
  }
  const payload = { ...rawPayload };
  payload.ClusterId = firstString(payload.ClusterId, plan.tkeClusterId, plan.clusterId, TENCENT_TKE_CLUSTER_ID);
  payload.Name = firstString(payload.Name, plan.nodePoolName, `opl-${labelValue(context.serverPlanId)}-${labelValue(context.runId).slice(0, 8)}`);
  payload.EnableAutoscale = payload.EnableAutoscale !== undefined ? Boolean(payload.EnableAutoscale) : true;
  payload.Tags = appendTags(payload, context);
  payload.Labels = appendLabels(payload, context);

  const required = ["ClusterId", "AutoScalingGroupPara", "LaunchConfigurePara", "InstanceAdvancedSettings", "EnableAutoscale"];
  const missing = required.filter((key) => payload[key] === undefined || payload[key] === null || payload[key] === "");
  if (missing.length) {
    const error = new Error(`node_pool_create_payload_missing:${missing.join(",")}`);
    error.status = 422;
    throw error;
  }
  return payload;
}

function buildModifyNodePoolPayload(context) {
  const plan = context.plan;
  const rawPayload = parseObjectString(
    plan.nodePoolScalePayload || plan.nodePoolModifyPayload || plan.provisionerPayload || plan.provisioningPayload,
    "node_pool_scale_payload",
  );
  if (!rawPayload) {
    const error = new Error("node_pool_scale_payload_required");
    error.status = 422;
    throw error;
  }
  const payload = { ...rawPayload };
  payload.ClusterId = firstString(payload.ClusterId, plan.tkeClusterId, plan.clusterId, TENCENT_TKE_CLUSTER_ID);
  payload.NodePoolId = firstString(payload.NodePoolId, plan.nodePoolId);
  const missing = ["ClusterId", "NodePoolId"].filter((key) => !payload[key]);
  if (missing.length) {
    const error = new Error(`node_pool_scale_payload_missing:${missing.join(",")}`);
    error.status = 422;
    throw error;
  }
  return payload;
}

function readyOrder(context, details = {}) {
  return {
    id: randomUUID(),
    idempotencyKey: buildIdempotencyKey(context),
    status: "ready",
    action: "schedule_to_node_pool",
    tenantId: context.tenantId,
    workspaceId: context.workspaceId,
    runId: context.runId,
    serverPlanId: context.serverPlanId,
    region: context.region,
    mode: context.mode,
    details,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function ensureCapacity(input) {
  const context = buildProvisionContext(input);
  if (!context.tenantId || !context.workspaceId || !context.runId) {
    const error = new Error("tenant_workspace_run_required");
    error.status = 422;
    throw error;
  }

  const state = await readOrders();
  const idempotencyKey = buildIdempotencyKey(context);
  const existing = state.orders.find((order) => order.idempotencyKey === idempotencyKey && order.status !== "failed");
  if (existing) return { order: existing, reused: true };

  let order;
  const mode = context.mode.toLowerCase();
  if (mode === "schedule_to_node_pool" || mode === "existing_node_pool") {
    order = readyOrder(context, {
      nodePool: context.plan.nodePool || "",
      nodeSelector: context.plan.nodeSelector || {},
      tolerations: context.plan.tolerations || [],
    });
  } else {
    if (!PROVISIONING_ENABLED) {
      const error = new Error("resource_provisioning_disabled");
      error.status = 503;
      throw error;
    }

    const action = mode === "tke_node_pool_scale" ? "ModifyClusterNodePool" : "CreateClusterNodePool";
    const payload = action === "ModifyClusterNodePool" ? buildModifyNodePoolPayload(context) : buildCreateNodePoolPayload(context);
    const response = await callTencentCloud({ action, region: context.region, payload });
    order = {
      id: randomUUID(),
      idempotencyKey,
      status: action === "CreateClusterNodePool" ? "provisioning" : "ready",
      action,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
      runId: context.runId,
      serverPlanId: context.serverPlanId,
      region: context.region,
      mode: context.mode,
      nodePoolId: response.NodePoolId || payload.NodePoolId || "",
      requestId: response.RequestId || "",
      details: {
        nodeSelector: {
          ...(context.plan.nodeSelector || {}),
          "gaofenglab/server-plan-id": labelValue(context.serverPlanId),
        },
        tolerations: context.plan.tolerations || [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  state.orders.unshift(order);
  await writeOrders(state);
  return { order, reused: false };
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      build: { sha: BUILD_SHA, time: BUILD_TIME },
      tencent: {
        configured: tencentCloudConfigured(),
        region: TENCENT_CLOUD_REGION,
        tkeEndpoint: TENCENT_TKE_ENDPOINT,
        provisioningEnabled: PROVISIONING_ENABLED,
        clusterConfigured: Boolean(TENCENT_TKE_CLUSTER_ID),
      },
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/resource-orders/ensure-capacity") {
    try {
      const result = await ensureCapacity(await readBody(req));
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(res, error.status || 500, {
        ok: false,
        error: String(error.message || error),
        code: error.code || "",
      });
    }
    return;
  }
  if (req.method === "GET" && url.pathname === "/resource-orders") {
    const state = await readOrders();
    sendJson(res, 200, { ok: true, items: state.orders.slice(0, 100) });
    return;
  }
  sendJson(res, 404, { ok: false, error: "not_found" });
}

await mkdir(runtimeRoot, { recursive: true });
http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { ok: false, error: String(error.message || error) });
  });
}).listen(PORT, () => {
  console.log(`resource-provisioner listening on :${PORT}`);
});
