#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readText(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertExists(relativePath) {
  assert.equal(existsSync(path.join(ROOT, relativePath)), true, `required_file_missing:${relativePath}`);
}

function assertMissing(relativePath) {
  assert.equal(existsSync(path.join(ROOT, relativePath)), false, `retired_file_must_be_deleted:${relativePath}`);
}

function assertIncludes(source, needle, context) {
  assert(source.includes(needle), `${context}_missing:${needle}`);
}

function assertNotIncludes(source, needle, context) {
  assert.equal(source.includes(needle), false, `${context}_must_not_include:${needle}`);
}

const indexPath = "docs/recovery/v22-contract-eval-compaction-index.md";
const renamedLoopGate = "scripts/smoke-test-v22-mvp-user-loop-contract.mjs";
const retiredLoopGate = "scripts/smoke-test-v22-canonical-user-loop-contract.mjs";
const agentRunPath = "docs/recovery/agent-runs/2026-05-20-cleanup-v22-contract-eval-compaction.md";

assertExists(indexPath);
assertExists(renamedLoopGate);
assertMissing(retiredLoopGate);
assertExists(agentRunPath);

const truthFreeze = readText("docs/recovery/v22-truth-freeze.md");
[
  "用户在 Portal 主动开通托管计算资源和文件空间",
  "平台代管底层云资源",
  "普通用户不直接配置 CVM、COS、K8s",
  "用户删除文件空间才进入 7 天保护期",
  "释放计算资源不触发文件空间 7 天保护期",
].forEach((needle) => assertIncludes(truthFreeze, needle, "docs/recovery/v22-truth-freeze.md"));
assertNotIncludes(truthFreeze, "## 物理清退边界", "docs/recovery/v22-truth-freeze.md");

const activeTruth = readText("docs/active/README.md");
[
  "用户在 Portal 主动开通托管计算资源和文件空间",
  "用户删除文件空间才进入 7 天保护期",
  "释放计算资源不触发文件空间 7 天保护期",
].forEach((needle) => assertIncludes(activeTruth, needle, "docs/active/README.md"));

[
  "用户在 Portal 主动开通托管计算资源和文件空间",
  "平台代管底层云资源",
  "用户删除文件空间才进入 7 天保护期",
].forEach((needle) => assertIncludes(activeTruth, needle, "docs/active/README.md"));

const classification = readText("scripts/v22-smoke-classification.mjs");
assertIncludes(classification, `"${renamedLoopGate}": "default/local-contract"`, "scripts/v22-smoke-classification.mjs");
assertIncludes(classification, `"${renamedLoopGate}"`, "scripts/v22-smoke-classification.mjs");
assertNotIncludes(classification, retiredLoopGate, "scripts/v22-smoke-classification.mjs");
assertIncludes(
  classification,
  `"scripts/smoke-test-v22-contract-eval-compaction.mjs": "default/local-contract"`,
  "scripts/v22-smoke-classification.mjs",
);

const index = readText(indexPath);
[
  "| File | Layer | Role | Decision | Replacement / Authority | Notes |",
  "contracts / truth / index / eval / agent-runs",
  "docs/contracts/v22-mvp-managed-opl-loop.md",
  "docs/recovery/v22-truth-freeze.md",
  renamedLoopGate,
  "rename",
  "keep",
  "future-authorized",
  "已清退阶段文件索引",
  "清退证据属于 index / agent-runs / eval 语境",
].forEach((needle) => assertIncludes(index, needle, indexPath));
[
  "docs/recovery/v22-ai-frontend-backend-development-framework.md",
  "docs/contracts/v22-canonical-user-loop.md",
].forEach((needle) => assertIncludes(index, needle, indexPath));
assertNotIncludes(index, "v22-ai-frontend-backend-development-framework.md |", indexPath);
assertNotIncludes(index, "v22-canonical-user-loop.md |", indexPath);

const manifest = readText("docs/recovery/v22-agent-verify-manifest.json");
[
  "cleanup/v22-contract-eval-compaction",
  "node scripts/smoke-test-v22-contract-eval-compaction.mjs",
  "node scripts/smoke-test-v22-truth-freeze-physical-retirement.mjs",
  indexPath,
  renamedLoopGate,
  agentRunPath,
].forEach((needle) => assertIncludes(manifest, needle, "docs/recovery/v22-agent-verify-manifest.json"));
const compactionOverride = JSON.parse(manifest).branch_override_suites.find((suite) => suite.id === "contract-eval-compaction");
assert.ok(compactionOverride, "contract_eval_compaction_override_required");
assert.equal(
  compactionOverride.allowed_files.includes(retiredLoopGate),
  false,
  "retired_loop_gate_must_not_remain_in_active_allowed_files",
);
assert.deepEqual(compactionOverride.retired_files, [retiredLoopGate], "retired_loop_gate_must_be_recorded_as_retired_file");

const agentRun = readText(agentRunPath);
[
  "leaf_id",
  "cleanup-v22-contract-eval-compaction",
  "model",
  "gpt-5.4",
  "contract_subscription",
  "verification_commands",
  "b_review_result",
  "non_goals",
  "不调用真实云",
  "不读取 secret",
  "不修改 upstream",
].forEach((needle) => assertIncludes(agentRun, needle, agentRunPath));

console.log(JSON.stringify({
  ok: true,
  contract: "v22_contract_eval_compaction",
  indexPath,
  renamedLoopGate,
}, null, 2));
