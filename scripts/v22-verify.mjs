#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planCommandsForFiles } from "./v22-test-policy.mjs";
import { runPlanWithReport } from "./v22-test-report.mjs";
import {
  evaluateProductionReceiptManifest,
  PRODUCTION_RECEIPT_BOUNDARY_PATH,
  validateProductionReceiptBoundary,
} from "./v22-production-receipt-boundary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const currentStatePath = "tests/fixtures/v22/goal-current.json";
const PRODUCT_AUTHORITY_CONTRACTS = Object.freeze([
  "contracts/medopl-product-profile.json",
  "contracts/medopl-portal-page-state-matrix.json",
  "contracts/medopl-api-contract.json",
  "contracts/medopl-runtime-bridge-contract.json",
  "contracts/medopl-data-plane-contract.json",
  "contracts/medopl-billing-ledger-contract.json",
  "contracts/medopl-release-boundary.json",
  "contracts/medopl-cloud-boundary.json",
  "contracts/medopl-cloud-authorization-pack.json",
  "contracts/medopl-production-receipt-boundary.json",
]);

function parseArgs(argv) {
  const [mode, maybeTarget, ...tail] = argv;
  const target = maybeTarget && !maybeTarget.startsWith("--") ? maybeTarget : undefined;
  const rest = target ? tail : [maybeTarget, ...tail].filter(Boolean);
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { mode, target, options };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.join(repoRoot, filePath), "utf8"));
}

function repoPathExists(repoPath) {
  return existsSync(path.join(repoRoot, repoPath));
}

function commandToSpawn(command) {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return parts.map((part) => part.replace(/^"|"$/g, ""));
}

function commandFiles(commands) {
  return commands
    .map((command) => String(command || ""))
    .filter(Boolean)
    .sort();
}

function assertPath(repoPath) {
  assert.equal(repoPathExists(repoPath), true, `required_path_missing:${repoPath}`);
}

function assertPathMissing(repoPath) {
  assert.equal(repoPathExists(repoPath), false, `retired_path_must_not_exist:${repoPath}`);
}

function readRepoText(repoPath) {
  return readFileSync(path.join(repoRoot, repoPath), "utf8");
}

function readRepoJsonSync(repoPath) {
  return JSON.parse(readRepoText(repoPath));
}

