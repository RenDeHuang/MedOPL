#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  evaluateProductionReceiptManifest,
  PRODUCTION_RECEIPT_BOUNDARY_PATH,
} from "./v22-production-receipt-boundary.mjs";
import { readCloudAuthorizationPack } from "./v22-test-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const AUTH_PACK_PATH = "contracts/medopl-cloud-authorization-pack.json";
const RECEIPT_OWNERS = Object.freeze({
  runtime_owner_receipt: "MedOPL Runtime",
  storage_owner_receipt: "MedOPL Storage",
  billing_owner_receipt: "MedOPL Billing",
  audit_owner_receipt: "MedOPL Audit",
  release_owner_receipt: "MedOPL Release",
  opl_webui_consumer_receipt: "OPL-Webui Consumer",
  production_deploy_receipt: "MedOPL Deploy",
});

const RECEIPT_OPERATION_CLASSES = Object.freeze({
  runtime_owner_receipt: "tenant_runtime_provisioning",
  storage_owner_receipt: "storage_lifecycle",
  billing_owner_receipt: "billing_audit_writeback",
  audit_owner_receipt: "billing_audit_writeback",
  release_owner_receipt: "storage_lifecycle",
  opl_webui_consumer_receipt: "live_test",
  production_deploy_receipt: "deploy",
});

const OPERATION_REQUIRED_ENV = Object.freeze({
  readonly_inventory: Object.freeze(["V22_TENCENT_READONLY_SECRET_FILE"]),
  dry_run_plan: Object.freeze([]),
  tenant_runtime_provisioning: Object.freeze([
    "V22_TENCENT_MUTATION_SECRET_FILE",
    "V22_TENCENT_RUNTIME_PLAN_FILE",
    "V22_TENCENT_RUNTIME_PROVISIONING_RUNNER",
  ]),
  storage_lifecycle: Object.freeze([
    "V22_TENCENT_MUTATION_SECRET_FILE",
    "V22_TENCENT_STORAGE_PLAN_FILE",
    "V22_TENCENT_STORAGE_LIFECYCLE_RUNNER",
  ]),
  billing_audit_writeback: Object.freeze([
    "V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE",
    "V22_MEDOPL_BILLING_AUDIT_WRITEBACK_RUNNER",
    "DATABASE_URL",
  ]),
  build_push: Object.freeze([
    "V22_CONTAINER_BUILD_CONTEXT",
    "V22_CONTAINER_IMAGE_REF",
    "V22_CONTAINER_BUILD_PUSH_RUNNER",
    "TCR_ID",
    "TCR_SECRET",
  ]),
  kubectl: Object.freeze([
    "TENCENT_DEPLOY_KUBECONFIG_REF",
    "V22_KUBERNETES_MANIFEST_DIR",
    "V22_KUBERNETES_APPLY_RUNNER",
  ]),
  deploy: Object.freeze([
    "TENCENT_DEPLOY_KUBECONFIG_REF",
    "V22_MEDOPL_DEPLOY_PLAN_FILE",
    "V22_MEDOPL_DEPLOY_RUNNER",
  ]),
  live_test: Object.freeze([
    "V22_OPL_WEBUI_CONSUMER_CANARY_URL",
    "V22_MEDOPL_PUBLIC_BASE_URL",
    "V22_OPL_WEBUI_CONSUMER_CANARY_RUNNER",
  ]),
});

function parseArgs(argv) {
  const options = { json: false, dryRun: false, execute: false, preflight: false, operation: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--json") options.json = true;
    else if (item === "--dry-run") options.dryRun = true;
    else if (item === "--execute") options.execute = true;
    else if (item === "--preflight") options.preflight = true;
    else if (item === "--operation") {
      options.operation = argv[index + 1] || "";
      index += 1;
    }
  }
  return options;
}

function readJson(repoPath) {
  return JSON.parse(readFileSync(path.join(repoRoot, repoPath), "utf8"));
}

