import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/specs/README.md";
const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const readmePath = "docs/specs/README.md";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs";
const smokePath = "tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs";

function commandFiles(commands = []) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const contract = await readFile(contractPath, "utf8");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const readme = await readFile(readmePath, "utf8");
const smoke = await readFile(smokePath, "utf8");
const realCloudReadinessFiles = commandFiles(manifest.suites.find((suite) => suite.id === "real-cloud-readiness")?.commands || []);

assertIncludesAll(contract, [
  "TC3 Diagnostic Cleanup Plan",
  "hand-rolled TC3 当前降级为 diagnostic/reference only",
  "official SDK readonly live 跑通前，不删除 TC3",
  "official SDK readonly live 跑通后，需要 cleanup TC3 production path",
], "tc3_cleanup_plan_scope");

assertIncludesAll(contract, [
  "official SDK wrapper 合并",
  "official SDK 依赖合并",
  "official SDK readonly live 成功生成脱敏 report",
  "B 审查确认 future authorized provider candidate 不再依赖 TC3",
], "tc3_cleanup_exit_conditions");

assertIncludesAll(contract, [
  "runner future authorized default candidate 不再使用 tencent-tc3-readonly",
  "TC3 smoke 改为 diagnostic fixture 或删除",
  "TC3 live bridge 从生产路径退场",
  "保留/删除策略由 cleanup 分支决定",
], "tc3_cleanup_contents");

assertIncludesAll(contract, [
  "当前不删除 TC3",
  "不读 secret",
  "不调用真实云",
  "不改 official SDK implementation",
  "不改 create/release",
], "tc3_cleanup_non_goals");

assertIncludesAll(contract, [
  "\"contract\": \"v22_tencent_tc3_diagnostic_cleanup_plan\"",
  "\"tc3CurrentRole\": \"diagnostic_reference_only\"",
  "\"deleteTc3Now\": false",
  "\"callRealCloudNow\": false",
  "\"readSecretNow\": false",
  "\"changesOfficialSdkImplementation\": false",
  "\"changesCreateRelease\": false",
  "\"cleanupRequiresOfficialSdkWrapperMerged\": true",
  "\"cleanupRequiresOfficialSdkDependencyMerged\": true",
  "\"cleanupRequiresOfficialSdkReadonlyLiveRedactedReport\": true",
  "\"cleanupRequiresBAuditProductionDefaultNoTc3\": true",
  "\"runnerProductionDefaultMustNotUseTencentTc3ReadonlyAfterCleanup\": true",
  "\"tc3SmokePolicy\": \"diagnostic_fixture_or_delete\"",
  "\"tc3LiveBridgeProductionPathAfterCleanup\": \"retired\"",
  "\"retainOrDeleteDecisionOwner\": \"cleanup_branch\"",
], "tc3_cleanup_contract_data");

assertIncludesAll(readme, [
  "spec:v22-tencent-tc3-diagnostic-cleanup-plan",
  "TC3 diagnostic cleanup plan",
  "official SDK readonly live 成功生成脱敏 report",
], "tc3_cleanup_readme");

assert(realCloudReadinessFiles.includes(selfFile), "real_cloud_readiness_suite_must_include_tc3_cleanup_plan_contract");

assertNotIncludesAny(contract, [
  "\"deleteTc3Now\": true",
  "\"callRealCloudNow\": true",
  "\"readSecretNow\": true",
  "\"changesOfficialSdkImplementation\": true",
  "\"changesCreateRelease\": true",
  "TC3 当前删除",
  "当前删除 TC3",
], "tc3_cleanup_forbidden_claims");

assertNotIncludesAny(smoke, [
  ["process", "env"].join("."),
  ["exec", "Sync"].join(""),
  ["spawn", "Sync"].join(""),
  ["tencentcloud", "sdk", "nodejs"].join("-"),
  ["RUN", "TENCENT", "READONLY", "INVENTORY"].join("_"),
  ["Secret", "Id"].join(""),
  ["Secret", "Key"].join(""),
  [".", "env"].join(""),
  ["kube", "ctl"].join(""),
  ["live", "test"].join("-"),
], "tc3_cleanup_smoke_must_stay_static");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_tc3_diagnostic_cleanup_plan",
  checked: [
    "tc3_is_diagnostic_reference_only",
    "cleanup_exit_conditions",
    "cleanup_contents",
    "current_non_goals",
    "contract_data",
    "readme_and_suite_registration",
    "static_smoke_no_secret_no_cloud",
  ],
}, null, 2));
