import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { matchesCosTargetItem } from "./lib/v19-live-e2e-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);
const evidenceDir = path.join(repoRoot, ".runtime", "cos-exact-bill-reconcile");
const requiredTagKeys = ["resource_order_id", "run_id", "server_plan_id", "tenant_id", "workspace_id"];
const tagAliases = {
  resource_order_id: ["resourceorderid", "resource-order-id"],
  run_id: ["runid", "run-id"],
  server_plan_id: ["serverplanid", "server-plan-id"],
  tenant_id: ["tenantid", "tenant-id"],
  workspace_id: ["workspaceid", "workspace-id"],
};
const settlementActions = new Set(["charged", "refund", "makeup_charge"]);

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function assert(condition, message, details = {}) {
  if (!condition) fail(message, details);
}

function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function requiredEnv(name) {
  const value = readEnv(name);
  assert(value, `${name}_required`);
  return value;
}

function parsePositiveInt(name, fallback) {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number(raw);
  assert(Number.isInteger(value) && value > 0, `${name}_invalid_positive_integer`, { value: raw });
  return value;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
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

function pickFirst(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
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
    const value = pickFirst(
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
    raw: row,
  };
}

function missingTagKeys(row = {}) {
  return requiredTagKeys.filter((key) => !tagValue(row, key));
}

function summarizeMissingTags(items = [], limit = 10) {
  const histogram = {};
  const samples = [];
  for (const item of items.slice(0, limit)) {
    const missing = missingTagKeys(item);
    for (const key of missing) histogram[key] = (histogram[key] || 0) + 1;
    samples.push({
      missing,
      runId: pickFirst(tagValue(item, "run_id"), item.runId),
      resourceOrderId: pickFirst(tagValue(item, "resource_order_id"), item.resourceOrderId),
      tenantId: pickFirst(tagValue(item, "tenant_id"), item.tenantId),
      workspaceId: pickFirst(tagValue(item, "workspace_id"), item.workspaceId),
      totalCost: Number(item.totalCost || item.TotalCost || item.RealTotalCost || item.realTotalCost || 0),
    });
  }
  return { histogram, samples };
}

function summarizeResults(results = []) {
  return (Array.isArray(results) ? results : []).map((item) => ({
    runId: String(item?.runId || ""),
    workspaceId: String(item?.workspaceId || ""),
    action: String(item?.action || ""),
    charged: Number(item?.charged || 0),
    adjustment: Number(item?.adjustment || 0),
    targetTotalCost: Number(item?.targetTotalCost || 0),
    previousNetCharge: Number(item?.previousNetCharge || 0),
    pricingSource: String(item?.pricingSource || ""),
  }));
}

function targetResult(results = [], runId, workspaceId) {
  return (Array.isArray(results) ? results : []).find((item) => {
    if (String(item?.runId || "") !== runId) return false;
    if (workspaceId && String(item?.workspaceId || "") !== workspaceId) return false;
    return true;
  }) || null;
}

function requiredConfig(value, name) {
  const normalized = String(value || "").trim();
  assert(normalized, `${name}_required`);
  return normalized;
}

function normalizeKubeconfigForKubectl(kubeconfig, kubectlBin) {
  const value = requiredConfig(kubeconfig, "COS_LIVE_KUBECONFIG");
  if (/\.exe$/i.test(String(kubectlBin || "")) && value.startsWith("/mnt/c/")) {
    return value.replace(/^\/mnt\/c\//, "C:\\").replace(/\//g, "\\");
  }
  return value;
}

function kubectlBaseArgs(config) {
  const kubeconfig = normalizeKubeconfigForKubectl(config.kubeconfig, config.kubectlBin);
  const args = [`--kubeconfig=${kubeconfig}`];
  if (config.kubeServerOverride) args.push(`--server=${config.kubeServerOverride}`);
  if (config.kubeInsecureSkipTlsVerify) args.push("--insecure-skip-tls-verify=true");
  return args;
}

async function fetchJson(url, options = {}, timeoutMs = 30_000) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    fail("http_request_failed", {
      url: sanitizeUrl(url),
      status: response.status,
      bodyPreview: String(text || "").slice(0, 500),
    });
  }
  return json;
}