async function loadExecutor() {
  const executorModulePath = process.env.V22_CLOUD_COMMAND_EXECUTOR;
  if (!executorModulePath) throw new Error("cloud_command_executor_missing");
  const resolvedPath = path.isAbsolute(executorModulePath)
    ? executorModulePath
    : path.join(repoRoot, executorModulePath);
  const loaded = await import(pathToFileURL(resolvedPath).href);
  const executor = loaded.default || loaded.runCommand;
  if (typeof executor !== "function") throw new Error(`invalid_cloud_command_executor:${executorModulePath}`);
  return executor;
}

function safeEvidenceSink(pack) {
  const sink = String(pack.evidenceSink || "").replace(/\/+$/u, "");
  const runId = String(pack.runId || "").trim();
  if (!sink || !runId) return "";
  return `${sink}/${runId}`;
}

function phaseEvidenceRef(evidenceSink, operationClass) {
  return `${evidenceSink}/${operationClass}.json`;
}

function phasePlan(pack, cloudPack) {
  const mapByOperation = new Map((cloudPack.active_pack?.operation_class_command_map || []).map((entry) => [entry.operation_class, entry]));
  return (cloudPack.active_pack?.operation_classes || []).map((operationClass) => {
    const mapped = mapByOperation.get(operationClass) || {};
    return {
      operationClass,
      runnerId: mapped.runner_id || "",
      receiptTypes: Array.isArray(mapped.receipt_types) ? mapped.receipt_types.map(String) : [],
      packageScript: mapped.package_script || "",
      commands: [...(mapped.commands || [])],
      status: "planned",
      evidenceRef: phaseEvidenceRef(safeEvidenceSink(pack), operationClass),
    };
  });
}

function redactedSummary(value) {
  const json = JSON.stringify(value || {});
  const redacted = json
    .replace(/SecretId/gu, "SecretRef")
    .replace(/SecretKey/gu, "SecretRef")
    .replace(/provider_response/gu, "provider_summary")
    .replace(/kubeconfig/gu, "kubeconfig_ref")
    .replace(/token/giu, "redacted_token_ref");
  return JSON.parse(redacted || "{}");
}

function basePayload({ options, pack, cloudPack }) {
  const execute = Boolean(options.execute && !options.dryRun && !options.preflight);
  const evidenceSink = safeEvidenceSink(pack);
  return {
    ok: true,
    kind: "v22_cloud_authorized_executor",
    executionMode: options.preflight ? "preflight" : execute ? "execute" : "dry-run",
    failClosed: true,
    executesCloudCommands: execute,
    authorization: {
      pack: AUTH_PACK_PATH,
      approvalId: pack.approvalId,
      runId: pack.runId,
      targetEnvironments: [...(pack.targetEnvironments || [])],
      authorizedCommandsExecutable: pack.authorizedCommandsExecutable,
    },
    evidenceSink,
    phases: phasePlan(pack, cloudPack),
    cannotClaim: [
      "production complete without complete receipt manifest",
      "raw cloud payload",
      "raw secret material",
    ],
  };
}

function pathCheckKind(envKey) {
  if (envKey.endsWith("_DIR")) return "directory";
  if (envKey.endsWith("_CONTEXT")) return "directory";
  if (envKey.endsWith("_RUNNER")) return "file";
  if (envKey.endsWith("_FILE")) return "file";
  return "";
}

