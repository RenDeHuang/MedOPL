#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    ["workspaces", "Workspace"],
    ["runtime", "RuntimeEnvironment"],
    ["files", "Workspace"],
    ["billing", "BillingAudit"],
    ["audit", "BillingAudit"],
    ["release", "Workspace"],
  ]);
  for (const page of pageMatrix.pages || []) {
    assert(routesSource.includes(routeMarkers.get(page.id) || page.id), `portal_page_matrix_not_covered:${page.id}`);
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
  assert.equal(releaseContract.authority_boundary.default_real_cloud_mutation, "forbidden_without_explicit_user_authorization", "release_boundary_must_forbid_default_real_cloud_mutation");
  assert(packageJson.scripts["verify:golden-path"], "golden_path_gate_script_missing");
  assert(packageJson.scripts["test:cloud"], "cloud_boundary_gate_script_missing");
  assert(packageJson.scripts["test:hygiene"], "secret_hygiene_gate_script_missing");

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
