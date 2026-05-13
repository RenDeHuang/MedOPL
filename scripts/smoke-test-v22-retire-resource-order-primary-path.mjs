import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const gatePath = "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs";
const allowedGateOnlyDiffPaths = new Set([
  gatePath,
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
]);

const repoZoningPath = "docs/recovery/repo-zoning.md";
const legacyBacklogPath = "docs/recovery/legacy-cleanup-backlog.md";
const defaultEntryPaths = [
  "README.md",
  "docs/product.md",
  "docs/architecture.md",
  "compose.product.yaml",
];

const resourceOrderTokens = [
  /\bresource-order\b/iu,
  /\bresource_order\b/iu,
  /\bresourceOrderId\b/u,
  /\bresource order\b/iu,
];

const allowedRetirementContext = /不是|不得|不作为|退场|退役|清退|legacy|migration-only|只作|只作为|optional/iu;

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertZoningRow(source, pathPattern, zone, action) {
  assertIncludes(
    source,
    `| \`${pathPattern}\` | ${zone} | ${action} |`,
    `repo_zoning_${pathPattern.replaceAll("*", "star").replaceAll("/", "_").replaceAll("-", "_")}`,
  );
}

function changedFilesFromBase() {
  const commands = [
    ["diff", "--name-only", "origin/recovery/platform-v22-trunk"],
    ["ls-files", "--others", "--exclude-standard"],
  ];

  const files = [];
  for (const args of commands) {
    const result = spawnSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
    files.push(...result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean));
  }
  return [...new Set(files)];
}

function assertOnlyGateChanged() {
  for (const filePath of changedFilesFromBase()) {
    assert(allowedGateOnlyDiffPaths.has(filePath), `resource_order_gate_branch_must_not_modify:${filePath}`);
  }
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function lineAt(source, offset) {
  const start = source.lastIndexOf("\n", offset) + 1;
  const end = source.indexOf("\n", offset);
  return source.slice(start, end === -1 ? source.length : end);
}

function assertNoDefaultResourceOrderPath(filePath, source) {
  for (const token of resourceOrderTokens) {
    for (const match of source.matchAll(new RegExp(token.source, token.flags.includes("g") ? token.flags : `${token.flags}g`))) {
      const line = lineAt(source, match.index ?? 0);
      assert(
        allowedRetirementContext.test(line),
        `${filePath}:${lineNumber(source, match.index ?? 0)}_must_not_make_resource_order_default_path:${line.trim()}`,
      );
    }
  }
}

function assertNoRequiredResourceOrderIdInContracts(filePath, source) {
  const findings = [];
  const requiredPrimaryPattern = /(?:fixed|required|mandatory|must|必须|固定|必填|主标签|主归因|primary|requiredTag|requiredTags|fixedTags)[^\n`|,[\]]{0,160}\bresourceOrderId\b|\bresourceOrderId\b[^\n`|,[\]]{0,160}(?:fixed|required|mandatory|must|必须|固定|必填|主标签|主归因|primary|requiredTag|requiredTags|fixedTags)/gu;
  for (const match of source.matchAll(requiredPrimaryPattern)) {
    findings.push({
      file: filePath,
      line: lineNumber(source, match.index ?? 0),
      match: match[0].replace(/\s+/g, " ").trim(),
      type: "resource_order_id_required_primary_tag",
    });
  }

  for (const match of source.matchAll(/\bresourceOrderId\b/g)) {
    const contextStart = Math.max(0, (match.index ?? 0) - 180);
    const contextEnd = Math.min(source.length, (match.index ?? 0) + 220);
    const context = source.slice(contextStart, contextEnd);
    if (!context.includes("legacyResourceOrderId")) {
      findings.push({
        file: filePath,
        line: lineNumber(source, match.index ?? 0),
        match: match[0],
        type: "resource_order_id_not_legacy_resource_order_id",
      });
    }
  }

  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_retire_resource_order_primary_path",
    findings,
  }, null, 2));
}

async function contractFiles() {
  const contractsDir = path.join(repoRoot, "docs/contracts");
  const names = await readdir(contractsDir);
  return [
    "docs/contracts/README.md",
    ...names
      .filter((name) => /^v22-.*\.md$/u.test(name))
      .sort()
      .map((name) => `docs/contracts/${name}`),
  ];
}

assertOnlyGateChanged();

const repoZoning = await readRepoFile(repoZoningPath);
const legacyBacklog = await readRepoFile(legacyBacklogPath);

for (const [pathPattern, action] of [
  ["services/portal/src/domain/resource-orders.mjs", "tombstone/rewrite"],
  ["services/portal/src/domain/resource-order-*.mjs", "tombstone/rewrite"],
  ["services/portal/src/routes/resource-order*.mjs", "tombstone/delete"],
  ["services/portal/src/state/portal-resource-order-store.mjs", "tombstone/rewrite"],
]) {
  assertZoningRow(repoZoning, pathPattern, "Zone 2", action);
}

assertIncludes(repoZoning, "`resource-order` 不得作为 v22 主产品叙事", "repo_zoning_resource_order_retirement_reason");
assertIncludes(repoZoning, "managed environment/resource binding lifecycle", "repo_zoning_resource_order_replacement_lifecycle");
assertIncludes(repoZoning, "managed environment/resource binding routes", "repo_zoning_resource_order_replacement_routes");
assertIncludes(repoZoning, "managed environment/resource binding persistence", "repo_zoning_resource_order_replacement_persistence");

assertIncludes(legacyBacklog, "## Slice 3: resource-order Primary Path Retirement", "legacy_backlog_resource_order_slice");
assertIncludes(legacyBacklog, "`cleanup/v22-retire-resource-order-primary-path`", "legacy_backlog_resource_order_branch_record");
assertIncludes(legacyBacklog, "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs", "legacy_backlog_resource_order_gate_name");
assertIncludes(legacyBacklog, "Portal 导航不链接 `resource-order` 主路径", "legacy_backlog_resource_order_navigation_gate");
assertIncludes(legacyBacklog, "新开通路径走 managed environment / resource binding", "legacy_backlog_resource_binding_replacement");
assertIncludes(legacyBacklog, "旧 prepare-run 或 resource-order public flow 只能 tombstone 或 legacy internal fence", "legacy_backlog_resource_order_tombstone_scope");

for (const filePath of defaultEntryPaths) {
  assertNoDefaultResourceOrderPath(filePath, await readRepoFile(filePath));
}

const requiredLegacyAliasContracts = [
  "docs/contracts/v22-admin-ops-console-boundary.md",
  "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
  "docs/contracts/v22-authorized-tencent-create-release-boundary.md",
];

for (const filePath of requiredLegacyAliasContracts) {
  const source = await readRepoFile(filePath);
  assertIncludes(
    source,
    "`legacyResourceOrderId` 仅可作为 optional、migration-only alias，不得作为 v22 fixed required tag",
    `${filePath}_legacy_resource_order_id_optional_migration_only`,
  );
}

for (const filePath of await contractFiles()) {
  assertNoRequiredResourceOrderIdInContracts(filePath, await readRepoFile(filePath));
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_retire_resource_order_primary_path",
  branchScope: {
    gateOnly: true,
    doesNotRequireServiceDeletion: true,
    allowedTrackedChanges: [...allowedGateOnlyDiffPaths],
  },
  checked: {
    repoZoning: repoZoningPath,
    legacyBacklog: legacyBacklogPath,
    defaultEntrypoints: defaultEntryPaths,
    contractFiles: await contractFiles(),
  },
}, null, 2));
