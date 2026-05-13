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
};

const gatePath = "scripts/smoke-test-v22-product-goal-harness.mjs";
const allowedDiffPaths = new Set([
  ...Object.values(docs),
  gatePath,
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "scripts/smoke-test-v22-resource-order-store-postgres-characterization.mjs",
  "scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs",
  "scripts/smoke-test-v22-legacy-script-archive-boundary.mjs",
  "docs/recovery/legacy-cleanup-backlog.md",
  "docs/recovery/repo-zoning.md",
]);

const branchScopedAllowedDiffPaths = new Map([
  ["feat/v22-opl-productionization-local-implementation", new Set([
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
  ])],
  ["docs/v22-advance-opl-productionization-eval-shell-cursor", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-opl-productionization-eval-shell", new Set([
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["docs/v22-advance-opl-productionization-cursor", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["contract/v22-opl-productionization-contract-refresh", new Set([
    "docs/contracts/v22-portal-opl-connection-boundary.md",
    "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
    "docs/recovery/mvp-contract-acceptance.md",
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["refactor/v22-portal-layering-characterization-gate", new Set([
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-secret-hygiene-diff-scan-eval-shell", new Set([
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "docs/recovery/v22-ai-frontend-backend-development-framework.md",
  ])],
  ["cleanup/v22-resource-order-store-postgres-schema-implementation", new Set([
    "services/portal/src/state/portal-resource-order-store.mjs",
    "services/portal/src/state/portal-store-db-delegates.mjs",
    "services/portal/src/state/portal-store-postgres-persistence.mjs",
    "services/portal/src/state/portal-store-runtime-connections.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store.mjs",
  ])],
  ["recovery/platform-v22-trunk", new Set([
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/contracts/v22-portal-opl-connection-boundary.md",
    "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
    "docs/recovery/mvp-contract-acceptance.md",
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
    "services/portal/src/state/portal-resource-order-store.mjs",
    "services/portal/src/state/portal-store-db-delegates.mjs",
    "services/portal/src/state/portal-store-postgres-persistence.mjs",
    "services/portal/src/state/portal-store-runtime-connections.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store.mjs",
  ])],
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
  "Codex 每轮必须读取 docs/recovery/v22-goal-state.md",
  "每个 gap 必须有 eval；没有 eval 的 gap 不得实现，状态只能是 needs_eval，下一步只能是 write_eval_shell。",
  "每个 leaf step 必须有 eval_command 或 characterization gate。",
  "B ff-only 吸收并 push 后，goal-state cursor 才能前进；A 不得自行声明全局完成。",
  "canary 事实不能自动变 production truth",
  "refactor 必须保持合同行为，先 characterization gate，再移动/拆分代码。",
  "cleanup 必须先 tombstone/archive/gate，再删除 active dependency。",
  "development 必须先 contract/eval，再最小实现。",
  "禁止用 fallback/shim/adapter 兼容层掩盖旧主路径。",
];

const autonomousRunPolicyPhrases = [
  "Autonomous run policy",
  "允许 Codex 在本 goal harness 内连续推进多个 leaf step",
  "每个 leaf step 必须独立完成",
  "light contract card",
  "eval/gate",
  "implementation",
  "verification",
  "failure analysis",
  "truth writeback",
  "commit",
  "B absorb/push 或 B blocker report",
  "每个 leaf step 完成后必须产生",
  "commit SHA",
  "changed files",
  "verification output summary",
  "truth writeback files",
  "next cursor",
  "如果任一 gate 失败，Codex 不得继续下一个 leaf step，必须先执行 failure_analysis_rule。",
  "如果 B absorb 条件不满足，Codex 不得推进 goal-state cursor。",
  "每个 push 后必须重新 fetch/rebase 最新 origin/recovery/platform-v22-trunk，再继续下一 leaf step。",
  "禁止把多个无关 leaf steps 合成一个大提交。",
  "禁止在未更新 goal-state 的情况下继续跑下一阶段。",
  "secret/live/cloud/kubectl/build/push",
  "auth record",
  "scope",
  "budget",
  "rollback",
  "evidence path",
  "A 只能提交 leaf step",
  "B 或被明确授权的 auto-B lane 才能 ff-only absorb/push trunk",
  "A 不得伪装 B 吸收。",
];

const loopBudgetPhrases = [
  "Loop budget / escalation policy",
  "max_attempts_per_leaf_step = 10",
  "max_attempts_per_root_cause = 10",
  "max_consecutive_same_gate_failure = 2",
  "max_changed_files_without_B_review = 12",
  "每个 leaf step 最多允许 10 次 implementation attempt。",
  "同一个 root cause 最多允许 10 次 failed attempt。",
  "同一个 gate 连续失败 2 次后，必须进入 failure analysis；分析后可以继续 attempt，但必须记录 root cause 和策略变化。",
  "第 10 次 leaf step attempt 失败后，才必须 blocked truth writeback。",
  "同一个 root cause 达到 10 次失败后，也必须 blocked truth writeback。",
  "attempt failure 只统计以下 blocker",
  "test/gate exit non-zero",
  "B absorb blocker",
  "contract/eval mismatch",
  "scope drift",
  "forbidden action needed without auth record",
  "baseline_not_restored",
  "cleanup_incomplete",
  "budget_or_stop_condition_hit",
  "以下不算 attempt failure，除非它们导致验证命令失败或 tracked diff 污染",
  "warning",
  "formatting suggestion",
  "one-time local dependency install",
  "ignored node_modules / .runtime output",
  "transient command retry with no tracked change",
  "blocked",
  "failed gate",
  "attempt number",
  "root cause id",
  "whether this is same gate failure",
  "whether this is same root cause failure",
  "changed strategy",
  "whether split is needed",
  "attempts summary",
  "suspected root cause",
  "whether problem should be split",
  "whether contract/eval is wrong",
  "whether external authorization/canary is required",
  "proposed next smaller leaf steps",
  "如果失败原因是 eval_wrong 或 contract_wrong，下一步必须先修 contract/eval，不得继续实现。",
  "如果失败原因是 problem_too_large，必须拆成更小 leaf steps，并更新 gap matrix/execution line。",
  "如果失败原因是 environment_missing 或 authorization_required，必须停在 deferred_authorized，不得用 mock/fallback 硬过。",
  "如果失败原因是 architecture_blocker，必须开 refactor leaf step，不得在当前 feature step 里顺手重构大面。",
  "blocked leaf step 不允许推进 goal-state cursor，除非 B 明确吸收 blocked truth writeback。",
];

const authorizationModelPhrases = [
  "Authorization model",
  "Global authorization 只授权 Codex 按 product-goal harness 连续推进 leaf steps。",
  "Global authorization 不等于直接授权所有未来 secret/live/cloud/kubectl/build/push/deploy 动作。",
  "risky leaf step",
  "step-local auth record",
  "authorized_operation_type:",
  "secret_scope:",
  "cloud_scope:",
  "region:",
  "resource_scope:",
  "budget_limit:",
  "baseline_requirement:",
  "rollback_plan:",
  "cleanup_plan:",
  "evidence_path:",
  "stop_conditions:",
  "auth record 默认写入 .runtime，不进入 git。",
  "docs/recovery 只写脱敏摘要和 truth writeback",
  "raw secret、kubeconfig、token、SecretId/SecretKey、raw cloud response",
  "没有 auth record 的 risky leaf step 必须停在 deferred_authorized。",
  "default/local cleanup/refactor/dev steps 不得读取 secret、不调真实云、不 build/push/kubectl。",
];

const cloudLivePolicyPhrases = [
  "Cloud live baseline / cleanup / minimum spend policy",
  "云上 live step 前必须记录 baseline。",
  "desired/current baseline 应为 2，且测试后必须回到 2。",
  "平台共享 baseline，不得删除或 scale to 0",
  "本 step 创建的测试资源，必须 cleanup/release",
  "开通/创建类 cloud step 必须有 cleanup-first 或 cleanup-after 计划。",
  "release/delete 类 cloud step 必须证明只释放本 step 或本用户绑定的资源",
  "不能删除共享节点池、别人的节点、别人的存储或平台服务资源",
  "cleanup evidence",
  "created resources",
  "released resources",
  "remaining resources",
  "baseline after cleanup",
  "active operations count",
  "billing/reconciliation status",
  "若 cleanup 不能完成，goal-state 不得前进，必须进入 blocked 或 reconciling。",
  "minimum spend",
  "max_runtime",
  "cleanup deadline",
  "不得自动扩容或长时间保留测试资源。",
  "任何无法证明 ownerRef/resourceBindingId/workspaceId/operationId 的资源，不得删除，只能记录 blocker。",
];

const failureTruthWritebackPhrases = [
  "Failure truth writeback",
  "成功和失败都必须回写真相。",
  "failed_step_id:",
  "failed_gate:",
  "attempt_count:",
  "failure_category:",
  "suspected_root_cause:",
  "whether_contract_wrong:",
  "whether_eval_wrong:",
  "whether_problem_should_split:",
  "whether_authorization_required:",
  "next_recommended_action:",
  "baseline_not_restored",
  "cleanup_incomplete",
  "budget_or_stop_condition_hit",
  "失败后不得继续下一个 leaf step，除非 B 明确吸收 blocked truth writeback。",
  "B blocker report 也必须写入 goal-state 或 gap matrix 的 truth writeback section。",
];

const gapIds = [
  "legacy-cleanup-user-owned",
  "legacy-cleanup-resource-order",
  "legacy-cleanup-secret-hygiene",
  "legacy-cleanup-legacy-scripts",
  "architecture-refactor-portal-layering",
  "opl-connection-gateway-preflight-runtime-file-run-artifact-trace",
  "cloud-lane-mock-readonly-dry-run-authorized",
  "frontend-product-vue-vite-ts-pinia",
  "backend-product-node22-esm-layering",
  "billing-audit-preauth-ledger-release-t1",
  "release-readiness-authorized-deploy-only",
  "dependency-modernization-node24-vite-vitest-readiness",
];

const gapFields = [
  "id:",
  "current_fact:",
  "ideal_state:",
  "problem:",
  "dependency:",
  "status:",
  "next_leaf_step:",
  "eval:",
  "allowed_files:",
  "forbidden_files:",
  "truth_writeback_target:",
  "B_absorb_criteria:",
];

const leafStepFields = [
  "step_id:",
  "problem:",
  "input_state:",
  "expected_output:",
  "light_contract_card:",
  "eval_command:",
  "failure_analysis_rule:",
  "trace_or_evidence_expectation:",
  "allowed_files:",
  "forbidden_files:",
  "truth_writeback_target:",
  "B_absorb_criteria:",
];

const lightContractCardFields = [
  "problem:",
  "subscribed_contracts:",
  "in_scope:",
  "out_of_scope:",
  "data_or_field_truth:",
  "auth_boundary:",
  "pollution_risks:",
  "verification_commands:",
  "B_absorb_criteria:",
];

const failureCategories = [
  "contract_wrong",
  "eval_wrong",
  "implementation_wrong",
  "environment_missing",
  "authorization_required",
  "upstream_or_cloud_fact_unknown",
  "problem_too_large",
  "architecture_blocker",
  "baseline_not_restored",
  "cleanup_incomplete",
  "budget_or_stop_condition_hit",
];

const frameworkPhrases = [
  "backend 当前基线使用 Node 22 ESM，route -> app payload -> domain -> state/persistence。",
  "Node 24 Active LTS migration readiness 作为 future gap 记录，不在本 harness 分支升级。",
  "backend 禁止隐式 fallback/shim",
  "backend eval 必须覆盖 route smoke、payload/domain contract smoke、node --check 或 npm check、workflow gate。",
  "frontend 当前基线使用 Vue 3 + Vite + TypeScript + Pinia。",
  "frontend eval 必须覆盖 vue-tsc typecheck、Vitest 或 component eval、Playwright/UI evalset、desktop/mobile responsive check、loading/empty/error state、table/card usability。",
  "Vite/Vitest modernization 作为 future gap 记录，不在本 harness 分支升级。",
  "每个 frontend 改动必须有 API contract、组件状态、响应式/mobile/table 可用性验证。",
  "每个 backend 改动必须有 route/payload/domain smoke 或 contract eval。",
  "secret/security eval 使用 workflow gate 和 changed-files / added-lines diff-scoped secret scan。",
  "浏览器状态、日志、evidence、git 中不得出现 raw provider key、bearer token、launchToken、runtimeToken、SecretId/SecretKey、kubeconfig 或 private key。",
  "OPL Web 必须保持 clean upstream one-person-lab，不修改 upstream 源码，不 import upstream 内部模块。",
  "Cloud lane 必须按 mock -> readonly -> dry-run -> authorized create/release 推进；真实云、secret、build/push/kubectl/live-test 必须单独授权。",
];

const goalStatePhrases = [
  "当前 trunk HEAD",
  "当前 goal cursor",
  "已完成事实：default entry、user_owned、resource-order 前四刀",
  "当前下一问题：OPL connection productionization local implementation",
  "secret hygiene",
  "legacy scripts archive",
  "Portal architecture refactor",
  "OPL connection",
  "Cloud lane",
  "frontend/backend product completion",
  "release readiness",
  "当前 execution line 的前 5 个 leaf steps",
  "禁止并行写入的区域",
  "允许只读审计的区域",
  "B 吸收后 cursor 才能前进",
];

const windowPhrases = [
  "A：执行 8-step goal loop，写 gate/eval，做最小实现，提交。",
  "B：审计 diff、复跑验证、执行 changed-files / added-lines diff-scoped secret scan，无 blocker 时 ff-only absorb 并 push。",
  "C：只做只读审计或明确不冲突的小片段；合并前必须 rebase 最新 trunk 并交 B。",
];

const boundaryPhrases = [
  "不改 services/*",
  "不改 deploy/adapters/.sentrux/.env.demo.template",
  "不跑 live-test",
  "不读 secret",
  "不 build/push/kubectl",
  "不改 upstream one-person-lab",
  "不升级依赖",
  "deploy/*",
  "adapters/*",
  ".sentrux/*",
  ".env.demo.template",
  "Cloud lane 授权边界",
  "clean upstream one-person-lab",
];

const validationCommands = [
  "node scripts/smoke-test-v22-product-goal-harness.mjs",
  "node scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "node scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
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

async function assertFileExists(filePath) {
  await access(path.join(repoRoot, filePath)).catch((error) => {
    throw new Error(`required_file_missing:${filePath}:${error.message}`);
  });
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
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
    const source = await readRepoFile(filePath);
    lines.push(...source.split(/\r?\n/u));
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
        findings.push({
          lineIndex: index + 1,
          pattern: pattern.source,
        });
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

function assertFields(source, fields, label) {
  for (const field of fields) {
    assertIncludes(source, field, `${label}_${field.replace(/[^a-z0-9]+/giu, "_")}`);
  }
}

for (const filePath of [...Object.values(docs), gatePath]) {
  await assertFileExists(filePath);
}

assertOnlyAllowedFilesChanged();
await assertNoSecretLikeValuesInAddedLines();

const sources = Object.fromEntries(await Promise.all(
  Object.entries(docs).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));
const allDocs = Object.values(sources).join("\n");

for (const phrase of productLoopItems) assertIncludes(sources.productE2eContract, phrase, "product_loop_13_items");
for (const phrase of goalLoopSteps) assertIncludes(sources.goalLoop, phrase, "goal_loop_8_steps");
for (const phrase of hardRulePhrases) assertIncludes(allDocs, phrase, "hard_rule");
for (const phrase of autonomousRunPolicyPhrases) assertIncludes(allDocs, phrase, "autonomous_run_policy");
for (const phrase of loopBudgetPhrases) assertIncludes(allDocs, phrase, "loop_budget_escalation_policy");
for (const phrase of authorizationModelPhrases) assertIncludes(allDocs, phrase, "authorization_model");
for (const phrase of cloudLivePolicyPhrases) assertIncludes(allDocs, phrase, "cloud_live_policy");
for (const phrase of failureTruthWritebackPhrases) assertIncludes(allDocs, phrase, "failure_truth_writeback");
for (const phrase of gapIds) assertIncludes(sources.gapMatrix, phrase, "gap_matrix_id");
assertFields(sources.gapMatrix, gapFields, "gap_matrix_required_field");
assertFields(allDocs, leafStepFields, "leaf_step_required_field");
assertFields(allDocs, lightContractCardFields, "light_contract_card_required_field");
for (const category of failureCategories) assertIncludes(allDocs, category, "failure_analysis_category");
for (const phrase of frameworkPhrases) assertIncludes(sources.developmentFramework, phrase, "development_framework");
for (const phrase of goalStatePhrases) assertIncludes(sources.goalState, phrase, "goal_state");
for (const phrase of windowPhrases) assertIncludes(allDocs, phrase, "abc_window");
for (const phrase of boundaryPhrases) assertIncludes(allDocs, phrase, "boundary");
for (const command of validationCommands) assertIncludes(allDocs, command, "validation_command");

assertIncludes(sources.productGoal, "goal tree -> execution line", "goal_tree_execution_line_rule");
assertIncludes(sources.productGoal, "contract-driven", "contract_driven");
assertIncludes(sources.productGoal, "eval-driven", "eval_driven");
assertIncludes(sources.productGoal, "cleanup", "cleanup_work_covered");
assertIncludes(sources.productGoal, "refactor", "refactor_work_covered");
assertIncludes(sources.productGoal, "development", "development_work_covered");
assertIncludes(sources.goalState, "highest-priority executable leaf step", "highest_priority_leaf_step_rule");
assertIncludes(sources.gapMatrix, "needs_eval", "needs_eval_status");
assertIncludes(sources.gapMatrix, "write_eval_shell", "write_eval_shell_next_step");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_product_goal_harness",
  documents: docs,
  checked: {
    productLoopItems: productLoopItems.length,
    goalLoopSteps: goalLoopSteps.length,
    autonomousRunPolicy: true,
    loopBudgetEscalationPolicy: true,
    authorizationModel: true,
    cloudLiveBaselineCleanupMinimumSpend: true,
    failureTruthWriteback: true,
    gapIds: gapIds.length,
    diffScopedSecretScan: "changed_files_added_lines",
    validationCommands,
  },
}, null, 2));
