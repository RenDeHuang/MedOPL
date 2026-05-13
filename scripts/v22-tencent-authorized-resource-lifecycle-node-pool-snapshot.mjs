#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseTencentMutationSecretFile } from "./v22-tencent-authorized-resource-lifecycle-runner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const portalRequire = createRequire(path.join(repoRoot, "services", "portal", "package.json"));

const REQUIRED_KEYS = Object.freeze([
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "TENCENT_MUTATION_ALLOWED_APIS",
  "TENCENT_MUTATION_REGIONS",
  "TENCENT_MUTATION_ACCOUNT_ID",
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function listFromCsv(value = "") {
  return text(value)
    .split(",")
    .map((item) => text(item))
    .filter(Boolean);
}

function maskIdentifier(value = "") {
  const normalized = text(value);
  if (!normalized) return "missing";
  if (normalized.length <= 4) return "****";
  return `${normalized.slice(0, Math.max(0, normalized.length - 4))}****${normalized.slice(-4)}`;
}

function safeRunId(value = "") {
  const normalized = text(value || new Date().toISOString().replace(/[:.]/g, "-")).replace(/[^a-zA-Z0-9_.-]/g, "-");
  if (!normalized) throw new Error("node_pool_snapshot_run_id_required");
  return normalized;
}

function parseNonNegativeInteger(value = "", key = "capacity") {
  const normalized = text(value);
  if (!/^[0-9]+$/.test(normalized)) throw new Error(`node_pool_snapshot_${key}_required`);
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) throw new Error(`node_pool_snapshot_${key}_invalid`);
  return parsed;
}

function parseArgs(argv = []) {
  const options = {
    mode: "",
    sdkMode: "",
    secretFile: "",
    runId: "",
    expectedDesiredCapacity: "",
    expectedCurrentCapacity: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--snapshot") {
      options.mode = "snapshot";
      continue;
    }
    if (arg === "--sdk-mode") {
      options.sdkMode = text(argv[index + 1]);
      index += 1;
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
    if (arg === "--expected-desired-capacity") {
      options.expectedDesiredCapacity = text(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--expected-current-capacity") {
      options.expectedCurrentCapacity = text(argv[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`node_pool_snapshot_unknown_arg:${arg}`);
  }
  if (options.mode !== "snapshot") throw new Error("node_pool_snapshot_mode_required");
  if (!["fake-live", "tencent-official-sdk-live"].includes(options.sdkMode)) throw new Error("node_pool_snapshot_sdk_mode_required");
  if (!options.secretFile) throw new Error("node_pool_snapshot_secret_file_required");
  parseNonNegativeInteger(options.expectedDesiredCapacity, "expected_desired_capacity");
  parseNonNegativeInteger(options.expectedCurrentCapacity, "expected_current_capacity");
  return options;
}

function validateEnv(env = {}) {
  const missingKeys = REQUIRED_KEYS.filter((key) => !text(env[key]));
  if (missingKeys.length > 0) throw new Error("node_pool_snapshot_secret_allowlist_incomplete");
  const runGateEnabled = ["1", "true"].includes(text(env.RUN_TENCENT_CREATE_RELEASE_EXECUTION).toLowerCase());
  if (!runGateEnabled) throw new Error("node_pool_snapshot_mutation_gate_disabled");
  const allowedApis = new Set(listFromCsv(env.TENCENT_MUTATION_ALLOWED_APIS));
  if (!allowedApis.has("DescribeNodePools")) throw new Error("node_pool_snapshot_describe_nodepools_not_allowlisted");
  const regions = listFromCsv(env.TENCENT_MUTATION_REGIONS);
  if (!regions.length) throw new Error("node_pool_snapshot_region_allowlist_required");
  return {
    regions,
    accountMasked: maskIdentifier(env.TENCENT_MUTATION_ACCOUNT_ID),
    tkeClusterMasked: maskIdentifier(env.TENCENT_MUTATION_TKE_CLUSTER_ID),
    tkeNodePoolMasked: maskIdentifier(env.TENCENT_MUTATION_TKE_NODE_POOL_ID),
  };
}

function nativeReplicaSummary(nodePool = {}) {
  const native = nodePool.Native || {};
  return {
    nodePoolDesiredCapacity: Number(native.Replicas ?? 0),
    nodePoolCurrentCapacity: Number(native.ReadyReplicas ?? 0),
    nodePoolJoiningCapacity: Number(native.JoiningReplicas ?? 0),
    nodePoolMinReplicas: Number(native.Scaling?.MinReplicas ?? 0),
    nodePoolMaxReplicas: Number(native.Scaling?.MaxReplicas ?? 0),
  };
}

async function describeLiveNodePool(env = {}, envSummary = {}) {
  const tencentcloud = portalRequire("tencentcloud-sdk-nodejs");
  const TkeClient = tencentcloud?.tke?.v20220501?.Client;
  if (typeof TkeClient !== "function") throw new Error("node_pool_snapshot_tke_client_required");
  const client = new TkeClient({
    credential: {
      secretId: text(env.TENCENT_MUTATION_SECRET_ID),
      secretKey: text(env.TENCENT_MUTATION_SECRET_KEY),
    },
    region: envSummary.regions[0],
    profile: { httpProfile: { endpoint: "tke.tencentcloudapi.com" } },
  });
  const response = await client.DescribeNodePools({
    ClusterId: text(env.TENCENT_MUTATION_TKE_CLUSTER_ID),
    Filters: [{
      Name: "NodePoolsId",
      Values: [text(env.TENCENT_MUTATION_TKE_NODE_POOL_ID)],
    }],
    Offset: 0,
    Limit: 100,
  });
  const nodePool = (Array.isArray(response.NodePools) ? response.NodePools : [])
    .find((item) => text(item.NodePoolId) === text(env.TENCENT_MUTATION_TKE_NODE_POOL_ID));
  if (!nodePool) throw new Error("node_pool_snapshot_tke_node_pool_not_found");
  if (text(nodePool.Type) && text(nodePool.Type) !== "Native") {
    throw new Error(`node_pool_snapshot_tke_node_pool_type_unsupported:${text(nodePool.Type)}`);
  }
  return nativeReplicaSummary(nodePool);
}

async function describeNodePool(env = {}, envSummary = {}, options = {}) {
  if (options.sdkMode === "fake-live") {
    return {
      nodePoolDesiredCapacity: 2,
      nodePoolCurrentCapacity: 2,
      nodePoolJoiningCapacity: 0,
      nodePoolMinReplicas: 0,
      nodePoolMaxReplicas: 100,
    };
  }
  return describeLiveNodePool(env, envSummary);
}

function blockedReasonForCapacity(summary = {}, expected = {}) {
  if (summary.nodePoolDesiredCapacity !== expected.desired) return "node_pool_desired_capacity_not_baseline";
  if (summary.nodePoolCurrentCapacity !== expected.current) return "node_pool_current_capacity_not_baseline";
  if (summary.nodePoolJoiningCapacity !== 0) return "node_pool_joining_capacity_not_zero";
  return null;
}

function summaryFor({ options = {}, envSummary = {}, observed = {}, blockedReason = null, reportPath = "" } = {}) {
  return {
    ok: !blockedReason,
    mode: "snapshot",
    artifactPath: reportPath,
    providerMode: options.sdkMode,
    nodePoolDesiredCapacity: observed.nodePoolDesiredCapacity,
    nodePoolCurrentCapacity: observed.nodePoolCurrentCapacity,
    nodePoolJoiningCapacity: observed.nodePoolJoiningCapacity,
    nodePoolMinReplicas: observed.nodePoolMinReplicas,
    nodePoolMaxReplicas: observed.nodePoolMaxReplicas,
    expectedDesiredCapacity: parseNonNegativeInteger(options.expectedDesiredCapacity, "expected_desired_capacity"),
    expectedCurrentCapacity: parseNonNegativeInteger(options.expectedCurrentCapacity, "expected_current_capacity"),
    cleanupGateBaseline: true,
    risk: {
      callsRealCloudNow: options.sdkMode === "tencent-official-sdk-live",
      executesMutationNow: false,
      accountMasked: envSummary.accountMasked,
      regions: envSummary.regions,
      tkeClusterMasked: envSummary.tkeClusterMasked,
      tkeNodePoolMasked: envSummary.tkeNodePoolMasked,
      requiredApis: ["DescribeNodePools"],
    },
    blockedReason,
  };
}

async function writeReport(summary = {}, reportPath = "") {
  const absolutePath = path.join(repoRoot, reportPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = parseTencentMutationSecretFile(await readFile(options.secretFile, "utf8"));
  const envSummary = validateEnv(env);
  const reportPath = `.runtime/v22-cloud-cleanup/${safeRunId(options.runId)}-node-pool-snapshot.json`;
  const observed = await describeNodePool(env, envSummary, options);
  const expected = {
    desired: parseNonNegativeInteger(options.expectedDesiredCapacity, "expected_desired_capacity"),
    current: parseNonNegativeInteger(options.expectedCurrentCapacity, "expected_current_capacity"),
  };
  const blockedReason = blockedReasonForCapacity(observed, expected);
  const summary = summaryFor({ options, envSummary, observed, blockedReason, reportPath });
  await writeReport(summary, reportPath);
  console.log(JSON.stringify({ ok: summary.ok, reportPath, summary }, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: text(error?.message || error),
  }, null, 2));
  process.exitCode = 1;
});
