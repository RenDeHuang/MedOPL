import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const inventoryPath = "tests/fixtures/v22/backend-go-convergence/backend-inventory.json";
const activeRoots = [
  "services/portal/src",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];
const classifications = ["correct-place", "misplaced", "migrate-later", "delete-later"];
const services = ["portal", "opl-web-gateway", "opl-runtime-bridge"];
const requiredRiskTags = [
  "portal_long_task",
  "cloud_mutation",
  "memory_launch_truth",
  "billing_audit_aggregation",
  "runtime_bridge_token_secret_boundary",
];

async function listMjsFiles(dir, prefix = dir) {
  const entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const absolutePath = path.join(repoRoot, repoPath);
    if (entry.isDirectory()) files.push(...await listMjsFiles(repoPath, repoPath));
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(repoPath);
  }
  return files.sort();
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function serviceForPath(repoPath) {
  if (repoPath.startsWith("services/portal/")) return "portal";
  if (repoPath.startsWith("services/opl-web-gateway/")) return "opl-web-gateway";
  if (repoPath.startsWith("services/opl-runtime-bridge/")) return "opl-runtime-bridge";
  return "";
}

function flattenInventoryGroups(groups) {
  const entries = [];
  for (const group of groups) {
    assert(classifications.includes(group.targetClassification), `invalid_classification:${group.id}`);
    assert(group.targetGoModule || group.nodeBoundary === true, `group_requires_target_or_node_boundary:${group.id}`);
    assert(Array.isArray(group.paths) && group.paths.length > 0, `group_paths_missing:${group.id}`);
    for (const repoPath of group.paths) {
      entries.push({
        path: repoPath,
        service: group.service,
        currentResponsibility: group.currentResponsibility,
        targetClassification: group.targetClassification,
        targetGoModule: group.targetGoModule || "",
        nodeBoundary: group.nodeBoundary === true,
        riskTags: group.riskTags || [],
      });
    }
  }
  return entries;
}

assert.equal(await exists(inventoryPath), true, "backend_inventory_fixture_missing");

const inventory = JSON.parse(await readFile(path.join(repoRoot, inventoryPath), "utf8"));
assert.equal(inventory.program, "backend_go_convergence_program", "inventory_program_mismatch");
assert.equal(inventory.version, 1, "inventory_version_mismatch");
assert.deepEqual(inventory.generatedFrom.services, activeRoots, "inventory_active_roots_mismatch");
assert.equal(inventory.generatedFrom.specAnchor, "spec:v22-backend-go-convergence-program-boundary", "inventory_spec_anchor_mismatch");
assert(Array.isArray(inventory.groups), "inventory_groups_must_be_array");
assert.deepEqual(inventory.requiredRiskTags, requiredRiskTags, "inventory_required_risk_tags_mismatch");

const actualFiles = (await Promise.all(activeRoots.map((root) => listMjsFiles(root)))).flat().sort();
const entries = flattenInventoryGroups(inventory.groups).sort((left, right) => left.path.localeCompare(right.path));
const inventoryFiles = entries.map((entry) => entry.path).sort();

assert.deepEqual(inventoryFiles, actualFiles, "inventory_must_cover_every_active_backend_file_once");

const seen = new Set();
for (const entry of entries) {
  assert.equal(seen.has(entry.path), false, `duplicate_inventory_file:${entry.path}`);
  seen.add(entry.path);
  assert.equal(await exists(entry.path), true, `inventory_file_missing_on_disk:${entry.path}`);
  assert(services.includes(entry.service), `invalid_service:${entry.path}`);
  assert.equal(entry.service, serviceForPath(entry.path), `service_path_mismatch:${entry.path}`);
  assert(entry.currentResponsibility, `current_responsibility_missing:${entry.path}`);
  assert(classifications.includes(entry.targetClassification), `invalid_file_classification:${entry.path}`);
  assert(entry.targetGoModule || entry.nodeBoundary === true, `file_requires_target_or_node_boundary:${entry.path}`);
  if (["misplaced", "delete-later"].includes(entry.targetClassification)) {
    assert(entry.riskTags.length > 0, `risky_classification_requires_risk_tags:${entry.path}`);
  }
}

for (const riskTag of requiredRiskTags) {
  assert(entries.some((entry) => entry.riskTags.includes(riskTag)), `inventory_missing_required_risk_tag:${riskTag}`);
}

for (const highRiskPath of inventory.highRiskPaths) {
  assert(inventoryFiles.includes(highRiskPath), `high_risk_path_must_be_inventory_file:${highRiskPath}`);
}

const forbiddenLegacyTargets = /user_owned_primary|resource_order_primary|opencost_primary|langfuse_primary_product/u;
assert.equal(forbiddenLegacyTargets.test(JSON.stringify(inventory)), false, "inventory_must_not_restore_legacy_primary_targets");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_backend_responsibility_inventory",
  files: entries.length,
  requiredRiskTags,
}, null, 2));