async function fetchJsonViaKubectlExec(config, requestPath, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const deployment = requiredConfig(config.billingDeployment, "COS_LIVE_BILLING_DEPLOYMENT");
  const namespace = requiredConfig(config.billingNamespace, "COS_LIVE_BILLING_NAMESPACE");
  const port = requiredConfig(config.billingPort, "COS_LIVE_BILLING_PORT");
  const args = [
    ...kubectlBaseArgs(config),
    "exec",
    "-n",
    namespace,
    `deploy/${deployment}`,
    "--",
    "wget",
    "-qO-",
  ];
  if (method !== "GET") {
    args.push("--header=Content-Type: application/json");
  }
  if (options.body !== undefined) {
    args.push(`--post-data=${String(options.body)}`);
  }
  args.push(`http://127.0.0.1:${port}${requestPath}`);

  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync(config.kubectlBin, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        KUBECONFIG: normalizeKubeconfigForKubectl(config.kubeconfig, config.kubectlBin),
      },
      encoding: "utf8",
      timeout: config.timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    fail("kubectl_exec_request_failed", {
      path: requestPath,
      stderr: String(error?.stderr || stderr || error?.message || "").slice(0, 1000),
      stdoutPreview: String(error?.stdout || stdout || "").slice(0, 500),
    });
  }

  try {
    return stdout ? JSON.parse(stdout) : null;
  } catch {
    fail("kubectl_exec_json_parse_failed", {
      path: requestPath,
      stdoutPreview: String(stdout || "").slice(0, 1000),
      stderrPreview: String(stderr || "").slice(0, 1000),
    });
  }
}

async function requestJson(config, requestPath, options = {}) {
  if (config.httpTransport === "kubectl_exec") {
    return fetchJsonViaKubectlExec(config, requestPath, options);
  }
  return fetchJson(`${config.billingBaseUrl}${requestPath}`, options, config.timeoutMs);
}

