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

function assertIncludes(text, needle, context) {
  assert(text.includes(needle), `${context}_missing:${needle}`);
}

function assertNotIncludes(text, needle, context) {
  assert.equal(text.includes(needle), false, `${context}_must_not_include:${needle}`);
}

const freezePath = "docs/recovery/v22-truth-freeze.md";
const agentRunPath = "docs/recovery/agent-runs/2026-05-19-cleanup-v22-truth-freeze-and-doc-physical-retirement.md";
assertExists(freezePath);
assertExists(agentRunPath);

const freeze = readText(freezePath);
[
  "业务闭环真相",
  "当前阶段真相",
  "MVP active 套餐真相",
  "释放语义真相",
  "OPL 能力分层真相",
  "数据归属真相",
  "云真相",
  "代码解耦真相",
  "AI 开发治理真相",
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "future-authorized",
  "120min",
  "T+1",
  "desired state",
  "actual state",
  "reconciled state",
  "Portal 内部 operation/job/projection/reconciliation",
  "secret plane、object/blob plane、runtime state plane 仍属本地/过渡实现",
  "contracts / truth / index / eval / agent-runs",
].forEach((needle) => assertIncludes(freeze, needle, freezePath));
assertNotIncludes(freeze, "## 物理清退边界", freezePath);

const compactionIndex = readText("docs/recovery/v22-contract-eval-compaction-index.md");
[
  "已清退阶段文件索引",
  "清退证据属于 index / agent-runs / eval 语境",
  "docs/recovery/v22-ai-frontend-backend-development-framework.md",
  "docs/specs/README.md",
].forEach((needle) => assertIncludes(compactionIndex, needle, "docs/recovery/v22-contract-eval-compaction-index.md"));

const activeTruth = readText("docs/active/README.md");
[
  "当前阶段真相",
  "当前 MVP active 套餐只有",
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "叠加计算、叠加存储和自定义规格属于 future-authorized",
  "120min",
  "T+1",
  "释放托管运行环境不等于删除文件空间",
].forEach((needle) => assertIncludes(activeTruth, needle, "docs/active/README.md"));

[
  "数据与云控制面真相",
  "Portal canonical truth",
  "Redis 不是事实源",
  "Object/blob plane",
  "desired state",
  "actual state",
  "reconciled state",
  "代码解耦真相",
  "Gateway = 入口反腐层",
  "Runtime Bridge = launch/session/run/artifact/trace 的 canonical integration boundary",
  "Portal 内部 operation/job/projection/reconciliation",
].forEach((needle) => assertIncludes(activeTruth, needle, "docs/active/README.md"));

const manifest = readText("docs/recovery/v22-agent-verify-manifest.json");
[
  "cleanup/v22-truth-freeze-and-doc-physical-retirement",
  "node tests/contract/contract-test-v22-truth-freeze-physical-retirement.mjs",
  "docs/recovery/v22-truth-freeze.md",
  "docs/recovery/v22-goal-current.json",
  "docs/recovery/v22-goal-leaf-manifest.schema.json",
].forEach((needle) => assertIncludes(manifest, needle, "docs/recovery/v22-agent-verify-manifest.json"));

const classification = readText("scripts/v22-test-classification.mjs");
assertIncludes(
  classification,
  "\"tests/contract/contract-test-v22-truth-freeze-physical-retirement.mjs\": \"default/local-contract\"",
  "scripts/v22-test-classification.mjs",
);

assertMissing("docs/recovery/v22-ai-frontend-backend-development-framework.md");
assertMissing("docs/specs/README.md");

const contractsReadme = readText("docs/specs/README.md");
assertNotIncludes(contractsReadme, "spec:v22-canonical-user-loop", "docs/specs/README.md");
assertIncludes(contractsReadme, "spec:v22-truth-freeze", "docs/specs/README.md");

const agentRun = readText(agentRunPath);
[
  "leaf_id",
  "cleanup-v22-truth-freeze-and-doc-physical-retirement",
  "model",
  "gpt-5.4",
  "subagents_and_models",
  "branch",
  "base_trunk_head",
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
  contract: "v22_truth_freeze_physical_retirement",
  freezePath,
}, null, 2));
