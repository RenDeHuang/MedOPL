import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const docs = {
  productGoal: "docs/recovery/v22-product-goal.md",
  productE2eContract: "docs/recovery/v22-product-e2e-contract.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalLoop: "docs/recovery/v22-codex-goal-loop.md",
  developmentFramework: "docs/recovery/v22-ai-frontend-backend-development-framework.md",
  goalState: "docs/recovery/v22-goal-state.md",
  currentState: "docs/recovery/v22-goal-current.json",
  scoreboard: "docs/recovery/v22-product-completion-scoreboard.json",
  schema: "docs/recovery/v22-goal-leaf-manifest.schema.json",
};

const gatePath = "scripts/smoke-test-v22-product-goal-harness.mjs";
const executionOrderGatePath = "scripts/smoke-test-v22-product-goal-execution-order.mjs";
const consistencyGatePath = "scripts/smoke-test-v22-goal-state-consistency.mjs";

const allowedDiffPaths = new Set([
  ...Object.values(docs),
  gatePath,
  executionOrderGatePath,
  consistencyGatePath,
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs",
  "scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs",
  "scripts/smoke-test-v22-legacy-script-archive-boundary.mjs",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
]);

const branchScopedAllowedDiffPaths = new Map([
  ["cleanup/v22-goal-harness-consolidation", new Set([
    "docs/recovery/v22-goal-current.json",
    "docs/recovery/v22-product-completion-scoreboard.json",
    "docs/recovery/v22-goal-leaf-manifest.schema.json",
    "docs/recovery/v22-goal-state.md",
    "docs/recovery/v22-codex-goal-loop.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "scripts/smoke-test-v22-goal-state-consistency.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-product-goal-execution-order.mjs",
  ])],
  ["recovery/platform-v22-trunk", allowedDiffPaths],
]);

const productLoopItems = [
  "1. 平台创建 1 名用户。",
  "2. 给用户充值额度。",
  "3. 用户分别登录 portal.medopl.cn 与 opl.medopl.cn。",
  "4. Portal 登录不需要 gflabtoken API Key。",
  "5. OPL 登录 / 进入 OPL 工作台需要 gflabtoken API Key，输入框在密码下面，灰度说明来源于 gflabtoken。",
  "6. 用户在 Portal 开通托管运行环境，选择计算规格/套餐和文件空间。",
  "7. 用户侧看到托管运行环境、工作空间、文件空间、余额、预扣费/冻结金额；不得把 CVM/COS/K8s/云控制台作为普通用户主语言。",
  "8. 后台可有 CVM/COS/runtime/resourceBinding/billingAccount/auditTag，但只作为后台实现和 admin/ops 事实。",
  "9. 账单日内核对，释放后 120 分钟内完成停止计费确认，审计 T+1。",
  "10. OPL Web 使用 clean upstream：https://github.com/gaofeng21cn/one-person-lab，不修改 upstream 源码，不 import upstream 内部模块。",
  "11. 用户在 opl.medopl.cn 可发送信息、上传文件、用文件跑任务、下载输出文件。",
  "12. Portal 可看到 workspace 文件、对应账单、session 对话轨迹。",
  "13. 用户释放托管运行环境后停止扣费，并有审计记录。",
];

const goalLoopSteps = [
  "Step 1：问题",
  "Step 2：写轻合同卡",
  "Step 3：定义验证",
  "Step 4：先补验证壳",
  "Step 5：做最小实现",
  "Step 6：跑结果",
  "Step 7：分析失败",
  "Step 8：回写真相",
];

const hardRulePhrases = [
  "Codex goal 不是自然语言愿望，而是 repo 内的 goal-state state machine。",
  "每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。",
  "每个 leaf step 必须有 eval_command 或 characterization gate。",
  "B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。",
  "canary 事实不能自动变 production truth",
  "refactor 必须保持合同行为，先 characterization gate，再移动/拆分代码。",
  "cleanup 必须先 tombstone/archive/gate，再删除 active dependency。",
  "development 必须先 contract/eval，再最小实现。",
  "禁止用 fallback/shim/adapter 兼容层掩盖旧主路径。",
];

const requiredCurrentFields = [
  "schemaVersion",
  "canonical",
  "machineReadableCurrentTruth",
  "markdownRole",
  "currentCursor",
  "highestPriorityExecutableLeafStep",
  "stageOrder",
  "gaps",
  "currentLeaf",
  "releaseReadiness",
];

const requiredValidationCommands = [
  "node scripts/smoke-test-v22-goal-state-consistency.mjs",
  "node scripts/smoke-test-v22-product-goal-harness.mjs",
  "node scripts/smoke-test-v22-product-goal-execution-order.mjs",
  "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs/recovery scripts",
];

const secretLikeValuePatterns = [
  /sk-[A-Za-z0-9_-]{16,}/u,
  /gh[pousr]_[A-Za-z0-9_]{16,}/u,
  /github_pat_[A-Za-z0-9_]{16,}/u,
  /AKID[A-Za-z0-9]{12,}/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /x-access-token[:=][A-Za-z0-9._-]+/iu,
  /Bearer\s+[A-Za-z0-9._-]{20,}/u,
  /^(?:SecretId|SecretKey|TENCENT_[A-Z_]*SECRET[A-Z_]*|LANGFUSE_SECRET_KEY|ZITADEL_ADMIN_BEARER_TOKEN)[ \t]*=[ \t]*[^#\s$][^\r\n#]*/mu,
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readRepoFile(filePath));
}

async function assertFileExists(filePath) {
  await access(path.join(repoRoot, filePath)).catch((error) => {
    throw new Error(`required_file_missing:${filePath}:${error.message}`);
  });
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, forbidden, label) {
  assert(!source.includes(forbidden), `${label}_forbidden:${forbidden}`);
}

