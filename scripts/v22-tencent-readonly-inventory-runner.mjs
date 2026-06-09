#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "TENCENT_READONLY_ACCOUNT_ID",
  "TENCENT_READONLY_REGIONS",
  "TENCENT_READONLY_ALLOWED_APIS",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
  "LANGFUSE_SECRET_KEY",
  "GITHUB_TOKEN",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "KUBECONFIG",
]);

const FORBIDDEN_API_PREFIXES = [
  "Create",
  "Delete",
  "Modify",
  "Run",
  "Terminate",
  "Attach",
  "Detach",
  "Put",
  "Update",
  "TagResources",
  "UnTagResources",
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    liveReadonly: false,
    confirmAuthorization: false,
    sdkMode: "check-config",
    secretFile: "",
    reportDir: path.join(".runtime", "v22-tencent-readonly-inventory"),
    runId: `readonly-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--live-readonly") {
      options.liveReadonly = true;
    } else if (arg === "--confirm-current-session-authorization") {
      options.confirmAuthorization = true;
    } else if (arg === "--sdk-mode") {
      options.sdkMode = argv[++index] || "";
    } else if (arg === "--secret-file") {
      options.secretFile = argv[++index] || "";
    } else if (arg === "--report-dir") {
      options.reportDir = argv[++index] || "";
    } else if (arg === "--run-id") {
      options.runId = argv[++index] || "";
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`readonly_runner_unknown_arg:${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/v22-tencent-readonly-inventory-runner.mjs --secret-file <path>",
    "  node scripts/v22-tencent-readonly-inventory-runner.mjs --live-readonly --confirm-current-session-authorization --sdk-mode fake-readonly --secret-file <path>",
    "",
    "Modes:",
    "  check-config                     default; never reads secrets or calls cloud",
    "  fake-readonly                    local gate; reads allowlisted env file and writes redacted report",
    "  tencent-official-sdk-readonly    optional live path; fail-closed when SDK modules are unavailable",
  ].join("\n");
}

function parseEnv(content = "") {
  const env = new Map();
  for (const [lineIndex, line] of String(content).split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error(`readonly_secret_line_invalid:${lineIndex + 1}`);
    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (FORBIDDEN_SECRET_KEYS.has(key)) throw new Error(`readonly_secret_file_contains_forbidden_key:${key}`);
    if (!ALLOWED_SECRET_KEYS.has(key)) throw new Error(`readonly_secret_file_contains_non_allowlist_key:${key}`);
    env.set(key, value);
  }
  return env;
}

function value(env, key) {
  return String(env.get(key) || "").trim();
}