function listTopLevelDirs(repoPath) {
  return readdirSync(path.join(repoRoot, repoPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function replaceBase(command, base) {
  if (!base) return command;
  return command.replaceAll("origin/recovery/platform-v22-trunk", base);
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

function csvOption(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function gitLines(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").map((item) => item.trim()).filter(Boolean);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function changedFilesSince(base) {
  return unique([
    ...gitLines(["diff", "--name-only", `${base}...HEAD`]),
    ...gitLines(["diff", "--name-only", "--cached"]),
    ...gitLines(["diff", "--name-only"]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]);
}

function planForOptions({ options, base }) {
  const explicitFiles = csvOption(options.files);
  const changedFiles = explicitFiles.length > 0 ? explicitFiles : changedFilesSince(base);
  const profile = String(options.profile || "changed-surface");
  const allowedProfiles = new Set(["changed-surface", "full-local"]);
  if (!allowedProfiles.has(profile)) throw new Error(`unknown_plan_profile:${profile}`);
  const planned = planCommandsForFiles(changedFiles, { profile });
  return {
    ok: true,
    mode: "plan",
    profile,
    changedFiles,
    executesCommands: false,
    matchedSurfaces: planned.matchedSurfaces,
    environments: planned.environments,
    authorizedEnvironments: planned.authorizedEnvironments,
    recommendedCommands: planned.recommendedCommands,
    authorizedCommands: planned.authorizedCommands,
    reasons: planned.reasons,
    cannotClaim: planned.cannotClaim,
    preflight: planned.preflight,
    authorization: planned.authorization,
  };
}

function branchOverrideForBranch({ branchName, manifest, base }) {
  const matchedSuites = (manifest.branch_override_suites ?? []).filter((suite) => {
    const suiteBranches = new Set([suite.branch, ...(suite.branches ?? [])].filter(Boolean));
    return suiteBranches.has(branchName);
  });
  if (matchedSuites.length > 1) {
    throw new Error(`branch_override_suite_ambiguous:${branchName}:${matchedSuites.map((suite) => suite.id).join(",")}`);
  }
  const suite = matchedSuites[0];
  if (!suite) return null;
  return {
    branchOverride: {
      branch: branchName,
      suiteId: suite.id,
      reason: suite.reason,
    },
    commands: suite.commands.map((command) => replaceBase(command, base)),
    allowedFiles: suite.allowed_files || [],
    forbiddenFiles: suite.forbidden_files || manifest.global_forbidden_files,
    forbiddenOps: suite.forbidden_ops || manifest.global_forbidden_ops,
    riskClass: suite.risk_class || "local_service_code",
  };
}

function commandBundle({ mode, target, manifest, current, base, branchName = currentBranchName() }) {
  if (mode === "current") {
    const leaf = manifest.leaves.find((item) => item.leaf_id === current.current_cursor);
    if (!leaf) throw new Error(`current_leaf_missing_from_manifest:${current.current_cursor}`);
    const branchOverride = branchOverrideForBranch({ branchName, manifest, base });
    return {
      mode: "current",
      leafId: leaf.leaf_id,
      commands: branchOverride?.commands ?? leaf.verification_commands.map((command) => replaceBase(command, base)),
      allowedFiles: branchOverride?.allowedFiles ?? leaf.allowed_files,
      forbiddenFiles: branchOverride?.forbiddenFiles ?? leaf.forbidden_files,
      forbiddenOps: branchOverride?.forbiddenOps ?? leaf.forbidden_ops,
      riskClass: branchOverride?.riskClass ?? leaf.risk_class,
      ...(branchOverride?.branchOverride ? { branchOverride: branchOverride.branchOverride } : {}),
    };
  }

  if (mode === "suite") {
    const suite = manifest.suites.find((item) => item.id === target);
    if (!suite) throw new Error(`suite_missing:${target || "(missing)"}`);
    return {
      mode: "suite",
      suiteId: suite.id,
      commands: suite.commands.map((command) => replaceBase(command, base)),
      allowedFiles: suite.allowed_files || [],
      forbiddenFiles: manifest.global_forbidden_files,
      forbiddenOps: manifest.global_forbidden_ops,
      riskClass: "local_doc_eval",
    };
  }

  if (mode === "package") {
    const suite = manifest.package_suites.find((item) => item.id === target);
    if (!suite) throw new Error(`package_suite_missing:${target || "(missing)"}`);
    return {
      mode: "package",
      packageId: suite.id,
      commands: suite.commands.map((command) => replaceBase(command, base)),
      allowedFiles: [],
      forbiddenFiles: manifest.global_forbidden_files,
      forbiddenOps: manifest.global_forbidden_ops,
      riskClass: "local_service_code",
    };
  }

  if (mode === "review") {
    const suite = manifest.suites.find((item) => item.id === "review");
    if (!suite) throw new Error("review_suite_missing");
    return {
      mode: "review",
      commands: suite.commands.map((command) => replaceBase(command, base)),
      allowedFiles: [],
      forbiddenFiles: manifest.global_forbidden_files,
      forbiddenOps: manifest.global_forbidden_ops,
      riskClass: "local_doc_eval",
    };
  }

  throw new Error(`unknown_verify_mode:${mode || "(missing)"}`);
}

function runCommand(command) {
  const [bin, ...args] = commandToSpawn(command);
  if (!bin) throw new Error(`empty_command:${command}`);
  const result = spawnSync(bin, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  return {
    command,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    ok: result.status === 0,
  };
}

async function runPlanForOptions({ options, base }) {
  if (options.commands) throw new Error("run_plan_command_override_forbidden");
  const plan = planForOptions({ options, base });
  return runPlanWithReport({
    repoRoot,
    plan,
    dryRun: Boolean(options["dry-run"]),
    includeAuthorized: Boolean(options["include-authorized"]),
    env: process.env,
  });
}

async function verifyCloudReleaseCandidate({ base, receiptManifestPath = ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json" }) {
  const [boundary, receiptManifest] = await Promise.all([
    readJson(PRODUCTION_RECEIPT_BOUNDARY_PATH),
    readJson(receiptManifestPath).catch(() => null),
  ]);
  const receiptResult = evaluateProductionReceiptManifest({ boundary, manifest: receiptManifest });
  return {
    ok: receiptResult.cloudReleaseCandidateComplete === true,
    mode: "cloud-release-candidate",
    base,
    receiptManifestRef: receiptManifestPath,
    cloudReleaseCandidateComplete: receiptResult.cloudReleaseCandidateComplete,
    productionComplete: false,
    missingReceiptTypes: receiptResult.missingReceiptTypes,
    missingLifecycleSections: receiptResult.missingLifecycleSections,
    blockers: receiptResult.blockers,
    rawEvidenceViolations: receiptResult.rawEvidenceViolations,
    unexpectedFieldViolations: receiptResult.unexpectedFieldViolations,
    receiptMappingViolations: receiptResult.receiptMappingViolations,
    cannotClaim: [
      "production complete",
      "multi-region production",
      "SLA proven",
      "enterprise compliance",
    ],
  };
}

async function validateActivePlatform({ manifest, current }) {
  const packageJson = await readJson("package.json");

  assert.equal(current.canonical, true, "goal_current_must_be_canonical");
  assert.equal(manifest.canonical, true, "manifest_must_be_canonical");
  assert.equal(current.current_truth_role, "machine_cursor_fixture", "goal_current_role_mismatch");
  assert.equal(current.verify_manifest, "tests/fixtures/v22/agent-verify-manifest.json", "goal_current_manifest_pointer_mismatch");
  assert.equal(manifest.runner, "scripts/v22-verify.mjs", "manifest_runner_mismatch");

  assert.equal(packageJson.scripts["validate:active-platform"], "node scripts/v22-verify.mjs active-platform", "active_platform_script_mismatch");
  assert.equal(packageJson.scripts.verify, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "verify_script_mismatch");
  assert.equal(packageJson.scripts["gate:review"], "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk", "review_gate_script_mismatch");
  assert.equal(packageJson.scripts["gate:change"], undefined, "gate_change_script_must_be_retired");
  assert.equal(packageJson.scripts["closeout:check"], undefined, "closeout_check_script_must_be_retired");
  assertPathMissing("changes");
  assert.equal(manifest.change_lifecycle_policy, undefined, "manifest_change_lifecycle_policy_must_be_retired");
  assert.equal(current.product_authority?.changes_retired, true, "current_fixture_must_mark_changes_retired");
  assert.deepEqual(current.product_authority?.product_contracts, PRODUCT_AUTHORITY_CONTRACTS, "current_fixture_product_contracts_mismatch");

  const currentLeaf = manifest.leaves.find((leaf) => leaf.leaf_id === current.current_cursor);
  assert(currentLeaf, `manifest_current_leaf_missing:${current.current_cursor}`);
  assert.equal(current.current_leaf.step_id, current.current_cursor, "current_leaf_step_mismatch");
  assert.equal(currentLeaf.gap_id, current.current_leaf.gap_id, "manifest_current_leaf_gap_mismatch");

  const manifestSuites = new Map(manifest.suites.map((suite) => [suite.id, suite]));
  for (const suiteId of ["current", "product", "frontend", "backend", "runtime", "release", "cloud", "hygiene", "health", "smoke", "local-contract", "local-regression", "real-cloud-readiness", "cloud-future-authorized", "review"]) {
    assert(manifestSuites.has(suiteId), `manifest_suite_missing:${suiteId}`);
  }

  const currentCommands = commandFiles(manifestSuites.get("current").commands);
  const leafCommands = commandFiles(currentLeaf.verification_commands);
  assert.deepEqual(currentCommands, leafCommands, "current_suite_must_match_current_leaf_commands");
  assert.deepEqual(commandFiles(current.verification_commands), leafCommands, "goal_current_top_level_commands_must_match_current_leaf");
  assert.deepEqual([...new Set(currentLeaf.forbidden_ops)].sort(), [...new Set(current.current_leaf.forbidden_ops)].sort(), "current_leaf_forbidden_ops_must_match_current_fixture");
  assert.deepEqual([...new Set(currentLeaf.forbidden_files)].sort(), [...new Set(current.current_leaf.forbidden_files)].sort(), "current_leaf_forbidden_files_must_match_current_fixture");
  for (const op of currentLeaf.forbidden_ops) {
    assert(manifest.global_forbidden_ops.includes(op), `current_leaf_forbidden_op_missing_from_global:${op}`);
  }
  for (const filePattern of currentLeaf.forbidden_files.filter((item) => item !== "real cloud/provider files")) {
    assert(manifest.global_forbidden_files.includes(filePattern), `current_leaf_forbidden_file_missing_from_global:${filePattern}`);
  }
  assert.equal(commandFiles([
    packageJson.scripts["validate:active-platform"],
    packageJson.scripts.verify,
    packageJson.scripts["gate:review"],
  ]).every((command) => command.startsWith("node scripts/") || command.startsWith("npm run ")), true, "active_platform_root_scripts_must_use_repo_entrypoints");
  const allManifestCommands = [
    ...manifest.suites.flatMap((suite) => suite.commands || []),
    ...manifest.package_suites.flatMap((suite) => suite.commands || []),
    ...manifest.leaves.flatMap((leaf) => leaf.verification_commands || []),
  ].map(String);
  for (const command of allManifestCommands) {
    assert.equal(command.includes("change-package"), false, `verify_manifest_must_not_run_change_package:${command}`);
    assert.equal(command.includes("changes/"), false, `verify_manifest_must_not_depend_on_changes:${command}`);
  }
  for (const repoPath of [
    "docs/README.md",
    "docs/active/README.md",
    "docs/product/README.md",
    "docs/runtime/README.md",
    "docs/framework/README.md",
    "docs/specs/README.md",
    "docs/evidence/README.md",
    "docs/policies/README.md",
    "docs/delivery/README.md",
    "docs/source/README.md",
    "docs/history/README.md",
    "specs/README.md",
    "specs/product/spec.md",
    "specs/runtime/spec.md",
    "specs/framework/spec.md",
    "specs/operations/spec.md",
    "specs/evidence/spec.md",
    "specs/policies/spec.md",
    "specs/source/spec.md",
    "contracts/README.md",
    ...PRODUCT_AUTHORITY_CONTRACTS,
    "scripts/v22-verify.mjs",
    "scripts/v22-workflow-gate.mjs",
  ]) {
    assertPath(repoPath);
  }

  for (const contractPath of PRODUCT_AUTHORITY_CONTRACTS) {
    const contract = readRepoJsonSync(contractPath);
    assert.equal(contract.state, "active", `product_contract_must_be_active:${contractPath}`);
    assert.equal(typeof contract.owner, "string", `product_contract_owner_missing:${contractPath}`);
    assert.equal(typeof contract.purpose, "string", `product_contract_purpose_missing:${contractPath}`);
    assert(contract.authority_boundary && typeof contract.authority_boundary === "object", `product_contract_authority_boundary_missing:${contractPath}`);
    assert(
      Array.isArray(contract.consumers) || Array.isArray(contract.consumer_tests),
      `product_contract_must_declare_consumers:${contractPath}`,
    );
  }

  const testDirs = new Set(listTopLevelDirs("tests"));
  for (const dirName of ["product", "frontend", "backend", "runtime", "release", "cloud", "hygiene", "support"]) {
    assert(testDirs.has(dirName), `tests_taxonomy_dir_missing:${dirName}`);
  }

  const pageMatrix = readRepoJsonSync("contracts/medopl-portal-page-state-matrix.json").medopl_portal_page_state_matrix;
  const routesSource = readRepoText("services/portal/frontend/src/app/routes.tsx");
  const routeMarkers = new Map([
    ["resource_overview", "Overview"],
    ["packages_purchase", "PackagesPurchase"],
    ["compute_resource", "RuntimeEnvironment"],
    ["storage_space", "Workspace"],
    ["usage_billing", "BillingAudit"],
    ["opl_entry", "OPLEntry"],
    ["release", "Workspace"],
  ]);
  for (const page of pageMatrix.pages || []) {
    assert(routeMarkers.has(page.id), `portal_page_matrix_route_owner_missing:${page.id}`);
    assert(routesSource.includes(routeMarkers.get(page.id)), `portal_page_matrix_not_covered:${page.id}`);
  }

  const goRouteSurface = [
    "services/medopl-go-backend/internal/server/router.go",
    "services/medopl-go-backend/internal/server/handlers/controlplane.go",
  ].map(readRepoText).join("\n");
  for (const marker of ["/api/me", "/api/workspace", "/opl/runs", "/billing/summary", "/api/admin/audit", "/v22/managed-environment/release"]) {
    assert(goRouteSurface.includes(marker), `go_api_route_missing_for_product_contract:${marker}`);
  }

  const runtimeRetiredRoutes = readRepoText("services/opl-runtime-bridge/src/runtime-bridge-retired-routes.mjs");
  assert(runtimeRetiredRoutes.includes("billing ledger owner 是 Portal/Go control plane"), "runtime_bridge_must_not_own_billing_truth");

  const releaseContract = readRepoJsonSync("contracts/medopl-release-boundary.json");
  const cloudAuthorizationPack = readRepoJsonSync("contracts/medopl-cloud-authorization-pack.json");
  const productionReceiptBoundary = readRepoJsonSync(PRODUCTION_RECEIPT_BOUNDARY_PATH);
  const productionReceiptManifestExample = readRepoJsonSync("tests/fixtures/v22/production-receipt-manifest.example.json");
  assert.equal(releaseContract.authority_boundary.default_real_cloud_mutation, "allowed_when_authorization_pack_is_active", "release_boundary_must_use_machine_authorization_pack");
  assert.equal(releaseContract.authority_boundary.authorization_pack, "contracts/medopl-cloud-authorization-pack.json", "release_boundary_must_reference_authorization_pack");
  assert.equal(releaseContract.authority_boundary.production_receipt_boundary, PRODUCTION_RECEIPT_BOUNDARY_PATH, "release_boundary_must_reference_production_receipt_boundary");
  const receiptBoundaryValidation = validateProductionReceiptBoundary({
    boundary: productionReceiptBoundary,
    cloudAuthorization: cloudAuthorizationPack,
  });
  assert.equal(receiptBoundaryValidation.ok, true, `production_receipt_boundary_must_be_valid:${JSON.stringify(receiptBoundaryValidation)}`);
  const receiptManifestEvaluation = evaluateProductionReceiptManifest({
    boundary: productionReceiptBoundary,
    manifest: productionReceiptManifestExample,
  });
  assert.equal(receiptManifestEvaluation.productionComplete, true, `production_receipt_manifest_example_must_be_complete:${JSON.stringify(receiptManifestEvaluation)}`);
  assert.equal(current.production_receipt_boundary?.contract, PRODUCTION_RECEIPT_BOUNDARY_PATH, "current_fixture_receipt_boundary_contract_mismatch");
  assert.equal(current.production_receipt_boundary?.state, "active_not_complete_cloud_rc_gate_fail_closed", "current_fixture_receipt_boundary_state_mismatch");
  assert(packageJson.scripts["verify:golden-path"], "golden_path_gate_script_missing");
  assert(packageJson.scripts["test:cloud"], "cloud_boundary_gate_script_missing");
  assert(packageJson.scripts["test:hygiene"], "secret_hygiene_gate_script_missing");
  assert.equal(
    packageJson.scripts["verify:cloud-release-candidate"],
    "node scripts/v22-verify.mjs package cloud-release-candidate --base origin/recovery/platform-v22-trunk",
    "cloud_release_candidate_gate_script_mismatch",
  );

  return {
    ok: true,
    contract: "validate_active_platform",
    quick: true,
    currentCursor: current.current_cursor,
    manifestRunner: manifest.runner,
    currentCommandCount: leafCommands.length,
    forbiddenOps: manifest.global_forbidden_ops.length,
    productContracts: PRODUCT_AUTHORITY_CONTRACTS.length,
  };
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-verify.mjs list [--json]",
    "  node scripts/v22-verify.mjs active-platform [--quick] [--json]",
    "  node scripts/v22-verify.mjs plan [--base origin/recovery/platform-v22-trunk] [--files a,b] [--profile changed-surface|full-local] [--json]",
    "  node scripts/v22-verify.mjs run-plan [--base origin/recovery/platform-v22-trunk] [--files a,b] [--profile changed-surface|full-local] [--dry-run] [--include-authorized] [--json]",
    "  node scripts/v22-verify.mjs cloud-release-candidate [--base origin/recovery/platform-v22-trunk] [--receipt-manifest .runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json] [--json]",
    "  node scripts/v22-verify.mjs current [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "  node scripts/v22-verify.mjs suite <id> [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "  node scripts/v22-verify.mjs package <id> [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "  node scripts/v22-verify.mjs review [--base origin/recovery/platform-v22-trunk] [--dry-run] [--json]",
    "",
  ].join("\n"));
}

function renderHuman(payload) {
  const lines = [
    `v22 verify ${payload.mode}`,
    `ok: ${payload.ok}`,
  ];
  if (payload.mode === "plan" || payload.mode === "run-plan") {
    if (payload.profile) lines.push(`profile: ${payload.profile}`);
    lines.push(`executes_commands: ${payload.executesCommands}`);
    if ((payload.changedFiles || []).length > 0) {
      lines.push("changed files:");
      for (const file of payload.changedFiles) lines.push(`- ${file}`);
    }
    if ((payload.matchedSurfaces || []).length > 0) {
      lines.push("matched surfaces:");
      for (const surface of payload.matchedSurfaces) lines.push(`- ${surface}`);
    }
    if ((payload.environments || []).length > 0) {
      lines.push("environments:");
      for (const environment of payload.environments) lines.push(`- ${environment}`);
    }
    if ((payload.authorizedEnvironments || []).length > 0) {
      lines.push("authorized environments:");
      for (const environment of payload.authorizedEnvironments) lines.push(`- ${environment}`);
    }
    if ((payload.reasons || []).length > 0) {
      lines.push("reasons:");
      for (const reason of payload.reasons) {
        lines.push(`- [${reason.ruleId}] ${reason.surface} ${reason.file} (${reason.environment}): ${reason.message}`);
      }
    }
    lines.push("recommended commands:");
    for (const command of payload.recommendedCommands || []) lines.push(`- ${command}`);
    if ((payload.authorizedCommands || []).length > 0) {
      lines.push("authorized commands:");
      for (const command of payload.authorizedCommands) lines.push(`- ${command}`);
    }
    if (payload.authorization) {
      lines.push(`authorization pack: ${payload.authorization.status || "unknown"}`);
      if (payload.authorization.path) lines.push(`authorization pack path: ${payload.authorization.path}`);
      lines.push(`authorized commands executable: ${payload.authorization.authorizedCommandsExecutable}`);
      if ((payload.authorization.blockers || []).length > 0) {
        lines.push("authorization blockers:");
        for (const blocker of payload.authorization.blockers) lines.push(`- ${blocker}`);
      }
      if (payload.authorization.diagnostics) {
        lines.push("authorization diagnostics:");
        if ((payload.authorization.diagnostics.operationClassMappings || []).length > 0) {
          lines.push("operation class mappings:");
          for (const entry of payload.authorization.diagnostics.operationClassMappings) {
            lines.push(`- ${entry.operation_class} -> ${entry.package_script}`);
          }
        }
        if ((payload.authorization.diagnostics.secretAllowlistRequired || []).length > 0) {
          lines.push("secret allowlist required:");
          for (const secret of payload.authorization.diagnostics.secretAllowlistRequired) lines.push(`- ${secret}`);
        }
        if ((payload.authorization.diagnostics.secretAllowlistMappings || []).length > 0) {
          lines.push("secret allowlist mappings:");
          for (const entry of payload.authorization.diagnostics.secretAllowlistMappings) {
            lines.push(`- ${entry.operation_class}: ${entry.secrets.join(", ")}`);
          }
        }
        if ((payload.authorization.diagnostics.apiAllowlistRequired || []).length > 0) {
          lines.push("api allowlist required:");
          for (const api of payload.authorization.diagnostics.apiAllowlistRequired) lines.push(`- ${api}`);
        }
        if ((payload.authorization.diagnostics.apiAllowlistMappings || []).length > 0) {
          lines.push("api allowlist mappings:");
          for (const entry of payload.authorization.diagnostics.apiAllowlistMappings) {
            lines.push(`- ${entry.operation_class}: ${entry.apis.join(", ")}`);
          }
        }
        if ((payload.authorization.diagnostics.rollbackCommands || []).length > 0) {
          lines.push("rollback commands:");
          for (const command of payload.authorization.diagnostics.rollbackCommands) lines.push(`- ${command}`);
        }
        if (payload.authorization.diagnostics.evidenceSink) {
          lines.push(`evidence sink: ${payload.authorization.diagnostics.evidenceSink}`);
        }
      }
    }
    if (payload.mode === "run-plan" && payload.report?.commands) {
      lines.push("run-plan commands:");
      lines.push(`- planned: ${payload.report.commands.planned.length}`);
      lines.push(`- executed: ${payload.report.commands.executed.length}`);
      lines.push(`- skipped authorized: ${payload.report.commands.skippedAuthorized.length}`);
      lines.push(`- authorized executed: ${payload.report.commands.authorizedExecuted?.length || 0}`);
    }
    if (payload.preflight) {
      lines.push(`preflight ok: ${payload.preflight.ok}`);
      if ((payload.preflight.checks || []).length > 0) {
        lines.push("preflight checks:");
        for (const check of payload.preflight.checks) {
          lines.push(`- [${check.ok ? "ok" : "missing"}] ${check.id}${check.path ? ` (${check.path})` : ""}`);
        }
      }
      if ((payload.preflight.missing || []).length > 0) {
        lines.push("preflight missing:");
        for (const item of payload.preflight.missing) {
          lines.push(`- ${item.id}${item.path ? ` (${item.path})` : ""}`);
        }
      }
      if ((payload.preflight.recommendedSetupCommands || []).length > 0) {
        lines.push("preflight recommended setup:");
        for (const command of payload.preflight.recommendedSetupCommands) lines.push(`- ${command}`);
      }
    }
    lines.push("cannot claim:");
    for (const claim of payload.cannotClaim || []) lines.push(`- ${claim}`);
    return `${lines.join("\n")}\n`;
  }
  if (payload.mode === "cloud-release-candidate") {
    lines.push(`receipt manifest: ${payload.receiptManifestRef}`);
    lines.push(`cloud release candidate complete: ${payload.cloudReleaseCandidateComplete}`);
    lines.push(`production complete: ${payload.productionComplete}`);
    if ((payload.missingReceiptTypes || []).length > 0) {
      lines.push("missing receipt types:");
      for (const type of payload.missingReceiptTypes) lines.push(`- ${type}`);
    }
    if ((payload.missingLifecycleSections || []).length > 0) {
      lines.push("missing lifecycle sections:");
      for (const section of payload.missingLifecycleSections) lines.push(`- ${section}`);
    }
    if ((payload.blockers || []).length > 0) {
      lines.push("blockers:");
      for (const blocker of payload.blockers) lines.push(`- ${blocker}`);
    }
    if ((payload.rawEvidenceViolations || []).length > 0) {
      lines.push("raw evidence violations:");
      for (const violation of payload.rawEvidenceViolations) lines.push(`- ${violation}`);
    }
    lines.push("cannot claim:");
    for (const claim of payload.cannotClaim || []) lines.push(`- ${claim}`);
    return `${lines.join("\n")}\n`;
  }
  if (payload.leafId) lines.push(`leaf: ${payload.leafId}`);
  if (payload.suiteId) lines.push(`suite: ${payload.suiteId}`);
  if (payload.packageId) lines.push(`package: ${payload.packageId}`);
  lines.push("commands:");
  for (const command of payload.commands || []) lines.push(`- ${command}`);
  if (payload.dryRun) lines.push("dry_run: true");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const { mode, target, options } = parseArgs(process.argv.slice(2));
  const [manifest, current] = await Promise.all([
    readJson(manifestPath),
    readJson(currentStatePath),
  ]);

  if (mode === "list") {
    const payload = {
      ok: true,
      mode: "list",
      manifest: manifestPath,
      defaultAgentEntrypoint: manifest.default_agent_entrypoint,
      leaves: manifest.leaves.map((leaf) => leaf.leaf_id),
      suites: manifest.suites.map((suite) => suite.id),
      packages: manifest.package_suites.map((suite) => suite.id),
    };
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
    return;
  }

  if (mode === "active-platform") {
    const payload = await validateActivePlatform({
      manifest,
      current,
    });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`Active platform validation passed for ${payload.currentCursor}.\n`);
    }
    return;
  }

  if (mode === "plan") {
    const payload = planForOptions({
      options,
      base: options.base || "origin/recovery/platform-v22-trunk",
    });
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
    return;
  }

  if (mode === "run-plan") {
    const payload = await runPlanForOptions({
      options,
      base: options.base || "origin/recovery/platform-v22-trunk",
    });
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
    if (!payload.ok) process.exitCode = 1;
    return;
  }

  if (mode === "cloud-release-candidate") {
    const payload = await verifyCloudReleaseCandidate({
      base: options.base || "origin/recovery/platform-v22-trunk",
      receiptManifestPath: options["receipt-manifest"] || ".runtime/v22-cloud-authorization/run-v22-001/receipt-manifest.json",
    });
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
    if (!payload.ok) process.exitCode = 1;
    return;
  }

  if (!mode) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const bundle = commandBundle({
    mode,
    target,
    manifest,
    current,
    base: options.base || "origin/recovery/platform-v22-trunk",
    branchName: options.branch || currentBranchName(),
  });
  const payload = {
    ok: true,
    ...bundle,
    manifest: manifestPath,
    currentState: currentStatePath,
    dryRun: Boolean(options["dry-run"]),
    results: [],
  };

  if (!payload.dryRun) {
    for (const command of bundle.commands) {
      const result = runCommand(command);
      payload.results.push({
        command: result.command,
        status: result.status,
        ok: result.ok,
      });
      if (!result.ok) {
        if (result.stdout) process.stderr.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        payload.ok = false;
        break;
      }
    }
  }

  process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : renderHuman(payload));
  if (!payload.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
