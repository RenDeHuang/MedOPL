import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_RECEIPT_BOUNDARY_PATH } from "./v22-production-receipt-boundary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const normalizeFile = (file) => String(file || "").replaceAll("\\", "/").replace(/^\.\//u, "");
export const CLOUD_AUTHORIZATION_PACK_PATH = "contracts/medopl-cloud-authorization-pack.json";

function matchesPrefix(file, prefixes = []) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function isValidFutureDate(value, { now = Date.now() } = {}) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) && timestamp > now;
}

function isValidDate(value) {
  return Number.isFinite(Date.parse(String(value || "")));
}

function isSafeRuntimeEvidenceSink(value) {
  const normalized = String(value || "").trim();
  return /^\.runtime(?:\/[A-Za-z0-9._-]+)*$/u.test(normalized) && !normalized.includes("..");
}

function normalizeMappingEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    operation_class: String(entry?.operation_class || "").trim(),
    runner_id: String(entry?.runner_id || "").trim(),
    receipt_types: Array.isArray(entry?.receipt_types) ? entry.receipt_types.map((type) => String(type || "").trim()).filter(Boolean) : [],
    package_script: String(entry?.package_script || "").trim(),
    commands: Array.isArray(entry?.commands) ? entry.commands.map((command) => String(command || "").trim()).filter(Boolean) : [],
  }));
}

