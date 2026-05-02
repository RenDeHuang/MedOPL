import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { matchesCosTargetItem } from "./lib/v19-live-e2e-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);
const evidenceDir = path.join(repoRoot, ".runtime", "cos-target-daily-check");
const defaultEvidenceFile = path.join(repoRoot, ".runtime", "v19-live-e2e", "2026-05-01T22-33-46-095Z-same_day.json");
const tagAliases = {
  resource_order_id: ["resourceorderid", "resource-order-id"],
  run_id: ["runid", "run-id"],
  server_plan_id: ["serverplanid", "server-plan-id"],
  tenant_id: ["tenantid", "tenant-id"],
  workspace_id: ["workspaceid", "workspace-id"],
};

function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function sanitizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return text;
  }
}

function normalizeKubeconfigForKubectl(kubeconfig, kubectlBin) {
  const value = required(kubeconfig, "COS_DAILY_CHECK_KUBECONFIG");
  if (/\.exe$/i.test(String(kubectlBin || "")) && value.startsWith("/mnt/c/")) {
    return value.replace(/^\/mnt\/c\//, "C:\\").replace(/\//g, "\\");
  }
  return value;
}

function kubectlBaseArgs(config) {
  const args = [`--kubeconfig=${normalizeKubeconfigForKubectl(config.kubeconfig, config.kubectlBin)}`];
  if (config.kubeServerOverride) args.push(`--server=${config.kubeServerOverride}`);
  if (config.kubeInsecureSkipTlsVerify) args.push("--insecure-skip-tls-verify=true");
  return args;
}

async function requestJsonViaKubectlExec(config, requestPath, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const args = [
    ...kubectlBaseArgs(config),
    "exec",
    "-n",
    config.billingNamespace,
    `deploy/${config.billingDeployment}`,
    "--",
    "wget",
    "-qO-",
  ];
  if (method !== "GET") args.push("--header=Content-Type: application/json");
  if (options.body !== undefined) args.push(`--post-data=${String(options.body)}`);
  args.push(`http://127.0.0.1:${config.billingPort}${requestPath}`);
  const result = await execFileAsync(config.kubectlBin, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      KUBECONFIG: normalizeKubeconfigForKubectl(config.kubeconfig, config.kubectlBin),
    },
    encoding: "utf8",
    timeout: config.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.stdout ? JSON.parse(result.stdout) : null;
}

async function requestJson(config, requestPath, options = {}) {
  if (config.transport === "kubectl_exec") {
    return requestJsonViaKubectlExec(config, requestPath, options);
  }
  const response = await fetch(`${config.billingBaseUrl}${requestPath}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`http_request_failed:${response.status}:${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function targetFromEvidence(evidence = {}) {
  const target = evidence.target || {};
  const mapping = evidence.tkeGate?.stdout?.resourceMappingAfterCleanup?.items?.[0]
    || evidence.tkeGate?.stdout?.observeResources?.mapping
    || {};
  return {
    tenantId: firstNonEmpty(target.tenantId, mapping.tenantId),
    workspaceId: firstNonEmpty(target.workspaceId, mapping.workspaceId),
    resourceOrderId: firstNonEmpty(target.resourceOrderId, mapping.resourceOrderId),
    runId: firstNonEmpty(target.runId, mapping.runId),
    serverPlanId: firstNonEmpty(target.serverPlanId, mapping.serverPlanId),
    nodePoolId: firstNonEmpty(mapping.nodePoolId, mapping.nodePoolIds?.[0]),
    cvmInstanceId: firstNonEmpty(mapping.cvmInstanceIds?.[0], mapping.nodeNames?.[0]),
    billingStartedAt: firstNonEmpty(mapping.billingStartedAt),
    billingStoppedAt: firstNonEmpty(mapping.billingStoppedAt),
  };
}

function tagValue(row = {}, key = "") {
  const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  const candidates = [
    key,
    ...(tagAliases[key] || []),
    camel,
    pascal,
    `tag:${key}`,
    `Tag:${key}`,
    `tag_${key}`,
    `Tag_${key}`,
  ];
  for (const candidate of candidates) {
    const value = firstNonEmpty(
      row[candidate],
      row.tags?.[candidate],
      row.Tags?.[candidate],
      row.tags?.[key],
      row.Tags?.[key],
    );
    if (value) return value;
  }
  return "";
}

function normalizeCosItem(row = {}) {
  return {
    resourceOrderId: tagValue(row, "resource_order_id"),
    runId: tagValue(row, "run_id"),
    serverPlanId: tagValue(row, "server_plan_id"),
    tenantId: tagValue(row, "tenant_id"),
    workspaceId: tagValue(row, "workspace_id"),
    totalCost: Number(row.totalCost || row.TotalCost || row.RealTotalCost || row.realTotalCost || row.Cost || row.cost || 0),
    matchedResourceId: firstNonEmpty(row.matchedResourceId, row.ResourceId, row.InstanceId, row["资源ID"]),
    raw: row,
  };
}

function rowText(row = {}) {
  return JSON.stringify(row || {});
}

function findResourceIdMatch(rows = [], target = {}) {
  const ids = [target.cvmInstanceId, target.nodePoolId].filter(Boolean);
  if (!ids.length) return null;
  return rows.find((row) => ids.some((id) => rowText(row).includes(id))) || null;
}

function buildConfig() {
  const evidenceFile = path.resolve(repoRoot, readEnv("COS_DAILY_CHECK_E2E_EVIDENCE", defaultEvidenceFile));
  const targetDate = readEnv("COS_DAILY_CHECK_TARGET_DATE", "20260502");
  const objectKey = readEnv("COS_DAILY_CHECK_OBJECT_KEY", targetDate ? `100047070895-${targetDate}-分账报表-明细账单.zip` : "");
  const transport = readEnv("COS_DAILY_CHECK_TRANSPORT", "kubectl_exec");
  if (!new Set(["kubectl_exec", "http"]).has(transport)) throw new Error(`COS_DAILY_CHECK_TRANSPORT_invalid:${transport}`);
  return {
    evidenceFile,
    targetDate,
    objectKey,
    transport,
    billingBaseUrl: readEnv("COS_DAILY_CHECK_BILLING_BASE_URL", readEnv("BILLING_SERVICE_URL", "http://127.0.0.1:3001")).replace(/\/+$/, ""),
    billingDeployment: readEnv("COS_DAILY_CHECK_BILLING_DEPLOYMENT", "billing-aggregator-opl"),
    billingNamespace: readEnv("COS_DAILY_CHECK_BILLING_NAMESPACE", "default"),
    billingPort: readEnv("COS_DAILY_CHECK_BILLING_PORT", "3001"),
    kubectlBin: readEnv("COS_DAILY_CHECK_KUBECTL_BIN", "/mnt/c/DockerDesktopBin/kubectl.exe"),
    kubeconfig: readEnv("COS_DAILY_CHECK_KUBECONFIG", "/mnt/c/Users/Administrator/Downloads/cls-ngiq693i-config (1)"),
    kubeServerOverride: readEnv("COS_DAILY_CHECK_KUBE_SERVER_OVERRIDE", "https://lb-952pntps-mahtufc86zw9ksjo.clb.usw-tencentclb.com:443"),
    kubeInsecureSkipTlsVerify: readEnv("COS_DAILY_CHECK_KUBE_INSECURE_SKIP_TLS_VERIFY", "1") === "1",
    timeoutMs: Number(readEnv("COS_DAILY_CHECK_TIMEOUT_MS", "30000")),
  };
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

async function main() {
  const startedAt = new Date().toISOString();
  const config = buildConfig();
  const e2eEvidence = await readJson(config.evidenceFile);
  const target = targetFromEvidence(e2eEvidence);
  for (const key of ["tenantId", "workspaceId", "resourceOrderId", "runId", "serverPlanId"]) {
    required(target[key], key);
  }

  const payload = {
    ok: false,
    startedAt,
    finishedAt: "",
    script: "scripts/daily-check-v19-cos-target-bill.mjs",
    mode: "readonly_preview",
    targetDate: config.targetDate,
    objectKey: config.objectKey,
    transport: config.transport,
    billingBaseUrl: config.transport === "http" ? sanitizeUrl(config.billingBaseUrl) : `kubectl_exec://${config.billingNamespace}/${config.billingDeployment}:${config.billingPort}`,
    target,
    files: {},
    preview: {},
    decision: {},
    diagnostics: {},
  };

  try {
    const files = await requestJson(config, "/billing/cos/files");
    const availableFiles = Array.isArray(files?.files) ? files.files : [];
    const selectedFile = availableFiles.find((item) => String(item?.key || "") === config.objectKey) || null;
    payload.files = {
      ok: Boolean(files?.ok),
      readable: Boolean(files?.readable),
      fileCount: Number(files?.fileCount || 0),
      selectedFile,
      latestFile: availableFiles[0] || null,
    };
    if (!selectedFile) {
      payload.decision = {
        canRunStep5B7B: false,
        reason: "target_cos_zip_not_available",
        nextAction: "retry_after_next_daily_bill_delivery",
      };
      payload.finishedAt = new Date().toISOString();
      const evidencePath = await writeEvidence(payload);
      console.log(JSON.stringify({ ok: false, evidencePath, decision: payload.decision }, null, 2));
      process.exitCode = 2;
      return;
    }

    const preview = await requestJson(config, "/billing/cos/reconcile", {
      method: "POST",
      body: JSON.stringify({ objectKey: config.objectKey, COS_LIVE_BILL_OBJECT_KEY: config.objectKey }),
    });
    const attributed = Array.isArray(preview?.items) ? preview.items : [];
    const unattributed = Array.isArray(preview?.unattributed) ? preview.unattributed : [];
    const normalizedAttributed = attributed.map(normalizeCosItem);
    const matchedAttributed = normalizedAttributed.find((item) => matchesCosTargetItem(item, target)) || null;
    const matchedByResourceId = findResourceIdMatch([...attributed, ...unattributed], target);
    payload.preview = {
      ok: Boolean(preview?.ok),
      preview: Boolean(preview?.preview),
      exactSource: String(preview?.exactSource || ""),
      latestFile: preview?.latestFile || null,
      parsedRowCount: Number(preview?.parsedRowCount || 0),
      attributedCount: Number(preview?.attributedCount || 0),
      unattributedCount: Number(preview?.unattributedCount || 0),
      matchedAttributed,
      matchedByResourceId: matchedByResourceId ? normalizeCosItem(matchedByResourceId) : null,
    };
    const canRunStep5B7B = Boolean(matchedAttributed || matchedByResourceId);
    payload.ok = canRunStep5B7B;
    payload.decision = canRunStep5B7B ? {
      canRunStep5B7B: true,
      reason: matchedAttributed ? "target_attributed_row_found" : "target_resource_id_row_found",
      nextAction: "run scripts/live-test-v19-cos-exact-bill-reconcile.mjs with the same object key",
    } : {
      canRunStep5B7B: false,
      reason: "target_row_not_found_in_zip",
      nextAction: "retry_after_next_daily_bill_delivery_or_confirm_tencent_bill_resource_columns",
    };
    payload.finishedAt = new Date().toISOString();
    const evidencePath = await writeEvidence(payload);
    console.log(JSON.stringify({ ok: payload.ok, evidencePath, decision: payload.decision, preview: payload.preview }, null, 2));
    if (!payload.ok) process.exitCode = 2;
  } catch (error) {
    payload.ok = false;
    payload.finishedAt = new Date().toISOString();
    payload.diagnostics = {
      error: String(error?.message || error),
      stderr: String(error?.stderr || "").slice(0, 1000),
      stdoutPreview: String(error?.stdout || "").slice(0, 500),
    };
    payload.decision = {
      canRunStep5B7B: false,
      reason: "cos_daily_check_failed",
      nextAction: "fix_cluster_or_billing_readonly_connectivity_then_retry",
    };
    const evidencePath = await writeEvidence(payload);
    console.error(JSON.stringify({ ok: false, evidencePath, decision: payload.decision, diagnostics: payload.diagnostics }, null, 2));
    process.exitCode = 1;
  }
}

await main();
