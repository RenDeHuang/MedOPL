import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_LANE_SUITES } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const changeRoot = "changes/archive/2026-05-27-local-portal-opl-delivery-rc";
const selfFile = "tests/governance/governance-test-v22-local-portal-opl-delivery-rc.mjs";

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function commandFiles(commands) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

const files = {
  proposal: `${changeRoot}/proposal.md`,
  specDelta: `${changeRoot}/spec-delta.md`,
  design: `${changeRoot}/design.md`,
  tasks: `${changeRoot}/tasks.md`,
  evalPlan: `${changeRoot}/eval-plan.md`,
  review: `${changeRoot}/review.md`,
  closeout: `${changeRoot}/closeout.md`,
  active: "docs/active/README.md",
  product: "docs/product/README.md",
  runtime: "docs/runtime/README.md",
  source: "docs/source/README.md",
  delivery: "docs/delivery/README.md",
  localServices: "scripts/v22-local-services.mjs",
  manifest: "tests/fixtures/v22/agent-verify-manifest.json",
  current: "tests/fixtures/v22/goal-current.json",
};

const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, repoPath]) => [key, await readRepoFile(repoPath)])));
const packageText = [sources.proposal, sources.specDelta, sources.design, sources.tasks, sources.evalPlan, sources.review, sources.closeout].join("\n");

for (const required of [
  "Portal local delivery",
  "OPL local delivery",
  "Cloud delivery is frozen",
  "real-cloud-authorization-boundary",
  "providerKeyRef",
  "Gateway",
  "Runtime Bridge",
  "clean upstream",
]) {
  assertIncludes(packageText, required, "local_delivery_package_boundary");
}

for (const requirementId of [
  "product:local-portal-delivery-rc",
  "runtime:local-clean-opl-delivery-rc",
  "operations:local-release-orchestration",
]) {
  assertIncludes(sources.specDelta, requirementId, "local_delivery_requirement_id");
}

const manifest = JSON.parse(sources.manifest);
const current = JSON.parse(sources.current);
const manifestSuites = new Map(manifest.suites.map((suite) => [suite.id, suite]));
for (const suite of ["local-contract", "current", "review"]) {
  assert(TEST_LANE_SUITES[suite].includes(selfFile), `local_delivery_registry_suite_missing:${suite}`);
  assert(commandFiles(manifestSuites.get(suite)?.commands || []).includes(selfFile), `local_delivery_manifest_suite_missing:${suite}`);
}
assert(commandFiles(current.current_leaf.verification_commands).includes(selfFile), "local_delivery_current_leaf_command_missing");

for (const command of [
  "node scripts/v22-local-services.mjs check --dry-run --json",
  "npm run verify:golden-path -- --json",
  "npm run verify:current -- --json",
  "npm run test:regression -- --json",
]) {
  assertIncludes(sources.evalPlan, command, "local_delivery_eval_plan");
}

for (const forbidden of [
  /production (?:deploy|runtime|cloud|billing) (?:is )?(?:complete|ready|live)/iu,
  /real cloud (?:is )?(?:complete|ready|live|authorized)/iu,
  /live provider (?:is )?(?:complete|ready|authorized)/iu,
  /MedOPL owns upstream source/iu,
  /one-person-lab upstream is MedOPL source truth/iu,
]) {
  assert.equal(forbidden.test(packageText), false, `local_delivery_package_false_claim:${forbidden}`);
}

assertIncludes(packageText, "Do not copy one-person-lab", "local_delivery_must_keep_upstream_copy_non_goal");
assertIncludes(packageText, "Do not modify one-person-lab", "local_delivery_must_keep_upstream_modify_non_goal");

for (const truth of [sources.active, sources.source, sources.delivery]) {
  assertIncludes(truth, "real-cloud-authorization-boundary", "truth_must_keep_cloud_boundary_visible");
}

assertIncludes(sources.source, "services/portal/frontend", "source_must_name_portal_frontend");
assertIncludes(sources.source, "services/medopl-go-backend", "source_must_name_go_backend");
assertIncludes(sources.source, "services/opl-web-gateway", "source_must_name_gateway");
assertIncludes(sources.source, "services/opl-runtime-bridge", "source_must_name_runtime_bridge");
assertIncludes(packageText, "start/stop/status/logs", "local_delivery_must_plan_release_orchestration_modes");
assertIncludes(sources.localServices, "plan", "local_services_script_must_keep_plan_mode");
assertIncludes(sources.localServices, "check", "local_services_script_must_keep_check_mode");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_local_portal_opl_delivery_rc",
  changeRoot,
  modules: ["portal-local-delivery", "opl-local-delivery", "cloud-fail-closed"],
}, null, 2));
