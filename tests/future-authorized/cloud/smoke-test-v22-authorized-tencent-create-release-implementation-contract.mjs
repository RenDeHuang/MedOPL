import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-authorized-tencent-create-release-implementation-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";

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
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");

assertIncludesAll(contract, [
  "v22 Authorized Tencent Create/Release Implementation Boundary",
  "当前分支只写合同和 smoke，不实现真实云调用",
  "工作空间是业务容器",
  "计算资源可独立开通、扩容、缩容、释放",
  "存储资源 / 文件空间可独立开通、扩容、删除",
  "释放计算资源不删除文件空间",
  "释放计算资源不让文件空间进入 7 天保护期",
  "删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期",
  "计算资源已释放但存储资源仍保留，是合法状态",
  "计算资源已释放但文件空间仍保留，是合法状态",
  "存储资源进入保护期或不可用时，新任务不能依赖该文件空间",
], "implementation_contract_resource_lifecycle");

assertIncludesAll(contract, [
  "默认风控上限，不是默认开通规格",
  "maxCpuCoresPerWorkspace: 16",
  "maxMemoryGbPerWorkspace: 32",
  "maxFileSpaceGbPerWorkspace: 500",
  "maxConcurrentTasksPerWorkspace: 5",
  "maxQueuedTasksPerWorkspace: 20",
  "balanceWarningThresholdCny: 20",
  "dailySpendAlertCny: 300",
  "dailyHardCapCny: null",
  "failedOperationRetryLimit: 2",
  "maxCreateReleaseOperationsPerDay: 10",
  "Portal 管理员可按账号修改",
  "账号组默认值 + 单账号 override + effective limits 展示",
], "implementation_contract_risk_limits");

assertIncludesAll(contract, [
  "基础套餐：2c / 4GB / 10GB 文件空间",
  "Pro 套餐：8c / 16GB / 100GB 文件空间",
  "自定义：CPU、内存、文件空间、任务并发数",
  "5 个必须写成任务并发，不是 session 并发",
], "implementation_contract_package_language");

assertIncludesAll(contract, [
  "开通时需要扣费 / 预扣 + 冻结金额",
  "已冻结金额",
  "预计可用时长",
  "120 分钟扣费核对",
  "隔日账单审计",
  "日预算默认只提醒，不默认硬停",
  "管理员可以给某个账号打开硬停",
  "余额低于 20 元提醒",
  "冻结金额不足时：停止新任务和计算资源续用",
  "不得把“释放计算资源”自动写成“删除文件空间”",
  "独立存储删除 / 欠费保留策略触发",
], "implementation_contract_billing_freeze");

assertIncludesAll(contract, [
  "账单核对中",
  "账单异常待处理",
  "已校准",
  "待补扣",
  "待退还",
  "进入管理员审计队列",
  "不得直接暴露底层云账单字段、bucket、object key、SecretId、SecretKey、kubeconfig",
], "implementation_contract_t_plus_1");

assertIncludesAll(contract, [
  "询价失败：不冻结、不创建资源",
  "冻结失败：不创建资源",
  "计算创建失败：释放已创建的计算子资源，记录失败证据",
  "存储创建失败：计算资源是否保留必须按用户计划和审计策略处理，不得隐式删除用户已有文件空间",
  "绑定失败：资源进入待审计 / 可重试状态，不能假装可用",
  "释放失败：进入释放失败待审计，保留重试队列和证据",
  "删除存储失败：进入清理失败待审计，不承诺秒级物理删除",
], "implementation_contract_failure_rollback");

assertIncludesAll(contract, [
  "不读取 secret",
  "不调用真实腾讯云 / COS / Langfuse / one-person-lab",
  "不创建、释放真实资源",
  "不真实扣费",
  "不运行 build/push/kubectl/live-test",
  "不修改 deploy / .sentrux / adapters / upstream / Gateway / Runtime Bridge",
  "后续真实实现必须另开 feat/*",
  "secret 边界、真实云 API、测试账号、区域、资源类型、费用上限和清理策略",
], "implementation_contract_authorization_boundary");

assertIncludesAll(contract, [
  "借鉴 Sub2API 的 role-based Web app 思路",
  "同一 Portal，同一登录，同一 UI shell",
  "普通用户和管理员 surface 按角色分离",
  "不复制 Sub2API 代码、路由、鉴权或存储结构",
  "借鉴 one-person-lab 的 worktree / repo-tracked truth / 防污染纪律",
  "truth 进入 docs/contracts/scripts/tests",
  "tmux/session/agent 对话/本地 runtime state 不进仓库",
], "implementation_contract_borrowed_boundaries");

assertIncludesAll(contract, [
  "\"maxCpuCoresPerWorkspace\": 16",
  "\"maxMemoryGbPerWorkspace\": 32",
  "\"maxFileSpaceGbPerWorkspace\": 500",
  "\"maxConcurrentTasksPerWorkspace\": 5",
  "\"maxQueuedTasksPerWorkspace\": 20",
  "\"balanceWarningThresholdCny\": 20",
  "\"dailySpendAlertCny\": 300",
  "\"dailyHardCapCny\": null",
  "\"failedOperationRetryLimit\": 2",
  "\"maxCreateReleaseOperationsPerDay\": 10",
  "\"adminAccountOverrideAllowed\": true",
  "\"accountGroupDefaults\": true",
  "\"effectiveLimitsVisible\": true",
  "\"workspaceLifecycleSeparatedFromCompute\": true",
  "\"computeReleaseDeletesFileSpace\": false",
  "\"storageDeleteTriggersRetentionDays\": 7",
], "implementation_contract_json_policy");

assertNotIncludesAny(contract, [
  "用户自配云资源",
  "普通用户管理 CVM",
  "普通用户管理 COS",
  "普通用户管理 K8s",
  "用户编辑 kubeconfig",
  "默认硬停开启",
  "默认硬停: true",
  "释放计算资源会删除文件空间",
  "5 个 session 并发",
], "implementation_contract_forbidden_copy");

assertIncludesAll(readme, [
  "v22-authorized-tencent-create-release-implementation-boundary.md",
  "authorized/tencent create/release implementation",
  "默认风控上限",
  "计算资源和存储资源生命周期分离",
], "contracts_readme_implementation_boundary");

assertIncludesAll(suite, [
  "smoke-test-v22-authorized-tencent-create-release-implementation-contract",
], "mvp_suite_implementation_boundary");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_create_release_implementation_boundary",
  checked: {
    contractPath,
    readmePath,
    suitePath,
  },
}, null, 2));
