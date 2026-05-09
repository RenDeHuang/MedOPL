#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectTencentReadonlyInventory, createTencentReadonlyInventoryLiveAdapter } from "../services/portal/src/domain/tencent-readonly-inventory-live-adapter.mjs";
import { validateReadonlyInventorySecretEnv } from "../services/portal/src/domain/tencent-readonly-inventory-provider.mjs";
import { createTencentReadonlyInventoryRealSdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-real-sdk-client.mjs";
import { createTencentReadonlyInventorySdkClient } from "../services/portal/src/domain/tencent-readonly-inventory-sdk-client.mjs";
import { createTencentReadonlyInventoryTc3Modules } from "../services/portal/src/domain/tencent-readonly-inventory-tc3-modules.mjs";
import { createTencentReadonlyInventoryTencentSdkFactory } from "../services/portal/src/domain/tencent-readonly-inventory-tencent-sdk-factory.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const reportRoot = path.join(repoRoot, ".runtime", "v22-tencent-readonly-inventory");

const READONLY_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "TENCENT_READONLY_REGIONS",
  "TENCENT_READONLY_ALLOWED_APIS",
  "TENCENT_READONLY_ACCOUNT_ID",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE",
  "LANGFUSE_SECRET_KEY",
  "GITHUB_TOKEN",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "kubeconfig",
  "raw API Key",
  "rawApiKey",
  "apiKey",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function parseArgs(argv = []) {
  const options = {
    mode: "",
    secretFile: "",
    runId: "",
    sdkMode: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check-config" || arg === "--fake-live" || arg === "--live-readonly") {
      options.mode = arg.slice(2);
      continue;
    }
    if (arg === "--secret-file") {
      options.secretFile = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--run-id") {
      options.runId = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--sdk-mode") {
      options.sdkMode = text(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`readonly_inventory_runner_unknown_arg:${arg}`);
  }
  if (!options.mode) throw new Error("readonly_inventory_runner_mode_required");
  if (!options.secretFile) throw new Error("readonly_inventory_runner_secret_file_required");
  return options;
}

function parseLine(line = "") {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const equalsIndex = trimmed.indexOf("=");
  if (equalsIndex <= 0) {
    throw new Error("readonly_inventory_secret_line_invalid");
  }
  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function parseReadonlyInventorySecretFile(content = "") {
  const env = {};
  for (const line of String(content).split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      throw new Error(`readonly_inventory_forbidden_secret_key:${key}`);
    }
    if (!READONLY_SECRET_KEYS.has(key)) {
      throw new Error(`readonly_inventory_non_allowlist_secret_key_rejected:${key}`);
    }
    env[key] = value;
  }
  return env;
}

function safeSummary({ envSummary, mode, ok, blockedReason = null, inventory = null } = {}) {
  const mapped = Number(inventory?.portalMappingStatus?.mapped || 0);
  const auditRequired = Number(inventory?.portalMappingStatus?.audit_required || 0);
  return {
    accountMasked: envSummary?.accountMasked || "missing",
    regions: Array.isArray(envSummary?.regions) ? envSummary.regions : [],
    allowedApis: Array.isArray(envSummary?.allowedApis) ? envSummary.allowedApis : [],
    mode,
    ok,
    auditQueueCounts: {
      auditRequired,
      missingTagCount: Number(inventory?.missingTagCount || 0),
      orphanResourceCount: Number(inventory?.orphanResourceCount || 0),
      conflictCount: Number(inventory?.conflictCount || 0),
    },
    resourceCounts: {
      mapped,
      auditRequired,
    },
    blockedReason,
  };
}

function blockedSummary({ envSummary, mode, blockedReason }) {
  return safeSummary({
    envSummary,
    mode,
    ok: false,
    blockedReason,
  });
}

function timestampRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeReport(summary, runId = "") {
  await mkdir(reportRoot, { recursive: true });
  const safeRunId = text(runId || timestampRunId()).replace(/[^a-zA-Z0-9_.-]/g, "-");
  const reportPath = path.join(reportRoot, `${safeRunId}.json`);
  await writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return reportPath;
}

function ownershipTags(overrides = {}) {
  return {
    accountId: "acct-001",
    workspaceId: "workspace-001",
    resourceOrderId: "order-001",
    resourceBindingId: "binding-001",
    serverPlanId: "pro_8c16g_100gb",
    runId: "",
    resourceType: "compute",
    region: "ap-guangzhou",
    ...overrides,
  };
}

function createFakeSdk() {
  const pages = {
    DescribeInstances: {
      "ap-guangzhou:": {
        items: [
          {
            InstanceId: "ins-001",
            InstanceState: "running",
            Tags: ownershipTags(),
          },
        ],
        NextToken: "",
      },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    DescribeClusters: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    ListBuckets: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": {
        items: [
          {
            BucketRef: "bucket-001",
            PrefixRef: "prefix-001",
            Status: "available",
            Tags: ownershipTags({
              resourceOrderId: "order-storage-001",
              resourceBindingId: "binding-storage-001",
              serverPlanId: "storage_100gb",
              runId: "run-001",
              resourceType: "file_space",
              region: "ap-shanghai",
            }),
          },
        ],
        NextToken: "",
      },
    },
    DescribeBillSummary: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
    DescribeTagResources: {
      "ap-guangzhou:": { items: [], NextToken: "" },
      "ap-shanghai:": { items: [], NextToken: "" },
    },
  };

  function page(apiName, params = {}) {
    const key = `${params.Region || ""}:${params.Cursor || ""}`;
    return pages[apiName]?.[key] || { items: [], NextToken: "" };
  }

  return Object.freeze({
    DescribeAccount() {
      return {
        AccountId: "tencent-account-1234567890",
      };
    },
    DescribeRegions() {
      return {
        Regions: [{ Region: "ap-guangzhou" }, { Region: "ap-shanghai" }],
      };
    },
    DescribeInstances(params) {
      return page("DescribeInstances", params);
    },
    DescribeClusters(params) {
      return page("DescribeClusters", params);
    },
    ListBuckets(params) {
      return page("ListBuckets", params);
    },
    HeadObject() {
      return {
        Exists: true,
        MetadataSummary: { sizeBytes: 4096 },
        BillingSummary: { amountCny: "0.00" },
      };
    },
    DescribeBillSummary(params) {
      return page("DescribeBillSummary", params);
    },
    DescribeTagResources(params) {
      return page("DescribeTagResources", params);
    },
  });
}