function resolveEnvPath(value) {
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function buildPreflight(payload) {
  const phases = payload.phases.map((phase) => {
    const requiredEnv = OPERATION_REQUIRED_ENV[phase.operationClass] || [];
    const missingEnv = requiredEnv.filter((envKey) => !String(process.env[envKey] || "").trim());
    const pathChecks = requiredEnv
      .map((envKey) => {
        const kind = pathCheckKind(envKey);
        if (!kind) return null;
        const value = String(process.env[envKey] || "").trim();
        const provided = value.length > 0;
        const exists = provided ? existsSync(resolveEnvPath(value)) : false;
        return {
          env: envKey,
          kind,
          provided,
          exists,
        };
      })
      .filter(Boolean);
    const failedPathEnv = pathChecks
      .filter((check) => check.provided && !check.exists)
      .map((check) => check.env);
    const ready = missingEnv.length === 0 && failedPathEnv.length === 0;
    return {
      operationClass: phase.operationClass,
      runnerId: phase.runnerId,
      requiredEnv: [...requiredEnv],
      missingEnv,
      pathChecks,
      ready,
      cannotClaim: ready ? [] : [
        "cloud operation executed",
        "owner receipt accepted",
        "production complete",
      ],
    };
  });
  return {
    productionReady: phases.every((phase) => phase.ready),
    phases,
    cannotClaim: [
      "real cloud operation executed by preflight",
      "secret material read by preflight",
      "production complete without execute receipts",
    ],
  };
}

function writeJson(repoPath, value) {
  const absolutePath = path.join(repoRoot, repoPath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function executePayload(payload, options) {
  if (!payload.authorization.authorizedCommandsExecutable) {
    payload.ok = false;
    payload.blocker = { type: "cloud_authorization_pack_invalid" };
    return payload;
  }
  if (options.operation && !payload.phases.some((phase) => phase.operationClass === options.operation)) {
    payload.ok = false;
    payload.blocker = { type: "unknown_operation_class", operationClass: options.operation };
    return payload;
  }
  if (!process.env.V22_CLOUD_COMMAND_EXECUTOR) {
    payload.ok = false;
    payload.blocker = { type: "cloud_command_executor_missing" };
    return payload;
  }

  const executor = await loadExecutor();
  const receiptPointers = new Map();
  const phasesToRun = options.operation
    ? payload.phases.filter((phase) => phase.operationClass === options.operation)
    : payload.phases;

  for (const phase of phasesToRun) {
    phase.status = "executing";
    phase.results = [];
    for (const command of phase.commands) {
      if (!command.startsWith("npm run ")) {
        payload.ok = false;
        phase.status = "blocked";
        payload.blocker = { type: "cloud_command_must_be_package_script", operationClass: phase.operationClass };
        return payload;
      }
      const result = await executor(command, {
        repoRoot,
        operationClass: phase.operationClass,
        runnerId: phase.runnerId,
        receiptTypes: phase.receiptTypes,
        evidenceRef: phase.evidenceRef,
        authorization: payload.authorization,
        writeReceipt(type, receipt = {}) {
          if (!phase.receiptTypes.includes(type)) throw new Error(`receipt_type_not_allowed_for_operation:${phase.operationClass}:${type}`);
          return writeOwnerReceiptPointer(payload, type, {
            ...receipt,
            operationClass: receipt.operationClass || phase.operationClass,
            runnerId: receipt.runnerId || phase.runnerId,
            authorization_ref: receipt.authorization_ref || `${AUTH_PACK_PATH}#${payload.authorization.runId}`,
          }, receiptPointers);
        },
      });
      phase.results.push({
        command,
        ok: Boolean(result?.ok),
        status: result?.status ?? 1,
        summary: redactedSummary(result?.summary || {}),
      });
      if (!result?.ok) {
        payload.ok = false;
        phase.status = "blocked";
        payload.blocker = { type: "cloud_authorized_command_failed", operationClass: phase.operationClass };
        return payload;
      }
    }
    phase.status = "executed";
    writeJson(phase.evidenceRef, {
      kind: "v22_cloud_authorized_phase_evidence",
      operationClass: phase.operationClass,
      status: phase.status,
      commandCount: phase.commands.length,
      summary: "redacted phase evidence only",
    });
  }

  if (!options.operation) {
    payload.receiptManifest = writeReceiptManifest(payload, receiptPointers);
    if (payload.receiptManifest.productionComplete !== true) {
      payload.ok = false;
      payload.blocker = { type: "production_receipt_manifest_incomplete" };
    }
  }
  return payload;
}

function writeReceiptManifest(payload, receiptPointers = new Map()) {
  const boundary = readJson(PRODUCTION_RECEIPT_BOUNDARY_PATH);
  const receiptTypes = boundary.production_receipt_boundary.required_receipt_types;
  const issuedAt = new Date().toISOString();
  const manifestPath = `${payload.evidenceSink}/receipt-manifest.json`;
  const receipts = receiptTypes
    .map((type) => {
      const stored = receiptPointers.get(type);
      if (!stored) return null;
      return {
        type,
        owner: stored.owner || RECEIPT_OWNERS[type] || "MedOPL Operations",
        status: stored.status || "accepted",
        issued_at: stored.issued_at || issuedAt,
        evidence_ref: stored.path || `${payload.evidenceSink}/${type}.json`,
        summary: stored.summary || `${type} accepted with redacted runtime evidence pointer.`,
        authorization_ref: stored.authorization_ref || `${AUTH_PACK_PATH}#${payload.authorization.runId}`,
        operation_class: stored.operation_class || RECEIPT_OPERATION_CLASSES[type] || "",
        runner_id: stored.runner_id || "",
      };
    })
    .filter(Boolean);
  const manifest = {
    schema_version: 1,
    kind: "medopl_production_receipt_manifest",
    state: "complete",
    claim: "production_complete",
    evidence_level: "production_canary",
    target_environment: "production-canary",
    authorization: {
      pack: AUTH_PACK_PATH,
      approval_id: payload.authorization.approvalId,
      run_id: payload.authorization.runId,
    },
    summary: {
      receipt_count: receipts.length,
      raw_evidence_policy: "runtime_pointer_summary_only",
    },
    receipts,
  };
  writeJson(manifestPath, manifest);
  const evaluated = evaluateProductionReceiptManifest({ boundary, manifest });
  return {
    path: manifestPath,
    status: evaluated.productionComplete ? "complete" : "blocked",
    productionComplete: evaluated.productionComplete,
    missingReceiptTypes: evaluated.missingReceiptTypes,
    blockers: evaluated.blockers,
  };
}

function writeOwnerReceiptPointer(payload, type, receipt = {}, receiptPointers = new Map()) {
  const receiptPath = `${payload.evidenceSink}/${type}.json`;
  const issuedAt = new Date().toISOString();
  const pointer = {
    path: receiptPath,
    kind: "v22_owner_receipt_pointer",
    type,
    owner: receipt.owner || RECEIPT_OWNERS[type] || "MedOPL Operations",
    status: receipt.status || "accepted",
    issued_at: receipt.issued_at || issuedAt,
    summary: receipt.summary || `${type} accepted with redacted runtime evidence pointer.`,
    authorization_ref: receipt.authorization_ref || `${AUTH_PACK_PATH}#${payload.authorization.runId}`,
    operation_class: receipt.operationClass || RECEIPT_OPERATION_CLASSES[type] || "",
    runner_id: receipt.runnerId || "",
  };
  writeJson(receiptPath, pointer);
  receiptPointers.set(type, pointer);
  return { path: receiptPath, ...pointer };
}

function renderHuman(payload) {
  const lines = [
    `cloud authorized executor: ${payload.ok ? "ok" : "blocked"}`,
    `mode: ${payload.executionMode}`,
    `evidence: ${payload.evidenceSink}`,
  ];
  for (const phase of payload.phases) lines.push(`- ${phase.operationClass}: ${phase.status}`);
  if (payload.blocker) lines.push(`blocker: ${payload.blocker.type}`);
  return `${lines.join("\n")}\n`;
}

const options = parseArgs(process.argv.slice(2));
const pack = readCloudAuthorizationPack();
const cloudPack = existsSync(path.join(repoRoot, AUTH_PACK_PATH)) ? readJson(AUTH_PACK_PATH) : {};
let payload = basePayload({ options, pack, cloudPack });

try {
  if (options.preflight) payload.preflight = buildPreflight(payload);
  if (payload.executesCloudCommands) payload = await executePayload(payload, options);
  process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  if (!payload.ok) process.exitCode = 1;
} catch (error) {
  payload.ok = false;
  payload.blocker = { type: "cloud_authorized_executor_exception", detail: String(error.message || error) };
  process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  process.exitCode = 1;
}