function collectMappingProblems(active, { requiredReceiptTypes = [] } = {}) {
  const blockers = [];
  const diagnostics = {};

  const operationClasses = Array.isArray(active.operation_classes) ? active.operation_classes.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const operationClassSet = new Set(operationClasses);
  const mappingEntries = normalizeMappingEntries(active.operation_class_command_map);
  const mappingByClass = new Map(mappingEntries.map((entry) => [entry.operation_class, entry]));
  const mappingClasses = [...mappingByClass.keys()];
  diagnostics.operationClassMappings = mappingEntries;
  const requiredReceiptTypeList = Array.isArray(requiredReceiptTypes) ? requiredReceiptTypes.map((type) => String(type || "").trim()).filter(Boolean) : [];
  diagnostics.operationClassReceiptMappings = mappingEntries.map((entry) => ({
    operation_class: entry.operation_class,
    receipt_types: entry.receipt_types,
  }));

  if (mappingEntries.length === 0) {
    blockers.push("cloud_authorization_pack_missing:active_pack.operation_class_command_map");
  }
  for (const operationClass of operationClasses) {
    const mapping = mappingByClass.get(operationClass);
    if (!mapping) {
      blockers.push(`cloud_authorization_pack_mapping_missing:operation_class:${operationClass}`);
      continue;
    }
    if (!mapping.package_script) {
      blockers.push(`cloud_authorization_pack_mapping_missing:package_script:${operationClass}`);
    }
    if (!mapping.runner_id) {
      blockers.push(`cloud_authorization_pack_mapping_missing:runner_id:${operationClass}`);
    }
    if (!mapping.commands.length) {
      blockers.push(`cloud_authorization_pack_mapping_missing:commands:${operationClass}`);
    }
    for (const command of mapping.commands) {
      if (!command.startsWith("npm run ")) {
        blockers.push(`cloud_authorization_pack_mapping_invalid_command:${operationClass}:${command}`);
      }
    }
  }
  for (const operationClass of mappingClasses) {
    if (!operationClassSet.has(operationClass)) {
      blockers.push(`cloud_authorization_pack_mapping_extra:operation_class:${operationClass}`);
    }
  }
  for (const receiptType of mappingEntries.flatMap((entry) => entry.receipt_types)) {
    if (requiredReceiptTypeList.length > 0 && !requiredReceiptTypeList.includes(receiptType)) {
      blockers.push(`cloud_authorization_pack_mapping_unknown_receipt_type:${receiptType}`);
    }
  }
  for (const receiptType of requiredReceiptTypeList) {
    if (!mappingEntries.some((entry) => entry.receipt_types.includes(receiptType))) {
      blockers.push(`cloud_authorization_pack_mapping_missing:receipt_type:${receiptType}`);
    }
  }

  const secretRequired = Array.isArray(active.secret_allowlist_required) ? active.secret_allowlist_required.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const secretAllowlist = Array.isArray(active.secret_allowlist) ? active.secret_allowlist.map((item) => String(item || "").trim()).filter(Boolean) : [];
  diagnostics.secretAllowlistRequired = secretRequired;
  diagnostics.secretAllowlistMapping = active.secret_allowlist_mapping || {};
  if (secretRequired.length === 0) {
    blockers.push("cloud_authorization_pack_missing:active_pack.secret_allowlist_required");
  }
  if (secretRequired.join("\u0000") !== secretAllowlist.join("\u0000")) {
    blockers.push("cloud_authorization_pack_mismatch:secret_allowlist_required");
  }
  const secretCoverage = new Set(Object.values(active.secret_allowlist_mapping || {}).flat().map((item) => String(item || "").trim()).filter(Boolean));
  diagnostics.secretAllowlistMappings = Object.entries(active.secret_allowlist_mapping || {}).map(([operation_class, secrets]) => ({
    operation_class,
    secrets: Array.isArray(secrets) ? secrets.map((item) => String(item || "").trim()).filter(Boolean) : [],
  }));
  for (const secret of secretRequired) {
    if (!secretCoverage.has(secret)) blockers.push(`cloud_authorization_pack_mapping_missing:secret_allowlist:${secret}`);
  }

  const apiRequired = Array.isArray(active.api_allowlist_required) ? active.api_allowlist_required.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const apiAllowlist = Array.isArray(active.api_allowlist) ? active.api_allowlist.map((item) => String(item || "").trim()).filter(Boolean) : [];
  diagnostics.apiAllowlistRequired = apiRequired;
  diagnostics.apiAllowlistMapping = active.api_allowlist_mapping || {};
  if (apiRequired.length === 0) {
    blockers.push("cloud_authorization_pack_missing:active_pack.api_allowlist_required");
  }
  if (apiRequired.join("\u0000") !== apiAllowlist.join("\u0000")) {
    blockers.push("cloud_authorization_pack_mismatch:api_allowlist_required");
  }
  const apiCoverage = new Set(Object.values(active.api_allowlist_mapping || {}).flat().map((item) => String(item || "").trim()).filter(Boolean));
  diagnostics.apiAllowlistMappings = Object.entries(active.api_allowlist_mapping || {}).map(([operation_class, apis]) => ({
    operation_class,
    apis: Array.isArray(apis) ? apis.map((item) => String(item || "").trim()).filter(Boolean) : [],
  }));
  for (const api of apiRequired) {
    if (!apiCoverage.has(api)) blockers.push(`cloud_authorization_pack_mapping_missing:api_allowlist:${api}`);
  }

  diagnostics.targetEnvironments = Array.isArray(active.target_environments) ? [...active.target_environments] : [];
  diagnostics.rollbackCommands = Array.isArray(active.rollback_commands) ? [...active.rollback_commands] : [];
  diagnostics.budget = active.budget || null;
  diagnostics.evidenceSink = active.evidence_sink || "";

  if (!diagnostics.rollbackCommands.length) blockers.push("cloud_authorization_pack_missing:active_pack.rollback_commands");
  if (!operationClassSet.size) blockers.push("cloud_authorization_pack_missing:active_pack.operation_classes");
  for (const environment of diagnostics.targetEnvironments) {
    if (!TEST_ENVIRONMENTS.includes(environment)) {
      blockers.push(`cloud_authorization_pack_invalid_target_environment:${environment}`);
    }
  }

  return { blockers, diagnostics };
}

function authorizationBlocker(key) {
  const normalized = String(key || "").trim();
  if (!normalized) return "cloud_authorization_pack_missing:unknown";
  if (normalized.startsWith("cloud_authorization_pack_")) return normalized;
  return `cloud_authorization_pack_missing:${normalized}`;
}

function defaultExists(repoPath) {
  return existsSync(path.join(repoRoot, String(repoPath || "")));
}

