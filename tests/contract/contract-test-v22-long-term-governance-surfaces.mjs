import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "../../scripts/v22-test-classification.mjs";

const statusPath = "docs/status.md";
const invariantsPath = "docs/invariants.md";
const decisionsPath = "docs/decisions.md";
const matrixPath = "docs/recovery/status-matrix.md";
const suitePath = "tests/contract/contract-test-v22-mvp-contract-suite.mjs";

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

function assertNotMatches(source, patterns, label) {
  for (const pattern of patterns) {
    assert.equal(pattern.test(source), false, `${label}_must_not_match:${pattern}`);
  }
}

const [status, invariants, decisions, matrix, suite] = await Promise.all([
  readFile(statusPath, "utf8"),
  readFile(invariantsPath, "utf8"),
  readFile(decisionsPath, "utf8"),
  readFile(matrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

const combinedGovernance = `${status}\n${invariants}\n${decisions}`;

assertIncludesAll(status, [
  "v22 Status",
  "v22 当前唯一人读状态入口",
  "active program: v22-contract-cleanup-and-drift-control",
  "current phase: 先清合同-smoke-实现漂移，不接云",
  "next phase: B 审核后再决定是否进入 future-authorized cloud lane",
  "所有真实云动作均需 future-authorized 显式授权",
  "canonical current truth: `docs/recovery/v22-goal-current.json`",
  "verify manifest: `docs/recovery/v22-agent-verify-manifest.json`",
  "eval entrypoint: `scripts/v22-verify.mjs`",
  "retained future-authorized references",
  "真实云 live/create/release/deploy 都必须用户显式授权",
], "status_surface");

assertIncludesAll(invariants, [
  "v22 Invariants",
  "不读 secret，除非用户显式授权",
  "不调用真实云，除非用户显式授权",
  "readonly inventory 与 create/release mutation 分离",
  "A/C/D 独立 worktree，B 主工作区审查合并",
  "B 审查、workflow gate、checkpoint 不能绕过",
  "普通用户不暴露 CVM/TKE/COS/K8s/云控制台语义",
  "文件空间和计算资源生命周期分离",
  "不恢复 user_owned/resource-order/旧云控制台叙事",
  "不自动 merge/push/build/push/kubectl",
  "cloud onboarding boards、program boards 和 `scripts/v22-agent-workflow.mjs` 只能作为 future-authorized / blocked-retain 参考",
], "invariants_surface");

assertIncludesAll(decisions, [
  "v22 Decisions",
  "production default provider 使用 Tencent official SDK wrapper",
  "TC3 保留为 diagnostic/reference",
  "official SDK live report 通过后再 cleanup",
  "cloud onboarding 保留为 future-authorized lane",
  "不是当前 active program 或默认执行入口",
  "真实外部副作用串行",
  "create/release 与 readonly 分离",
  "独立合同和 RUN gate",
], "decisions_surface");

for (const [label, source] of [
  ["status", status],
  ["invariants", invariants],
  ["decisions", decisions],
]) {
  assertIncludesAll(source, [
    "AGENTS",
    "contracts",
    "v22-goal-current.json",
    "v22-agent-verify-manifest.json",
    "v22-verify.mjs",
  ], `${label}_shared_references`);
}

assertIncludesAll(combinedGovernance, [
  "docs/specs/README.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-agent-verify-manifest.json",
  "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  "scripts/v22-verify.mjs",
  "scripts/v22-workflow-gate.mjs",
], "governance_cross_references");

assertIncludesAll(combinedGovernance, [
  "cloud-onboarding-execution-board.md",
  "v22-agent-workflow.mjs",
  "future-authorized",
  "blocked-retain",
], "retained_future_authorized_references");

assertNotIncludesAny(combinedGovernance, [
  "The active program is `v22-cloud-onboarding`",
  "execution board governs the active cloud onboarding program lane",
  "cloud onboarding 使用 execution board + status table + v22-agent-workflow 生成任务包",
  "当前 program/phase/lane/离场条件写在 cloud onboarding execution board",
], "root_governance_must_not_restore_old_active_cloud_program");

assertIncludesAll(matrix, [
  "long-term governance surfaces",
  "docs/status.md",
  "docs/invariants.md",
  "docs/decisions.md",
  "v22 当前唯一人读状态入口",
], "status_matrix_governance_references");

assert(isSmokeClassifiedIn("tests/contract/contract-test-v22-long-term-governance-surfaces.mjs"), "mvp_suite_must_include_long_term_governance_smoke");

assertNotIncludesAny(combinedGovernance, [
  "SecretId",
  "SecretKey",
  "kubeconfig",
  "raw cloud response",
  "rawCloudResponse",
  "token=",
  "TOKEN=",
  "Bearer ",
], "governance_must_not_contain_secret_artifacts");

assertNotMatches(combinedGovernance, [
  /\btoken\b/i,
], "governance_must_not_contain_standalone_secret_words");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_long_term_governance_surfaces",
  checked: [
    "status_is_single_live_status_entry",
    "invariants_capture_long_term_red_lines",
    "decisions_capture_current_effective_decisions",
    "verify_manifest_current_truth_references",
    "cloud_onboarding_references_are_retained_not_current_truth",
    "status_matrix_reference",
    "no_secret_artifacts",
  ],
}, null, 2));