const portalLedger = Object.freeze({
  resources: [
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      resourceOrderId: "order-001",
      resourceBindingId: "binding-001",
      serverPlanId: "pro_8c16g_100gb",
      runId: "",
      resourceType: "compute",
      region: "ap-guangzhou",
    },
    {
      accountId: "acct-001",
      workspaceId: "workspace-001",
      resourceOrderId: "order-storage-001",
      resourceBindingId: "binding-storage-001",
      serverPlanId: "storage_100gb",
      runId: "run-001",
      resourceType: "file_space",
      region: "ap-shanghai",
    },
  ],
});

async function loadSecretEnv(secretFile) {
  const content = await readFile(secretFile, "utf8");
  return parseReadonlyInventorySecretFile(content);
}

async function runCheckConfig({ env, runId }) {
  void runId;
  const envSummary = validateReadonlyInventorySecretEnv(env);
  const blockedReason = envSummary.enabled ? null : "run_gate_disabled";
  return {
    reportPath: null,
    summary: blockedReason
      ? blockedSummary({ envSummary, mode: "check-config", blockedReason })
      : safeSummary({ envSummary, mode: "check-config", ok: true }),
  };
}

async function runFakeLive({ env, runId }) {
  const envSummary = validateReadonlyInventorySecretEnv(env);
  if (!envSummary.enabled) {
    return {
      reportPath: null,
      summary: blockedSummary({ envSummary, mode: "fake-live", blockedReason: "run_gate_disabled" }),
    };
  }
  const client = createTencentReadonlyInventorySdkClient({
    sdk: createFakeSdk(),
    credentials: {
      id: env.TENCENT_READONLY_SECRET_ID,
      key: env.TENCENT_READONLY_SECRET_KEY,
    },
    accountId: env.TENCENT_READONLY_ACCOUNT_ID,
    allowedApis: envSummary.allowedApis,
    regions: envSummary.regions,
  });
  const adapter = createTencentReadonlyInventoryLiveAdapter({ client });
  const inventory = await collectTencentReadonlyInventory({ adapter, env, portalLedger });
  const summary = safeSummary({ envSummary, mode: "fake-live", ok: true, inventory });
  const reportPath = await writeReport(summary, runId);
  return { reportPath, summary };
}

async function runLiveReadonly({ env, runId, sdkMode }) {
  const envSummary = validateReadonlyInventorySecretEnv(env);
  if (!envSummary.enabled) {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "live_readonly_requires_run_gate",
        }),
      },
    };
  }
  if (sdkMode === "fake-real-sdk") {
    const client = createTencentReadonlyInventoryRealSdkClient({
      sdkFactory: () => createFakeSdk(),
      credentials: {
        id: env.TENCENT_READONLY_SECRET_ID,
        key: env.TENCENT_READONLY_SECRET_KEY,
      },
      accountId: env.TENCENT_READONLY_ACCOUNT_ID,
      allowedApis: envSummary.allowedApis,
      regions: envSummary.regions,
    });
    const adapter = createTencentReadonlyInventoryLiveAdapter({ client });
    const inventory = await collectTencentReadonlyInventory({ adapter, env, portalLedger });
    const summary = safeSummary({ envSummary, mode: "live-readonly", ok: true, inventory });
    const reportPath = await writeReport(summary, runId);
    return {
      status: 0,
      payload: { reportPath, summary },
    };
  }
  if (sdkMode !== "tencent-real-readonly") {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "live_readonly_requires_separate_authorization",
        }),
      },
    };
  }
  return {
    status: 1,
    payload: {
      reportPath: null,
      summary: blockedSummary({
        envSummary,
        mode: "live-readonly",
        blockedReason: "tencent_readonly_sdk_modules_required",
      }),
    },
  };
}

