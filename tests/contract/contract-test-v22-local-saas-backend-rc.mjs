import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TEST_LANE_REGISTRY,
  TEST_LANE_SUITES,
} from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const rcEvidence = [
  "tests/contract/contract-test-v22-local-service-orchestration.mjs",
  "tests/contract/contract-test-v22-precloud-deployable-rc.mjs",
  "tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs",
  "tests/regression/opl/regression-test-v22-gateway-live-probe.mjs",
  "tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs",
];

const forbiddenTruthClaims = [
  "production runtime is complete",
  "production billing is complete",
  "real cloud is ready",
  "live provider is ready",
  "真实云已完成",
  "生产 runtime 已完成",
  "生产 billing 已完成",
  "真实 provider 已完成",
];

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_forbidden:${marker}`);
}

function registryEntry(file) {
  return TEST_LANE_REGISTRY.find((entry) => entry.file === file);
}

function assertRegistered(file, expected = {}) {
  const entry = registryEntry(file);
  assert(entry, `local_saas_backend_rc_evidence_not_registered:${file}`);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(entry[key], value, `local_saas_backend_rc_registry_${key}_mismatch:${file}`);
  }
  return entry;
}

function assertSuiteContains(suiteId, file) {
  const suite = TEST_LANE_SUITES[suiteId] || [];
  assert(suite.includes(file), `local_saas_backend_rc_suite_missing:${suiteId}:${file}`);
}

const [
  active,
  history,
  delivery,
  source,
  runtime,
  evidence,
  current,
  manifest,
  localServices,
  gatewayProbe,
  runtimeProbe,
] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/history/README.md"),
  readRepoFile("docs/delivery/README.md"),
  readRepoFile("docs/source/README.md"),
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("docs/evidence/README.md"),
  readJson("tests/fixtures/v22/goal-current.json"),
  readJson("tests/fixtures/v22/agent-verify-manifest.json"),
  readRepoFile("scripts/v22-local-services.mjs"),
  readRepoFile("tests/regression/opl/regression-test-v22-gateway-live-probe.mjs"),
  readRepoFile("tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs"),
]);

assertRegistered("tests/contract/contract-test-v22-local-saas-backend-rc.mjs", {
  surface: "control-plane",
  category: "default/local-contract",
  entryKind: "gate-self-test",
});
assertSuiteContains("current", "tests/contract/contract-test-v22-local-saas-backend-rc.mjs");
assertSuiteContains("local-contract", "tests/contract/contract-test-v22-local-saas-backend-rc.mjs");
assertSuiteContains("review", "tests/contract/contract-test-v22-local-saas-backend-rc.mjs");

for (const file of rcEvidence) {
  assertRegistered(file);
  assert(manifest.suites.some((suite) => suite.commands.includes(`node ${file}`)), `manifest_suite_must_include_rc_evidence:${file}`);
}

for (const file of [
  "tests/regression/opl/regression-test-v22-gateway-live-probe.mjs",
  "tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs",
]) {
  assertSuiteContains("local-regression", file);
}

for (const file of [
  "tests/contract/contract-test-v22-local-service-orchestration.mjs",
  "tests/contract/contract-test-v22-precloud-deployable-rc.mjs",
  "tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs",
]) {
  assertSuiteContains("local-contract", file);
}

assertIncludes(current.current_leaf.verification_commands.join("\n"), "node tests/contract/contract-test-v22-local-saas-backend-rc.mjs", "machine_current_leaf_must_run_local_saas_backend_rc");
assertIncludes(manifest.suites.find((suite) => suite.id === "current").commands.join("\n"), "node tests/contract/contract-test-v22-local-saas-backend-rc.mjs", "manifest_current_suite_must_run_local_saas_backend_rc");
assertIncludes(manifest.suites.find((suite) => suite.id === "review").commands.join("\n"), "node tests/contract/contract-test-v22-local-saas-backend-rc.mjs", "manifest_review_suite_must_run_local_saas_backend_rc");

for (const marker of [
  "portal-frontend",
  "go-backend",
  "opl-web-gateway",
  "runtime-bridge",
  "clean-opl-webui",
]) {
  assertIncludes(localServices, marker, "local_service_orchestration_must_cover_service");
}
const servicePlanResult = spawnSync("node", ["scripts/v22-local-services.mjs", "plan", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: "pipe",
});
assert.equal(servicePlanResult.status, 0, `local_service_plan_failed:${servicePlanResult.stderr || servicePlanResult.stdout}`);
const servicePlan = JSON.parse(servicePlanResult.stdout);
for (const forbidden of ["secret", "live-cloud", "deploy", "kubectl", "build-push"]) {
  assert(servicePlan.forbiddenOps.includes(forbidden), `local_service_plan_must_declare_forbidden_op:${forbidden}`);
}
for (const service of servicePlan.services) {
  for (const forbidden of ["services/portal/src", "kubectl", "docker build", "docker push", "SecretId", "SecretKey"]) {
    assertNotIncludes(JSON.stringify(service), forbidden, "local_service_command_must_not_reintroduce_forbidden_surface");
  }
}

for (const [label, sourceText] of Object.entries({ gatewayProbe, runtimeProbe })) {
  assertIncludes(sourceText, "cannotClaim", `${label}_probe_must_declare_cannot_claim`);
  assertIncludes(sourceText, "real_cloud", `${label}_probe_must_block_real_cloud_claim`);
  assertIncludes(sourceText, "live_provider", `${label}_probe_must_block_live_provider_claim`);
  assertNotIncludes(sourceText, "~/.secrets", `${label}_probe_must_not_read_user_secret_path`);
  assertNotIncludes(sourceText, "secrets.env", `${label}_probe_must_not_read_secret_env_file`);
}
assertIncludes(runtimeProbe, "dummy-local-provider-key", "runtime_probe_must_use_dummy_provider_key_only");
assertIncludes(runtimeProbe, "must_not_expose_provider_key_payload", "runtime_probe_must_assert_no_provider_key_echo");
assertIncludes(gatewayProbe, "local_stub_only", "gateway_probe_must_mark_local_stub_evidence");
assertIncludes(runtimeProbe, "local_fake_runtime_only", "runtime_probe_must_mark_local_fake_evidence");

for (const [label, sourceText] of Object.entries({ active, history, delivery, source, runtime, evidence })) {
  for (const forbidden of forbiddenTruthClaims) {
    assertNotIncludes(sourceText, forbidden, `${label}_must_not_make_false_production_claim`);
  }
}

for (const marker of [
  "local SaaS backend RC",
  "local deterministic evidence",
  "Gateway local live probe",
  "Runtime Bridge local fake probe",
  "不能把 local SaaS backend RC 写成真实云",
  "live provider",
  "production runtime",
  "production billing",
  "production deploy",
]) {
  assertIncludes(active, marker, "active_truth_must_summarize_local_saas_backend_rc");
}

assertIncludes(history, "Purpose: `history_archive_index`", "history_must_be_archive_index");
assertIncludes(history, "changes/archive/", "history_must_point_to_archive_root");
assertIncludes(history, "tests/fixtures/v22/goal-current.json", "history_must_point_to_machine_cursor");
assert.equal(/^###\s+\d{4}-\d{2}-\d{2}\s+/mu.test(history), false, "history_must_not_store_local_rc_markdown_database");
assertIncludes(active, "local-saas-backend-rc", "active_truth_must_record_local_saas_backend_rc");
for (const file of [
  "tests/contract/contract-test-v22-local-service-orchestration.mjs",
  "tests/regression/opl/regression-test-v22-gateway-live-probe.mjs",
  "tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs",
]) {
  assertRegistered(file);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_local_saas_backend_rc",
  evidence: rcEvidence,
  canClaim: [
    "local SaaS backend RC evidence is repo-native and registered",
    "Gateway and Runtime Bridge local probes are covered by local-regression",
    "current/review/local-contract run the aggregate RC guard",
  ],
  cannotClaim: [
    "real cloud",
    "live provider",
    "production runtime",
    "production billing",
    "production deploy",
  ],
}, null, 2));