function runGate(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${scriptPath}_failed`);
  }
}

function changedFilesFromBase() {
  const outputs = [
    ["diff", "--name-only", "origin/recovery/platform-v22-trunk"],
    ["ls-files", "--others", "--exclude-standard"],
  ].map((args) => {
    const result = spawnSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
    return result.stdout;
  });
  return [...new Set(outputs.flatMap((output) => output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)))];
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_branch_show_current_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function assertOnlyAllowedFilesChanged() {
  const branchAllowedDiffPaths = branchScopedAllowedDiffPaths.get(currentBranchName()) ?? new Set();
  for (const filePath of changedFilesFromBase()) {
    assert(
      allowedDiffPaths.has(filePath) || branchAllowedDiffPaths.has(filePath),
      `product_goal_harness_modified_unsubscribed_file:${filePath}`,
    );
  }
}

function diffAddedLinesFromBase() {
  const result = spawnSync("git", ["diff", "--unified=0", "origin/recovery/platform-v22-trunk"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_diff_unified_failed:${result.stderr || result.stdout}`);
  return result.stdout
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

async function untrackedFileLines() {
  const result = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_ls_files_others_failed:${result.stderr || result.stdout}`);
  const lines = [];
  for (const filePath of result.stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)) {
    if (!allowedDiffPaths.has(filePath)) continue;
    lines.push(...(await readRepoFile(filePath)).split(/\r?\n/u));
  }
  return lines;
}

async function assertNoSecretLikeValuesInAddedLines() {
  const findings = [];
  const addedLines = [
    ...diffAddedLinesFromBase(),
    ...await untrackedFileLines(),
  ];
  for (const [index, source] of addedLines.entries()) {
    for (const pattern of secretLikeValuePatterns) {
      if (pattern.test(source)) {
        findings.push({ lineIndex: index + 1, pattern: pattern.source });
      }
    }
  }
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_product_goal_harness",
    type: "changed_files_added_lines_diff_scoped_secret_scan",
    findings,
  }, null, 2));
}

for (const filePath of [...Object.values(docs), gatePath, executionOrderGatePath, consistencyGatePath]) {
  await assertFileExists(filePath);
}

assertOnlyAllowedFilesChanged();
await assertNoSecretLikeValuesInAddedLines();
runGate(consistencyGatePath);

const sources = Object.fromEntries(await Promise.all(
  Object.entries(docs).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));
const currentState = await readJson(docs.currentState);
const scoreboard = await readJson(docs.scoreboard);
const allDocs = Object.values(sources).join("\n");

for (const phrase of productLoopItems) assertIncludes(sources.productE2eContract, phrase, "product_loop_13_items");
for (const phrase of goalLoopSteps) assertIncludes(sources.goalLoop, phrase, "goal_loop_8_steps");
for (const phrase of hardRulePhrases) assertIncludes(allDocs, phrase, "hard_rule");
for (const command of requiredValidationCommands) assertIncludes(allDocs, command, "validation_command");
for (const field of requiredCurrentFields) assert(Object.hasOwn(currentState, field), `current_state_field_missing:${field}`);

assert.equal(currentState.canonical, true, "current_state_must_be_canonical");
assert.equal(currentState.markdownRole, "summary_history_pointer_only", "markdown_role_mismatch");
assert.equal(currentState.currentCursor, currentState.highestPriorityExecutableLeafStep, "current_cursor_highest_priority_mismatch");
assert.equal(currentState.currentLeaf.stepId, currentState.currentCursor, "current_leaf_step_mismatch");
assert.equal(currentState.releaseReadiness.status, "deferred_authorized_future_stage", "release_readiness_status_mismatch");
assert.equal(currentState.releaseReadiness.cursorEligible, false, "release_readiness_cursor_eligible_mismatch");

assertIncludes(sources.goalState, "JSON 是机器可读 current truth", "goal_state_json_truth_language");
assertIncludes(sources.goalState, "Markdown 是人类说明/历史", "goal_state_markdown_role_language");
assertIncludes(sources.gapMatrix, "Product Completion Scoreboard", "gap_matrix_scoreboard_pointer");
assertIncludes(sources.gapMatrix, docs.scoreboard, "gap_matrix_scoreboard_path");
assertIncludes(sources.productGoal, "goal tree -> execution line", "goal_tree_execution_line_rule");
assertIncludes(sources.productGoal, "contract-driven", "contract_driven");
assertIncludes(sources.productGoal, "eval-driven", "eval_driven");

assert(Array.isArray(scoreboard.capabilities), "scoreboard_capabilities_missing");
assert(scoreboard.capabilities.length >= 23, "scoreboard_capability_coverage_incomplete");
assert(scoreboard.capabilities.some((capability) => capability.id === "release-readiness-deploy-runtime-smoke"), "scoreboard_release_readiness_missing");

assertNotIncludes(allDocs, "release_readiness_authorized_to_run_build_push_kubectl_now", "must_not_claim_risky_release_authorization");
assertNotIncludes(allDocs, "release_readiness_authorized_to_read_secret_now", "must_not_claim_secret_read_authorization");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_product_goal_harness",
  canonicalCurrentState: docs.currentState,
  scoreboard: docs.scoreboard,
  checked: {
    productLoopItems: productLoopItems.length,
    goalLoopSteps: goalLoopSteps.length,
    currentCursor: currentState.currentCursor,
    releaseReadinessStatus: currentState.releaseReadiness.status,
    diffScopedSecretScan: "changed_files_added_lines",
    capabilities: scoreboard.capabilities.length,
    validationCommands: requiredValidationCommands,
  },
}, null, 2));