function splitCsv(text = "") {
  return String(text)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateReadonlyEnv(env) {
  for (const key of ALLOWED_SECRET_KEYS) {
    if (!value(env, key)) throw new Error(`readonly_secret_required:${key}`);
  }
  if (!["1", "true", "yes"].includes(value(env, "RUN_TENCENT_READONLY_INVENTORY").toLowerCase())) {
    throw new Error("readonly_run_gate_disabled");
  }
  const regions = splitCsv(value(env, "TENCENT_READONLY_REGIONS"));
  if (!regions.length) throw new Error("readonly_regions_required");
  const allowedApis = splitCsv(value(env, "TENCENT_READONLY_ALLOWED_APIS"));
  if (!allowedApis.length) throw new Error("readonly_allowed_apis_required");
  for (const api of allowedApis) {
    const normalized = api.replace(/\*$/u, "");
    if (FORBIDDEN_API_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      throw new Error(`readonly_allowed_api_contains_forbidden_verb:${api}`);
    }
  }
  if (!allowedApis.every((api) => /^(?:Describe|List|Get|Head)[A-Za-z0-9*]*$/u.test(api))) {
    throw new Error("readonly_allowed_apis_must_be_describe_list_get_head");
  }
  return { regions, allowedApis };
}

function maskAccount(accountId = "") {
  const text = String(accountId).trim();
  if (text.length <= 8) return "redacted";
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function redactedReport({ env, regions, allowedApis, sdkMode, runId, resources = [], blockers = [] }) {
  return {
    ok: blockers.length === 0,
    runId,
    generatedAt: new Date().toISOString(),
    sdkMode,
    liveReadonly: sdkMode !== "check-config",
    accountMasked: maskAccount(value(env, "TENCENT_READONLY_ACCOUNT_ID")),
    regions,
    allowedApis,
    credentials: {
      secretId: "redacted",
      secretKey: "redacted",
    },
    boundary: {
      callsMutationApi: false,
      readsCosObjectBody: false,
      writesGit: false,
      callsKubectl: false,
      buildsOrPushesImage: false,
      outputRedactionRequired: true,
    },
    resources,
    blockers,
  };
}

function fakeResources(regions = []) {
  return regions.flatMap((region) => [
    {
      region,
      resourceType: "accountSummary",
      resourceStatus: "observed",
      tagCompleteness: "not_applicable",
      portalMappingStatus: "not_checked_without_portal_ledger",
    },
    {
      region,
      resourceType: "tkeClusterSummary",
      resourceStatus: "not_observed_in_fake_mode",
      tagCompleteness: "not_checked",
      portalMappingStatus: "not_checked_without_portal_ledger",
    },
    {
      region,
      resourceType: "cosStorageSummary",
      resourceStatus: "not_observed_in_fake_mode",
      tagCompleteness: "not_checked",
      portalMappingStatus: "not_checked_without_portal_ledger",
      readsObjectBody: false,
    },
    {
      region,
      resourceType: "billingTagSummary",
      resourceStatus: "not_observed_in_fake_mode",
      tagCompleteness: "not_checked",
      portalMappingStatus: "not_checked_without_portal_ledger",
    },
  ]);
}

async function officialSdkResources({ regions }) {
  let tencentRoot;
  let cosRoot;
  const blockers = [];
  try {
    tencentRoot = await import("tencentcloud-sdk-nodejs");
  } catch {
    blockers.push({
      code: "tencentcloud_sdk_missing",
      message: "tencentcloud-sdk-nodejs is required for official live readonly account/TKE/billing/tag inventory",
    });
  }
  try {
    cosRoot = await import("cos-nodejs-sdk-v5");
  } catch {
    blockers.push({
      code: "cos_sdk_missing",
      message: "cos-nodejs-sdk-v5 is required for COS metadata-only inventory; COS object body remains unread",
    });
  }
  if (blockers.length) return { resources: [], blockers };
  return {
    resources: regions.flatMap((region) => [
      {
        region,
        resourceType: "officialSdkShapeSummary",
        resourceStatus: "sdk_modules_available",
        tagCompleteness: "not_checked_without_live_client_call",
        portalMappingStatus: "not_checked_without_portal_ledger",
        tencentSdkLoaded: Boolean(tencentRoot),
        cosSdkLoaded: Boolean(cosRoot),
        readsObjectBody: false,
      },
    ]),
    blockers: [
      {
        code: "official_live_client_not_implemented",
        message: "official SDK modules are available, but this runner still requires a reviewed client wrapper before real cloud calls",
      },
    ],
  };
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.secretFile) throw new Error("readonly_secret_file_required");
  if (!options.liveReadonly || !options.confirmAuthorization) {
    throw new Error("readonly_live_authorization_required");
  }
  const env = parseEnv(await readFile(options.secretFile, "utf8"));
  const { regions, allowedApis } = validateReadonlyEnv(env);
  let resources = [];
  let blockers = [];
  if (options.sdkMode === "fake-readonly") {
    resources = fakeResources(regions);
  } else if (options.sdkMode === "tencent-official-sdk-readonly") {
    ({ resources, blockers } = await officialSdkResources({ regions }));
  } else {
    throw new Error(`readonly_sdk_mode_unsupported:${options.sdkMode}`);
  }
  const report = redactedReport({
    env,
    regions,
    allowedApis,
    sdkMode: options.sdkMode,
    runId: options.runId,
    resources,
    blockers,
  });
  await mkdir(options.reportDir, { recursive: true });
  const reportPath = path.join(options.reportDir, `${options.runId}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: report.ok,
    liveReadonly: true,
    sdkMode: options.sdkMode,
    reportPath,
    callsMutationApi: false,
    readsCosObjectBody: false,
    blockers,
  }, null, 2));
  if (!report.ok) process.exitCode = 2;
}

main().catch((error) => {
  console.error(String(error?.message || "readonly_runner_failed"));
  process.exitCode = 1;
});
