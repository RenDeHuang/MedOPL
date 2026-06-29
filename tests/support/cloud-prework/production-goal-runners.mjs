#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const COMMAND_ENV_BY_OPERATION = Object.freeze({
  tenant_runtime_provisioning: "V22_TENCENT_RUNTIME_PROVISIONING_COMMAND",
  real_tke_runtime_node_lifecycle: "V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_COMMAND",
  storage_lifecycle: "V22_TENCENT_STORAGE_LIFECYCLE_COMMAND",
  billing_audit_writeback: "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_COMMAND",
  build_push: "V22_CONTAINER_BUILD_PUSH_COMMAND",
  kubectl: "V22_KUBERNETES_APPLY_COMMAND",
  deploy: "V22_MEDOPL_DEPLOY_COMMAND",
  live_test: "V22_OPL_WEBUI_CONSUMER_CANARY_COMMAND",
});

const RECEIPT_OWNER_BY_TYPE = Object.freeze({
  runtime_owner_receipt: "MedOPL Runtime",
  storage_owner_receipt: "MedOPL Storage",
  billing_owner_receipt: "MedOPL Billing",
  audit_owner_receipt: "MedOPL Audit",
  release_owner_receipt: "MedOPL Release",
  opl_webui_consumer_receipt: "OPL-Webui Consumer",
  production_deploy_receipt: "MedOPL Deploy",
});

const EXPECTED_INPUT_KEYS = Object.freeze({
  tenant_runtime_provisioning: Object.freeze(["operationClass", "planFile", "secretFile"]),
  real_tke_runtime_node_lifecycle: Object.freeze(["operationClass", "planFile", "secretFile"]),
  storage_lifecycle: Object.freeze(["operationClass", "planFile", "secretFile"]),
  billing_audit_writeback: Object.freeze(["databaseUrlRef", "operationClass", "receiptFile"]),
  build_push: Object.freeze(["buildContext", "imageRef", "operationClass", "registryCredentialRef"]),
  kubectl: Object.freeze(["kubeconfigRef", "kubernetesManifestDir", "operationClass"]),
  deploy: Object.freeze(["deployPlanFile", "kubeconfigRef", "operationClass"]),
  live_test: Object.freeze(["medoplPublicBaseUrl", "operationClass", "oplWebuiConsumerCanaryUrl"]),
});

function parseArgs(argv = process.argv.slice(2)) {
  const options = { operation: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--operation") {
      options.operation = argv[index + 1] || "";
      index += 1;
    } else if (item === "--help" || item === "-h") {
      options.help = true;
    } else {
      throw new Error(`production_goal_runner_unknown_arg:${item}`);
    }
  }
  return options;
}

function usage() {
  return [
    "Usage:",
    "  node tests/support/cloud-prework/production-goal-runners.mjs",
    "  node tests/support/cloud-prework/production-goal-runners.mjs --operation <operation_class>",
    "",
    "The runner reads V22_GOAL_* context from the cloud authorized executor and dispatches",
    "to the operation-specific command env. The command must print JSON with ok=true.",
  ].join("\n");
}