function buildConfig() {
  const runCosLive = readEnv("RUN_COS_LIVE");
  if (runCosLive !== "1") {
    console.error(JSON.stringify({
      ok: false,
      code: "RUN_COS_LIVE_REQUIRED",
      message: "Refusing to run live COS exact bill reconcile gate without RUN_COS_LIVE=1.",
    }, null, 2));
    process.exit(1);
  }

  const httpTransport = readEnv("COS_LIVE_HTTP_TRANSPORT", "http");
  assert(new Set(["http", "kubectl_exec"]).has(httpTransport), "COS_LIVE_HTTP_TRANSPORT_invalid", {
    value: httpTransport,
  });

  const billingBaseUrl = trimTrailingSlash(
    readEnv("COS_LIVE_BILLING_BASE_URL")
      || readEnv("BILLING_BASE_URL")
      || readEnv("BILLING_SERVICE_URL")
      || readEnv("BILLING_RECONCILE_URL").replace(/\/reconcile\/?$/, ""),
  );
  if (httpTransport === "http") {
    assert(billingBaseUrl, "billing_base_url_required");
  }

  const bucket = readEnv("COS_LIVE_BILL_BUCKET", readEnv("TENCENT_COS_BILL_BUCKET"));
  const region = readEnv("COS_LIVE_BILL_REGION", readEnv("TENCENT_COS_BILL_REGION"));
  const prefix = readEnv("COS_LIVE_BILL_PREFIX", readEnv("TENCENT_COS_BILL_PREFIX"));
  const objectKey = readEnv("COS_LIVE_BILL_OBJECT_KEY", readEnv("COS_LIVE_BILL_OBJECT_PATH"));
  const endpoint = readEnv("COS_LIVE_BILL_ENDPOINT", readEnv("TENCENT_COS_BILL_ENDPOINT"));
  assert(objectKey || (bucket && prefix), "cos_bill_locator_required", {
    required: "COS_LIVE_BILL_OBJECT_KEY or COS_LIVE_BILL_BUCKET+COS_LIVE_BILL_PREFIX",
  });
  if (objectKey && prefix) {
    assert(objectKey.startsWith(prefix), "cos_bill_object_key_outside_prefix", { objectKey, prefix });
  }

  const tenantId = requiredEnv("COS_LIVE_EXPECT_TENANT_ID");
  const workspaceId = requiredEnv("COS_LIVE_EXPECT_WORKSPACE_ID");
  const resourceOrderId = requiredEnv("COS_LIVE_EXPECT_RESOURCE_ORDER_ID");
  const runId = requiredEnv("COS_LIVE_EXPECT_RUN_ID");
  const serverPlanId = requiredEnv("COS_LIVE_EXPECT_SERVER_PLAN_ID");
  const windowValue = readEnv("COS_LIVE_RECONCILE_WINDOW", "30d");
  const timeoutMs = parsePositiveInt("COS_LIVE_TIMEOUT_MS", 30_000);

  return {
    httpTransport,
    billingBaseUrl,
    billingDeployment: readEnv("COS_LIVE_BILLING_DEPLOYMENT", "billing-aggregator-opl"),
    billingNamespace: readEnv("COS_LIVE_BILLING_NAMESPACE", "default"),
    billingPort: readEnv("COS_LIVE_BILLING_PORT", "3001"),
    kubectlBin: readEnv("COS_LIVE_KUBECTL_BIN", "kubectl"),
    kubeconfig: readEnv("COS_LIVE_KUBECONFIG", readEnv("KUBECONFIG")),
    kubeServerOverride: readEnv("COS_LIVE_KUBE_SERVER_OVERRIDE"),
    kubeInsecureSkipTlsVerify: readEnv("COS_LIVE_KUBE_INSECURE_SKIP_TLS_VERIFY", "0") === "1",
    bucket,
    region,
    prefix,
    objectKey,
    endpoint,
    tenantId,
    workspaceId,
    resourceOrderId,
    runId,
    serverPlanId,
    windowValue,
    timeoutMs,
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
  let config;
  try {
    config = buildConfig();
  } catch (error) {
    const evidence = {
      ok: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      script: "scripts/live-test-v19-cos-exact-bill-reconcile.mjs",
      branchHint: "codex/opl-v19",
      billingBaseUrl: "",
      cosExpectation: {},
      target: {},
      preflight: {},
      cosReconcile: {},
      reconcileRuns: [],
      diagnostics: {
        error: String(error?.message || error),
        details: error?.details || {},
      },
    };
    const evidencePath = await writeEvidence(evidence);
    console.error(JSON.stringify({
      ok: false,
      evidencePath,
      error: evidence.diagnostics.error,
      diagnostics: evidence.diagnostics,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const evidence = {
    ok: false,
    startedAt,
    finishedAt: "",
    script: "scripts/live-test-v19-cos-exact-bill-reconcile.mjs",
    branchHint: "codex/opl-v19",
    httpTransport: config.httpTransport,
    billingBaseUrl: sanitizeUrl(config.billingBaseUrl || `kubectl_exec://${config.billingNamespace}/${config.billingDeployment}:${config.billingPort}`),
    kubectlTarget: config.httpTransport === "kubectl_exec" ? {
      deployment: config.billingDeployment,
      namespace: config.billingNamespace,
      port: config.billingPort,
      kubeServerOverride: config.kubeServerOverride,
      kubeInsecureSkipTlsVerify: config.kubeInsecureSkipTlsVerify,
    } : null,
    cosExpectation: {
      bucket: config.bucket,
      region: config.region,
      prefix: config.prefix,
      objectKey: config.objectKey,
      endpoint: config.endpoint,
    },
    target: {
      tenantId: config.tenantId,
      workspaceId: config.workspaceId,
      resourceOrderId: config.resourceOrderId,
      runId: config.runId,
      serverPlanId: config.serverPlanId,
      window: config.windowValue,
    },
    preflight: {},
    cosReconcile: {},
    reconcileRuns: [],
    diagnostics: {},
  };

  try {
    const cosStatus = await requestJson(config, "/billing/cos/status");
    const cosFiles = await requestJson(config, "/billing/cos/files");
    const cosReconcile = await requestJson(config, "/billing/cos/reconcile", {
      method: "POST",
      body: JSON.stringify(config.objectKey
        ? { objectKey: config.objectKey, COS_LIVE_BILL_OBJECT_KEY: config.objectKey }
        : (config.prefix ? { prefix: config.prefix } : {})),
    });

    evidence.preflight = {
      cosStatus: {
        ok: Boolean(cosStatus?.ok),
        readable: Boolean(cosStatus?.readable),
        bucket: String(cosStatus?.bucket || ""),
        region: String(cosStatus?.region || ""),
        prefix: String(cosStatus?.prefix || ""),
        endpoint: String(cosStatus?.endpoint || ""),
        latestFile: cosStatus?.latestFile || null,
      },
      cosFiles: {
        ok: Boolean(cosFiles?.ok),
        readable: Boolean(cosFiles?.readable),
        fileCount: Number(cosFiles?.fileCount || 0),
        latestFile: cosFiles?.files?.[0] || null,
      },
    };

    assert(cosStatus?.ok === true, "billing_cos_status_not_ok", evidence.preflight.cosStatus);
    assert(cosStatus?.readable === true, "billing_cos_status_not_readable", evidence.preflight.cosStatus);
    if (config.bucket) {
      assert(String(cosStatus?.bucket || "") === config.bucket, "billing_cos_bucket_mismatch", {
        expected: config.bucket,
        actual: String(cosStatus?.bucket || ""),
      });
    }
    if (config.region) {
      assert(String(cosStatus?.region || "") === config.region, "billing_cos_region_mismatch", {
        expected: config.region,
        actual: String(cosStatus?.region || ""),
      });
    }
    if (config.prefix) {
      assert(String(cosStatus?.prefix || "") === config.prefix, "billing_cos_prefix_mismatch", {
        expected: config.prefix,
        actual: String(cosStatus?.prefix || ""),
      });
    }
    if (config.endpoint) {
      assert(String(cosStatus?.endpoint || "") === config.endpoint, "billing_cos_endpoint_mismatch", {
        expected: config.endpoint,
        actual: String(cosStatus?.endpoint || ""),
      });
    }

    const files = Array.isArray(cosFiles?.files) ? cosFiles.files : [];
    const selectedFile = config.objectKey
      ? files.find((item) => String(item?.key || "") === config.objectKey) || null
      : files.find((item) => String(item?.key || "").startsWith(config.prefix)) || null;
    assert(selectedFile, "expected_cos_bill_file_not_found", {
      objectKey: config.objectKey,
      prefix: config.prefix,
      availableKeys: files.slice(0, 20).map((item) => item?.key).filter(Boolean),
    });
    assert(Number(selectedFile?.size || 0) > 0, "expected_cos_bill_file_empty", selectedFile);

    const attributedItems = Array.isArray(cosReconcile?.items) ? cosReconcile.items : [];
    const unattributedItems = Array.isArray(cosReconcile?.unattributed) ? cosReconcile.unattributed : [];
    const target = {
      tenantId: config.tenantId,
      workspaceId: config.workspaceId,
      resourceOrderId: config.resourceOrderId,
      runId: config.runId,
      serverPlanId: config.serverPlanId,
    };
    const matchedItem = attributedItems
      .map(normalizeCosItem)
      .find((item) => matchesCosTargetItem(item, target)) || null;

    evidence.cosReconcile = {
      ok: Boolean(cosReconcile?.ok),
      reconciled: Boolean(cosReconcile?.reconciled),
      preview: Boolean(cosReconcile?.preview),
      hasAttributableRows: Boolean(cosReconcile?.hasAttributableRows),
      exactSource: String(cosReconcile?.exactSource || ""),
      latestFile: cosReconcile?.latestFile || selectedFile,
      parsedRowCount: Number(cosReconcile?.parsedRowCount || 0),
      attributedCount: Number(cosReconcile?.attributedCount || 0),
      unattributedCount: Number(cosReconcile?.unattributedCount || 0),
      totalCost: Number(cosReconcile?.totalCost || 0),
      matchedItem,
    };

    assert(cosReconcile?.ok === true, "billing_cos_reconcile_not_ok", evidence.cosReconcile);
    assert(String(cosReconcile?.exactSource || "") === "tencent_cos_daily_bill", "unexpected_exact_source", {
      actual: String(cosReconcile?.exactSource || ""),
    });
    if (config.objectKey) {
      assert(String(cosReconcile?.latestFile?.key || "") === config.objectKey, "latest_cos_bill_file_mismatch", {
        expected: config.objectKey,
        actual: String(cosReconcile?.latestFile?.key || ""),
      });
    }

    if (!matchedItem) {
      evidence.diagnostics = {
        code: "exact_bill_target_not_attributed",
        unattributedSummary: summarizeMissingTags(unattributedItems),
        attributedExamples: attributedItems
          .map(normalizeCosItem)
          .slice(0, 10)
          .map((item) => ({
            tenantId: item.tenantId,
            workspaceId: item.workspaceId,
            resourceOrderId: item.resourceOrderId,
            runId: item.runId,
            serverPlanId: item.serverPlanId,
            totalCost: item.totalCost,
          })),
      };
      fail("exact_bill_target_not_attributed", evidence.diagnostics);
    }

    const reconcileBody = JSON.stringify({
      customer_id: config.tenantId,
      workspace_id: config.workspaceId,
      window: config.windowValue,
      ...(config.objectKey ? {
        objectKey: config.objectKey,
        COS_LIVE_BILL_OBJECT_KEY: config.objectKey,
      } : {}),
      ...(!config.objectKey && config.prefix ? { prefix: config.prefix } : {}),
    });

    const first = await requestJson(config, "/reconcile", {
      method: "POST",
      body: reconcileBody,
    });
    const second = await requestJson(config, "/reconcile", {
      method: "POST",
      body: reconcileBody,
    });

    const firstTarget = targetResult(first?.results, config.runId, config.workspaceId);
    const secondTarget = targetResult(second?.results, config.runId, config.workspaceId);
    evidence.reconcileRuns = [
      {
        attempt: 1,
        reconciledCount: Number(first?.reconciledCount || 0),
        exactCount: Number(first?.exactCount || 0),
        estimatedCount: Number(first?.estimatedCount || 0),
        adjustmentCount: Number(first?.adjustmentCount || 0),
        unattributedItemCount: Number(first?.unattributedSummary?.itemCount || 0),
        results: summarizeResults(first?.results),
        targetResult: firstTarget,
      },
      {
        attempt: 2,
        reconciledCount: Number(second?.reconciledCount || 0),
        exactCount: Number(second?.exactCount || 0),
        estimatedCount: Number(second?.estimatedCount || 0),
        adjustmentCount: Number(second?.adjustmentCount || 0),
        unattributedItemCount: Number(second?.unattributedSummary?.itemCount || 0),
        results: summarizeResults(second?.results),
        targetResult: secondTarget,
      },
    ];

    assert(firstTarget, "target_run_missing_from_first_reconcile", {
      runId: config.runId,
      workspaceId: config.workspaceId,
      results: summarizeResults(first?.results),
    });
    assert(settlementActions.has(String(firstTarget?.action || "")), "target_run_not_settled_on_first_reconcile", {
      runId: config.runId,
      workspaceId: config.workspaceId,
      action: String(firstTarget?.action || ""),
      results: summarizeResults(first?.results),
    });
    assert(!secondTarget || !settlementActions.has(String(secondTarget?.action || "")), "target_run_not_idempotent_on_second_reconcile", {
      runId: config.runId,
      workspaceId: config.workspaceId,
      secondTarget,
      results: summarizeResults(second?.results),
    });

    evidence.ok = true;
    evidence.finishedAt = new Date().toISOString();
    const evidencePath = await writeEvidence(evidence);
    console.log(JSON.stringify({
      ok: true,
      evidencePath,
      target: evidence.target,
      matchedItem: evidence.cosReconcile.matchedItem,
      reconcileRuns: evidence.reconcileRuns.map((item) => ({
        attempt: item.attempt,
        targetAction: item.targetResult?.action || "",
        exactCount: item.exactCount,
        resultsCount: item.results.length,
      })),
    }, null, 2));
  } catch (error) {
    evidence.ok = false;
    evidence.finishedAt = new Date().toISOString();
    evidence.diagnostics = {
      ...evidence.diagnostics,
      error: String(error?.message || error),
      details: error?.details || {},
    };
    const evidencePath = await writeEvidence(evidence);
    console.error(JSON.stringify({
      ok: false,
      evidencePath,
      error: evidence.diagnostics.error,
      diagnostics: evidence.diagnostics,
    }, null, 2));
    process.exitCode = 1;
  }
}

await main();