function canConnectToPort({ host, port }) {
  const script = [
    "const net = require('node:net');",
    "const socket = net.createConnection({ host: process.argv[1], port: Number(process.argv[2]) });",
    "socket.setTimeout(300);",
    "socket.on('connect', () => { socket.destroy(); process.exit(0); });",
    "socket.on('timeout', () => { socket.destroy(); process.exit(1); });",
    "socket.on('error', () => process.exit(1));",
  ].join("");
  const result = spawnSync(process.execPath, ["-e", script, String(host || "127.0.0.1"), String(port)], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0;
}

export const TEST_ENVIRONMENTS = Object.freeze(["local", "staging", "production-canary"]);
export const TEST_SURFACES = Object.freeze([
  "product",
  "frontend",
  "backend",
  "runtime",
  "cloud",
  "release",
  "hygiene",
  "contract",
  "docs",
  "smoke",
  "regression",
  "journey-product-evidence",
]);

export const TEST_PLAN_BASE_COMMANDS = Object.freeze([
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
]);

const TEST_PLAN_CHANGED_SURFACE_COMMANDS = Object.freeze([
  "npm run test:fast",
  "npm run test:lanes",
]);

const TEST_PLAN_FULL_LOCAL_COMMANDS = Object.freeze([
  "npm run test:regression",
  "npm run verify:local-release-candidate",
]);

export const CLOUD_GOAL_AUTHORIZED_COMMANDS = Object.freeze([
  "npm run cloud:goal -- --operation readonly_inventory",
  "npm run cloud:goal -- --operation dry_run_plan",
  "npm run cloud:goal -- --operation tenant_runtime_provisioning",
  "npm run cloud:goal -- --operation real_tke_runtime_node_lifecycle",
  "npm run cloud:goal -- --operation storage_lifecycle",
  "npm run cloud:goal -- --operation billing_audit_writeback",
  "npm run cloud:goal -- --operation build_push",
  "npm run cloud:goal -- --operation kubectl",
  "npm run cloud:goal -- --operation deploy",
  "npm run cloud:goal -- --operation live_test",
]);

const PREFLIGHT_CHECK_DEFINITIONS = Object.freeze({
  "frontend-typescript-package": Object.freeze({
    id: "frontend-typescript-package",
    label: "frontend TypeScript package",
    path: "services/portal/frontend/node_modules/typescript",
    setupCommand: "npm --prefix services/portal/frontend ci",
  }),
  "go-backend-package": Object.freeze({
    id: "go-backend-package",
    label: "Go backend package",
    path: "services/medopl-go-backend/go.mod",
    setupCommand: "bash -lc \"cd services/medopl-go-backend && go mod download\"",
  }),
  "runtime-bridge-path": Object.freeze({
    id: "runtime-bridge-path",
    label: "runtime bridge path",
    path: "services/opl-runtime-bridge/src",
  }),
  "gateway-path": Object.freeze({
    id: "gateway-path",
    label: "gateway path",
    path: "services/opl-web-gateway/src",
  }),
  "local-service-port-check": Object.freeze({
    id: "local-service-port-check",
    label: "local service port check",
    kind: "tcp_ports",
    ports: Object.freeze([
      Object.freeze({ id: "portal-frontend", host: "127.0.0.1", port: 17180 }),
      Object.freeze({ id: "go-backend", host: "127.0.0.1", port: 8789 }),
      Object.freeze({ id: "opl-web-gateway", host: "127.0.0.1", port: 18789 }),
      Object.freeze({ id: "runtime-bridge", host: "127.0.0.1", port: 8788 }),
      Object.freeze({ id: "clean-opl-webui", host: "127.0.0.1", port: 18130, required: false, external: true }),
    ]),
    setupCommand: "npm run local:services:start && npm run local:services:check -- --json",
  }),
});

const DEPENDENCY_AWARE_DISCOVERY_RULES = Object.freeze([
  Object.freeze({
    id: "medopl-api-contract",
    match(file) {
      return /^contracts\/medopl-api-contract(?:[^/]*)$/u.test(file);
    },
    surfaces: Object.freeze(["backend", "frontend", "contract"]),
    commands: Object.freeze([
      "npm run test:backend",
      "npm run test:frontend",
      "npm run test:regression",
      "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
    ]),
    reasons: Object.freeze([
      Object.freeze({
        ruleId: "dependency-aware-api-contract-backend",
        surface: "backend",
        environment: "local",
        message: "API contract expands to backend verification surface",
      }),
      Object.freeze({
        ruleId: "dependency-aware-api-contract-frontend",
        surface: "frontend",
        environment: "local",
        message: "API contract expands to frontend and contract consumer surface",
      }),
    ]),
  }),
  Object.freeze({
    id: "medopl-runtime-bridge-contract",
    match(file) {
      return /^contracts\/medopl-runtime-bridge-contract(?:[^/]*)$/u.test(file);
    },
    surfaces: Object.freeze(["runtime", "regression"]),
    commands: Object.freeze([
      "npm run test:runtime",
      "npm run test:regression",
    ]),
    reasons: Object.freeze([
      Object.freeze({
        ruleId: "dependency-aware-runtime-bridge-contract",
        surface: "runtime",
        environment: "local",
        message: "runtime bridge contract expands to runtime and regression runtime-bridge surfaces",
      }),
      Object.freeze({
        ruleId: "dependency-aware-runtime-bridge-regression",
        surface: "regression",
        environment: "local",
        message: "runtime bridge contract requires regression runtime-bridge coverage",
      }),
    ]),
  }),
  Object.freeze({
    id: "medopl-cloud-boundary",
    match(file) {
      return /^contracts\/medopl-cloud-boundary(?:[^/]*)$/u.test(file);
    },
    surfaces: Object.freeze(["cloud"]),
    commands: Object.freeze(["npm run test:real-cloud-readiness"]),
    reasons: Object.freeze([
      Object.freeze({
        ruleId: "dependency-aware-cloud-boundary-local-readiness",
        surface: "cloud",
        environment: "local",
        message: "cloud boundary remains local readiness plus authorized candidate only",
      }),
    ]),
  }),
]);

export const TEST_PLAN_CANNOT_CLAIM = Object.freeze([
  "production readiness",
  "deploy completion",
  "Kubernetes command success",
  "live-test coverage",
]);

export const CLOUD_AUTHORIZED_CANNOT_CLAIM = Object.freeze([
  "production readiness",
  "production complete",
  "commercial ready",
  "owner receipts complete",
]);

export function readCloudAuthorizationPack({ exists = defaultExists, readFile = readFileSync } = {}) {
  if (!exists(CLOUD_AUTHORIZATION_PACK_PATH)) {
    return Object.freeze({
      ok: false,
      path: CLOUD_AUTHORIZATION_PACK_PATH,
      status: "missing",
      authorizedCommandsExecutable: false,
      blockers: Object.freeze(["cloud_authorization_pack_missing"]),
    });
  }
  try {
    const pack = JSON.parse(readFile(path.join(repoRoot, CLOUD_AUTHORIZATION_PACK_PATH), "utf8"));
    const active = pack.active_pack || {};
    const requiredFields = [
      ["state", pack.state],
      ["active_pack.status", active.status],
      ["active_pack.authorized_by", active.authorized_by],
      ["active_pack.issued_at", active.issued_at],
      ["active_pack.approval_id", active.approval_id],
      ["active_pack.run_id", active.run_id],
      ["active_pack.evidence_sink", active.evidence_sink],
      ["active_pack.rollback_owner", active.rollback_owner],
      ["active_pack.rollback_commands", active.rollback_commands],
      ["active_pack.expires_at", active.expires_at],
      ["active_pack.budget", active.budget],
      ["active_pack.operation_class_command_map", active.operation_class_command_map],
      ["active_pack.secret_allowlist_required", active.secret_allowlist_required],
      ["active_pack.secret_allowlist_mapping", active.secret_allowlist_mapping],
      ["active_pack.api_allowlist_required", active.api_allowlist_required],
      ["active_pack.api_allowlist_mapping", active.api_allowlist_mapping],
      ["active_pack.post_authorized_command_receipt_manifest", active.post_authorized_command_receipt_manifest],
    ];
    const missing = requiredFields
      .filter(([, value]) => value == null || (typeof value === "string" && !value.trim()))
      .map(([key]) => key);
    const lists = [
      ["active_pack.target_environments", active.target_environments],
      ["active_pack.operation_classes", active.operation_classes],
      ["active_pack.secret_allowlist", active.secret_allowlist],
      ["active_pack.api_allowlist", active.api_allowlist],
      ["required_receipts_before_production_complete", pack.required_receipts_before_production_complete],
    ];
    for (const [key, value] of lists) {
      if (!Array.isArray(value) || value.length === 0) missing.push(key);
    }
    if (active.issued_at && !isValidDate(active.issued_at)) missing.push("active_pack.issued_at_invalid");
    if (active.expires_at && !isValidFutureDate(active.expires_at)) missing.push("active_pack.expires_at_not_future");
    if (active.evidence_sink && !isSafeRuntimeEvidenceSink(active.evidence_sink)) missing.push("active_pack.evidence_sink_not_safe_runtime_path");
    const budget = active.budget || {};
    if (!budget || typeof budget !== "object") {
      missing.push("active_pack.budget_missing");
    } else {
      if (!String(budget.currency || "").trim()) missing.push("active_pack.budget.currency_missing");
      if (!Number.isFinite(Number(budget.cost_ceiling)) || Number(budget.cost_ceiling) < 0) missing.push("active_pack.budget.cost_ceiling_invalid");
    }
    const rootRequiredReceipts = Array.isArray(pack.required_receipts_before_production_complete)
      ? pack.required_receipts_before_production_complete
      : [];
    const { blockers: mappingBlockers, diagnostics } = collectMappingProblems(active, { requiredReceiptTypes: rootRequiredReceipts });
    missing.push(...mappingBlockers);
    const receiptManifestRequirement = active.post_authorized_command_receipt_manifest || {};
    if (receiptManifestRequirement.required !== true) {
      missing.push("active_pack.post_authorized_command_receipt_manifest.required");
    }
    if (receiptManifestRequirement.contract !== PRODUCTION_RECEIPT_BOUNDARY_PATH) {
      missing.push("active_pack.post_authorized_command_receipt_manifest.contract");
    }
    if (receiptManifestRequirement.path_pattern && !isSafeRuntimeEvidenceSink(String(receiptManifestRequirement.path_pattern).replace(/\/\*\*\/receipt-manifest\.json$/u, ""))) {
      missing.push("active_pack.post_authorized_command_receipt_manifest.path_pattern");
    }
    const ok = pack.state === "active" && active.status === "authorized" && missing.length === 0;
    return Object.freeze({
      ok,
      path: CLOUD_AUTHORIZATION_PACK_PATH,
      id: active.id || "",
      status: active.status || "invalid",
      authorizedBy: active.authorized_by || "",
      issuedAt: active.issued_at || "",
      approvalId: active.approval_id || "",
      runId: active.run_id || "",
      targetEnvironments: Object.freeze([...(active.target_environments || [])]),
      operationClasses: Object.freeze([...(active.operation_classes || [])]),
      secretAllowlist: Object.freeze([...(active.secret_allowlist || [])]),
      apiAllowlist: Object.freeze([...(active.api_allowlist || [])]),
      evidenceSink: active.evidence_sink || "",
      rollbackOwner: active.rollback_owner || "",
      rollbackCommands: Object.freeze([...(active.rollback_commands || [])]),
      budget: active.budget || null,
      expiresAt: active.expires_at || "",
      requiredReceiptsBeforeProductionComplete: Object.freeze([...(pack.required_receipts_before_production_complete || [])]),
      postAuthorizedCommandReceiptManifest: Object.freeze({
        required: Boolean(receiptManifestRequirement.required),
        contract: receiptManifestRequirement.contract || "",
        pathPattern: receiptManifestRequirement.path_pattern || "",
        policy: receiptManifestRequirement.policy || "",
      }),
      authorizedCommandsExecutable: ok,
      diagnostics: Object.freeze({
        operationClassMappings: Object.freeze([...((diagnostics.operationClassMappings || []))]),
        secretAllowlistRequired: Object.freeze([...(diagnostics.secretAllowlistRequired || [])]),
        secretAllowlistMappings: Object.freeze([...(diagnostics.secretAllowlistMappings || [])]),
        secretAllowlistMapping: Object.freeze(diagnostics.secretAllowlistMapping || {}),
        apiAllowlistRequired: Object.freeze([...(diagnostics.apiAllowlistRequired || [])]),
        apiAllowlistMappings: Object.freeze([...(diagnostics.apiAllowlistMappings || [])]),
        apiAllowlistMapping: Object.freeze(diagnostics.apiAllowlistMapping || {}),
        targetEnvironments: Object.freeze([...(diagnostics.targetEnvironments || [])]),
        rollbackCommands: Object.freeze([...(diagnostics.rollbackCommands || [])]),
        budget: diagnostics.budget,
        evidenceSink: diagnostics.evidenceSink || "",
      }),
      blockers: Object.freeze(missing.map(authorizationBlocker)),
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      path: CLOUD_AUTHORIZATION_PACK_PATH,
      status: "invalid_json",
      authorizedCommandsExecutable: false,
      blockers: Object.freeze([`cloud_authorization_pack_invalid:${error.message}`]),
    });
  }
}

export const TEST_POLICY_SURFACE_COVERAGE = Object.freeze({
  laneToSurfaces: Object.freeze({
    product: Object.freeze(["product"]),
    frontend: Object.freeze(["frontend"]),
    backend: Object.freeze(["backend"]),
    runtime: Object.freeze(["runtime"]),
    release: Object.freeze(["release"]),
    cloud: Object.freeze(["cloud"]),
    hygiene: Object.freeze(["hygiene"]),
    health: Object.freeze(["hygiene"]),
    smoke: Object.freeze(["smoke"]),
    contract: Object.freeze(["contract"]),
    "regression-portal": Object.freeze(["regression", "frontend"]),
    "regression-opl": Object.freeze(["regression", "runtime"]),
    "regression-runtime-bridge": Object.freeze(["regression", "runtime"]),
    "real-cloud-readiness": Object.freeze(["cloud"]),
    "cloud-release-candidate": Object.freeze(["cloud"]),
    "future-authorized": Object.freeze(["cloud"]),
    "journey-product-evidence": Object.freeze(["frontend", "regression"]),
  }),
  categoryToSurfaces: Object.freeze({
    product: Object.freeze(["product"]),
    frontend: Object.freeze(["frontend"]),
    backend: Object.freeze(["backend"]),
    runtime: Object.freeze(["runtime"]),
    release: Object.freeze(["release"]),
    cloud: Object.freeze(["cloud"]),
    hygiene: Object.freeze(["hygiene"]),
    smoke: Object.freeze(["smoke"]),
    contract: Object.freeze(["contract"]),
    regression: Object.freeze(["regression", "frontend", "runtime"]),
    "journey-product-evidence": Object.freeze(["frontend", "regression"]),
    "suite-wrapper": Object.freeze(["smoke", "contract"]),
  }),
  registrySurfaceToPolicySurfaces: Object.freeze({
    "control-plane": Object.freeze(["product", "backend", "hygiene", "contract"]),
    portal: Object.freeze(["frontend", "regression"]),
    opl: Object.freeze(["runtime", "regression"]),
    "runtime-bridge": Object.freeze(["runtime", "regression"]),
    cloud: Object.freeze(["cloud", "release"]),
  }),
});

export const TEST_SURFACE_RULES = Object.freeze([
  Object.freeze({
    id: "frontend-source",
    surface: "frontend",
    environment: "local",
    pathPrefixes: Object.freeze([
      "services/portal/frontend/",
      "tests/frontend/",
      "tests/regression/portal/",
    ]),
    commands: Object.freeze([
      "npm run test:frontend",
      "npm run test:journey-evidence",
      "npm run test:regression",
    ]),
    reason: "frontend surface changed",
  }),
  Object.freeze({
    id: "portal-control-plane",
    surface: "product",
    environment: "local",
    match(file) {
      return file.startsWith("services/portal/") && !file.startsWith("services/portal/frontend/");
    },
    commands: Object.freeze([
      "npm --prefix services/portal run check",
      "npm run test:regression",
    ]),
    reason: "portal control-plane changed",
  }),
  Object.freeze({
    id: "go-backend",
    surface: "backend",
    environment: "local",
    pathPrefixes: Object.freeze([
      "services/medopl-go-backend/",
      "tests/backend/",
    ]),
    commands: Object.freeze([
      "npm run test:backend",
      "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
    ]),
    reason: "backend API or Go service changed",
  }),
  Object.freeze({
    id: "runtime-bridge",
    surface: "runtime",
    environment: "local",
    pathPrefixes: Object.freeze([
      "services/opl-runtime-bridge/",
      "services/opl-web-gateway/",
      "tests/runtime/",
      "tests/regression/runtime-bridge/",
      "tests/regression/opl/",
    ]),
    commands: Object.freeze([
      "npm run test:runtime",
      "npm run test:regression",
    ]),
    reason: "runtime or OPL boundary changed",
  }),
  Object.freeze({
    id: "release-boundary",
    surface: "release",
    environment: "local",
    pathPrefixes: Object.freeze([
      "tests/release/",
      "docs/evidence/",
    ]),
    match(file) {
      return file.startsWith("contracts/medopl-release-boundary")
        || file.startsWith("contracts/medopl-production-receipt-boundary");
    },
    commands: Object.freeze(["npm run test:release"]),
    reason: "release boundary changed",
  }),
  Object.freeze({
    id: "cloud-boundary",
    surface: "cloud",
    environment: "local",
    authorizedEnvironment: "staging",
    pathPrefixes: Object.freeze([
      "tests/cloud/",
      "tests/support/cloud-prework/",
      "deploy/medopl-cloud/",
      ".github/workflows/cloud-rollout.yml",
      ".github/workflows/release-image.yml",
      "scripts/cloud-rollout/medopl.mjs",
    ]),
    match(file) {
      return file.startsWith("contracts/medopl-cloud-boundary");
    },
    commands: Object.freeze([
      "npm run test:cloud",
      "npm run test:real-cloud-readiness",
    ]),
    authorizedCommands: CLOUD_GOAL_AUTHORIZED_COMMANDS,
    cannotClaim: Object.freeze([
      "future-authorized cloud mutation",
      "production canary coverage",
    ]),
    reason: "cloud boundary changed",
  }),
  Object.freeze({
    id: "hygiene-and-runner",
    surface: "hygiene",
    environment: "local",
    pathPrefixes: Object.freeze([
      "scripts/",
      "tests/health/",
      "tests/hygiene/",
      "tests/fixtures/v22/",
    ]),
    match(file) {
      return file === "package.json" || /^tests\/[^/]+\.mjs$/u.test(file);
    },
    commands: Object.freeze([
      "npm run test:hygiene",
      "npm run test:health",
      "npm run test:contract",
    ]),
    reason: "runner, health, or hygiene boundary changed",
  }),
  Object.freeze({
    id: "contract-surface",
    surface: "contract",
    environment: "local",
    pathPrefixes: Object.freeze([
      "contracts/",
      "specs/",
    ]),
    commands: Object.freeze(["npm run test:contract"]),
    reason: "machine-readable contract changed",
  }),
  Object.freeze({
    id: "docs-surface",
    surface: "docs",
    environment: "local",
    match(file) {
      return file.startsWith("docs/") || file === "README.md" || file === "AGENTS.md" || file === "TASTE.md";
    },
    commands: Object.freeze([
      "npm run test:health",
      "npm run check:diff",
    ]),
    reason: "human-readable docs entry changed",
  }),
]);

function fileMatchesRule(file, rule) {
  if (typeof rule.match === "function" && rule.match(file)) return true;
  return matchesPrefix(file, rule.pathPrefixes);
}

function runPreflight(checkIds, { exists = defaultExists, canConnect = canConnectToPort } = {}) {
  const checks = [];
  const missing = [];
  const recommendedSetupCommands = [];

  for (const checkId of unique(checkIds)) {
    const definition = PREFLIGHT_CHECK_DEFINITIONS[checkId];
    if (!definition) continue;
    if (definition.kind === "tcp_ports") {
      const ports = (definition.ports || []).map((port) => Object.freeze({
        ...port,
        required: port.required !== false,
        ok: canConnect(port),
      }));
      const missingRequiredPorts = ports.filter((port) => port.required && !port.ok);
      const ok = missingRequiredPorts.length === 0;
      checks.push(Object.freeze({
        id: definition.id,
        ok,
        kind: definition.kind,
        label: definition.label,
        ports: Object.freeze(ports),
      }));
      if (!ok) {
        missing.push(Object.freeze({
          id: definition.id,
          label: definition.label,
          ports: Object.freeze(missingRequiredPorts),
        }));
        if (definition.setupCommand) recommendedSetupCommands.push(definition.setupCommand);
      }
      continue;
    }
    const ok = Boolean(exists(definition.path));
    checks.push(Object.freeze({
      id: definition.id,
      ok,
      path: definition.path,
      label: definition.label,
    }));
    if (!ok) {
      missing.push(Object.freeze({
        id: definition.id,
        path: definition.path,
        label: definition.label,
      }));
      if (definition.setupCommand) recommendedSetupCommands.push(definition.setupCommand);
    }
  }

  return Object.freeze({
    ok: missing.length === 0,
    checks: Object.freeze(checks),
    missing: Object.freeze(missing),
    recommendedSetupCommands: Object.freeze(unique(recommendedSetupCommands)),
  });
}

export function preflightTestPlan(plan, { exists = defaultExists, canConnect = canConnectToPort } = {}) {
  const checkIds = [];
  const surfaces = new Set(plan?.matchedSurfaces || []);
  const commands = new Set(plan?.recommendedCommands || []);

  if (surfaces.has("frontend") || commands.has("npm run test:frontend")) checkIds.push("frontend-typescript-package");
  if (surfaces.has("backend") || commands.has("npm run test:backend")) checkIds.push("go-backend-package");
  if (surfaces.has("runtime") || commands.has("npm run test:runtime")) {
    checkIds.push("runtime-bridge-path", "gateway-path", "local-service-port-check");
  }
  if (surfaces.has("regression") || commands.has("npm run test:regression")) {
    checkIds.push("frontend-typescript-package", "runtime-bridge-path", "gateway-path", "local-service-port-check");
  }

  return runPreflight(checkIds, { exists, canConnect });
}

function applyDependencyAwareDiscovery(file, state) {
  for (const rule of DEPENDENCY_AWARE_DISCOVERY_RULES) {
    if (!rule.match(file)) continue;
    state.matchedSurfaces.push(...(rule.surfaces || []));
    state.environments.push("local");
    state.recommendedCommands.push(...(rule.commands || []));
    for (const reason of rule.reasons || []) {
      state.reasons.push(Object.freeze({
        file,
        ruleId: reason.ruleId,
        surface: reason.surface,
        environment: reason.environment,
        message: reason.message,
      }));
    }
  }
}

export function planCommandsForFiles(files, { profile = "changed-surface", exists = defaultExists } = {}) {
  const normalizedFiles = unique(files.map(normalizeFile));
  const matchedSurfaces = [];
  const environments = [];
  const authorizedEnvironments = [];
  const recommendedCommands = [...TEST_PLAN_BASE_COMMANDS];
  const authorizedCommands = [];
  const cannotClaim = [...TEST_PLAN_CANNOT_CLAIM];
  const reasons = [];
  const authorization = readCloudAuthorizationPack({ exists });

  if (profile === "changed-surface") {
    recommendedCommands.push(...TEST_PLAN_CHANGED_SURFACE_COMMANDS);
  }
  if (profile === "full-local") {
    recommendedCommands.push(...TEST_PLAN_CHANGED_SURFACE_COMMANDS, ...TEST_PLAN_FULL_LOCAL_COMMANDS);
  }

  for (const file of normalizedFiles) {
    for (const rule of TEST_SURFACE_RULES) {
      if (!fileMatchesRule(file, rule)) continue;
      matchedSurfaces.push(rule.surface);
      environments.push(rule.environment);
      if (rule.authorizedEnvironment) authorizedEnvironments.push(rule.authorizedEnvironment);
      recommendedCommands.push(...(rule.commands || []));
      authorizedCommands.push(...(rule.authorizedCommands || []));
      cannotClaim.push(...(rule.cannotClaim || []));
      reasons.push(Object.freeze({
        file,
        ruleId: rule.id,
        surface: rule.surface,
        environment: rule.environment,
        message: rule.reason,
      }));
    }
    applyDependencyAwareDiscovery(file, {
      matchedSurfaces,
      environments,
      recommendedCommands,
      reasons,
    });
  }

  if (authorizedCommands.length > 0) {
    if (authorization.authorizedCommandsExecutable) {
      cannotClaim.push(...CLOUD_AUTHORIZED_CANNOT_CLAIM);
      authorizedEnvironments.push(...authorization.targetEnvironments);
    } else {
      cannotClaim.push("real cloud execution");
    }
  }

  const normalizedPlan = Object.freeze({
    matchedSurfaces: Object.freeze(unique(matchedSurfaces)),
    environments: Object.freeze(unique(environments)),
    authorizedEnvironments: Object.freeze(unique(authorizedEnvironments)),
    recommendedCommands: Object.freeze(unique(recommendedCommands)),
    authorizedCommands: Object.freeze(unique(authorizedCommands)),
    reasons: Object.freeze(reasons),
    cannotClaim: Object.freeze(unique(cannotClaim)),
    authorization,
  });

  return Object.freeze({
    ...normalizedPlan,
    preflight: preflightTestPlan(normalizedPlan, { exists }),
  });
}