function parseJsonEnv(name, fallback) {
  try {
    return JSON.parse(process.env[name] || "");
  } catch {
    return fallback;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJsonParse(text = "") {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function secretValuesForRedaction() {
  return [
    "TENCENT_READONLY_SECRET_ID",
    "TENCENT_READONLY_SECRET_KEY",
    "TENCENT_MUTATION_SECRET_ID",
    "TENCENT_MUTATION_SECRET_KEY",
    "TENCENT_DEPLOY_KUBECONFIG_REF",
    "TCR_ID",
    "TCR_SECRET",
    "DATABASE_URL",
  ]
    .map((key) => String(process.env[key] || "").trim())
    .filter((value) => value.length >= 4);
}

function redactText(value = "") {
  let redacted = String(value || "")
    .replace(/SecretId/gu, "SecretRef")
    .replace(/SecretKey/gu, "SecretRef")
    .replace(/rawResponse/gu, "redacted_raw_response")
    .replace(/provider_response/gu, "provider_summary")
    .replace(/postgres(?:ql)?:\/\/[^\s"]+/giu, "DATABASE_URL_REF")
    .replace(/token/giu, "redacted_token_ref")
    .replace(/password/giu, "redacted_password_ref");
  for (const secret of secretValuesForRedaction()) {
    redacted = redacted.split(secret).join("redacted_secret_ref");
  }
  return redacted;
}

function redactValues(value) {
  if (Array.isArray(value)) return value.map((item) => redactValues(item));
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactValues(child)]));
  }
  if (typeof value !== "string") return value;
  return redactText(value);
}

function writeJson(payload, status = 0) {
  process.stdout.write(`${JSON.stringify(redactValues(payload), null, 2)}\n`);
  process.exit(status);
}

function fail(blocker, details = {}, status = 1) {
  process.stderr.write(`${blocker}\n`);
  writeJson({
    ok: false,
    summary: {
      blocker,
      ...details,
      productionComplete: false,
    },
    receipts: [],
  }, status);
}

function operationClass(options) {
  return String(options.operation || process.env.V22_GOAL_OPERATION_CLASS || "").trim();
}

function commandEnvKey(operation) {
  return COMMAND_ENV_BY_OPERATION[operation] || "";
}

function commandFor(operation) {
  const envKey = commandEnvKey(operation);
  return String(process.env[envKey] || process.env.V22_PRODUCTION_GOAL_COMMAND || "").trim();
}

function sortedKeys(value) {
  return Object.keys(value || {}).sort();
}

function validateInputRefs(operation, inputs) {
  const expected = EXPECTED_INPUT_KEYS[operation] || [];
  const actual = sortedKeys(inputs);
  if (expected.join("\u0000") !== actual.join("\u0000")) {
    fail("production_goal_runner_input_refs_mismatch", {
      operationClass: operation,
      expectedInputKeys: expected,
      actualInputKeys: actual,
    }, 65);
  }
  for (const key of ["planFile", "receiptFile", "deployPlanFile"]) {
    if (inputs[key] && !existsSync(path.resolve(String(inputs[key])))) {
      fail("production_goal_runner_input_file_missing", {
        operationClass: operation,
        inputKey: key,
      }, 65);
    }
  }
  for (const key of ["kubernetesManifestDir", "buildContext"]) {
    if (inputs[key] && !existsSync(path.resolve(String(inputs[key])))) {
      fail("production_goal_runner_input_directory_missing", {
        operationClass: operation,
        inputKey: key,
      }, 65);
    }
  }
}

function runStructuredCommand(command, operation) {
  const result = spawnSync(command, {
    shell: true,
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      V22_GOAL_OPERATION_CLASS: operation,
    },
  });
  if (result.status !== 0) {
    fail("production_goal_runner_command_failed", {
      operationClass: operation,
      status: result.status ?? 1,
      stdoutSummary: redactText((result.stdout || "").slice(0, 3000)),
      stderrSummary: redactText((result.stderr || "").slice(0, 3000)),
    }, result.status ?? 1);
  }
  const parsed = safeJsonParse(result.stdout || "{}");
  if (!parsed.ok || !isObject(parsed.value)) {
    fail("production_goal_runner_command_output_not_json", {
      operationClass: operation,
      stdoutSummary: redactText((result.stdout || "").slice(0, 3000)),
      stderrSummary: redactText((result.stderr || "").slice(0, 3000)),
    }, 66);
  }
  if (parsed.value.ok !== true) {
    fail("production_goal_runner_command_not_ok", {
      operationClass: operation,
      commandSummary: redactValues(parsed.value.summary || {}),
    }, 67);
  }
  return parsed.value;
}

function receiptSummary(type, operation, commandPayload) {
  const commandSummary = isObject(commandPayload.summary) ? commandPayload.summary : {};
  const evidencePointer = commandSummary.evidenceRef || commandSummary.reportPath || commandSummary.receiptRef || process.env.V22_GOAL_EVIDENCE_REF || "";
  return [
    `${type} accepted after ${operation} command returned structured ok=true.`,
    evidencePointer ? `Evidence pointer: ${evidencePointer}.` : "Evidence pointer retained by command runner.",
    "Raw evidence remains outside git.",
  ].join(" ");
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const operation = operationClass(options);
  const envKey = commandEnvKey(operation);
  if (!operation || !envKey) {
    fail("production_goal_runner_operation_unsupported", { operationClass: operation }, 64);
  }
  const command = commandFor(operation);
  if (!command) {
    fail("production_goal_runner_command_missing", { operationClass: operation, requiredCommandEnv: envKey }, 65);
  }

  const receiptTypes = parseJsonEnv("V22_GOAL_RECEIPT_TYPES", []);
  const inputs = parseJsonEnv("V22_GOAL_INPUTS", {});
  validateInputRefs(operation, inputs);

  const commandPayload = runStructuredCommand(command, operation);
  writeJson({
    ok: true,
    summary: {
      ...(isObject(commandPayload.summary) ? commandPayload.summary : {}),
      operationClass: operation,
      runnerId: process.env.V22_GOAL_RUNNER_ID || "",
      inputKeys: sortedKeys(inputs),
      evidenceRef: process.env.V22_GOAL_EVIDENCE_REF || "",
      externalCommandExecuted: true,
      productionComplete: false,
    },
    receipts: receiptTypes.map((type) => ({
      type,
      owner: RECEIPT_OWNER_BY_TYPE[type] || "MedOPL Operations",
      status: "accepted",
      summary: receiptSummary(type, operation, commandPayload),
    })),
  });
}

main().catch((error) => {
  fail("production_goal_runner_exception", { detail: String(error?.message || error) }, 1);
});