async function runTencentRealReadonly({ env, runId, tencentSdkModules }) {
  const envSummary = validateReadonlyInventorySecretEnv(env);
  if (!envSummary.enabled) {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "live_readonly_requires_run_gate",
        }),
      },
    };
  }
  if (!envSummary.regions.length) {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "readonly_inventory_regions_required",
        }),
      },
    };
  }
  if (!tencentSdkModules) {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "tencent_readonly_sdk_modules_required",
        }),
      },
    };
  }
  const sdkFactory = createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: tencentSdkModules,
  });
  const client = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory,
    credentials: {
      SecretId: env.TENCENT_READONLY_SECRET_ID,
      SecretKey: env.TENCENT_READONLY_SECRET_KEY,
    },
    accountId: env.TENCENT_READONLY_ACCOUNT_ID,
    allowedApis: envSummary.allowedApis,
    regions: envSummary.regions,
  });
  const adapter = createTencentReadonlyInventoryLiveAdapter({ client });
  const inventory = await collectTencentReadonlyInventory({ adapter, env, portalLedger });
  const summary = safeSummary({ envSummary, mode: "live-readonly", ok: true, inventory });
  const reportPath = await writeReport(summary, runId);
  return {
    status: 0,
    payload: { reportPath, summary },
  };
}

async function runTencentTc3Readonly({ env, runId, tc3Fetch, tc3Now }) {
  const envSummary = validateReadonlyInventorySecretEnv(env);
  if (!envSummary.enabled) {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "live_readonly_requires_run_gate",
        }),
      },
    };
  }
  if (!envSummary.regions.length) {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "readonly_inventory_regions_required",
        }),
      },
    };
  }
  if (typeof tc3Fetch !== "function") {
    return {
      status: 1,
      payload: {
        reportPath: null,
        summary: blockedSummary({
          envSummary,
          mode: "live-readonly",
          blockedReason: "tencent_readonly_tc3_fetch_required",
        }),
      },
    };
  }
  const sdkFactory = createTencentReadonlyInventoryTencentSdkFactory({
    sdkModules: createTencentReadonlyInventoryTc3Modules({
      fetchImpl: tc3Fetch,
      now: typeof tc3Now === "function" ? tc3Now : undefined,
    }),
  });
  const client = createTencentReadonlyInventoryRealSdkClient({
    sdkFactory,
    credentials: {
      SecretId: env.TENCENT_READONLY_SECRET_ID,
      SecretKey: env.TENCENT_READONLY_SECRET_KEY,
    },
    accountId: env.TENCENT_READONLY_ACCOUNT_ID,
    allowedApis: envSummary.allowedApis,
    regions: envSummary.regions,
  });
  const adapter = createTencentReadonlyInventoryLiveAdapter({ client });
  const inventory = await collectTencentReadonlyInventory({ adapter, env, portalLedger });
  const summary = safeSummary({ envSummary, mode: "live-readonly", ok: true, inventory });
  const reportPath = await writeReport(summary, runId);
  return {
    status: 0,
    payload: { reportPath, summary },
  };
}

export async function runCli(argv = [], { tencentSdkModules, tc3Fetch, tc3Now } = {}) {
  const options = parseArgs(argv);
  const env = await loadSecretEnv(options.secretFile);
  if (options.mode === "check-config") {
    return { status: 0, payload: await runCheckConfig({ env, runId: options.runId }) };
  }
  if (options.mode === "fake-live") {
    return { status: 0, payload: await runFakeLive({ env, runId: options.runId }) };
  }
  if (options.mode === "live-readonly") {
    if (options.sdkMode === "tencent-real-readonly" && tencentSdkModules) {
      return runTencentRealReadonly({ env, runId: options.runId, tencentSdkModules });
    }
    if (options.sdkMode === "tencent-tc3-readonly") {
      return runTencentTc3Readonly({ env, runId: options.runId, tc3Fetch, tc3Now });
    }
    return runLiveReadonly({ env, runId: options.runId, sdkMode: options.sdkMode });
  }
  throw new Error(`readonly_inventory_runner_unknown_mode:${options.mode}`);
}

async function main() {
  try {
    const result = await runCli(globalThis.process.argv.slice(2));
    globalThis.process.stdout.write(`${JSON.stringify(result.payload)}\n`);
    globalThis.process.exitCode = result.status;
  } catch (error) {
    const payload = {
      reportPath: null,
      summary: {
        accountMasked: "missing",
        regions: [],
        allowedApis: [],
        mode: "error",
        ok: false,
        auditQueueCounts: {
          auditRequired: 0,
          missingTagCount: 0,
          orphanResourceCount: 0,
          conflictCount: 0,
        },
        resourceCounts: {
          mapped: 0,
          auditRequired: 0,
        },
        blockedReason: text(error.message || "readonly_inventory_runner_error"),
      },
    };
    globalThis.process.stdout.write(`${JSON.stringify(payload)}\n`);
    globalThis.process.exitCode = 1;
  }
}

if (import.meta.url === `file://${globalThis.process.argv[1]}`) {
  await main();
}
