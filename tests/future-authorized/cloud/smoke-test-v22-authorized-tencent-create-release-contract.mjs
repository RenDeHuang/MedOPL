import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-authorized-tencent-create-release-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";

const contract = await readFile(contractPath, "utf8");
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");

const requiredPhrases = [
  "authorized Tencent create/release",
  "本合同只定义授权边界，不执行真实创建或释放",
  "工作台资源",
  "基础套餐：2c / 4GB / 10GB 文件空间",
  "Pro 套餐：8c / 16GB / 100GB 文件空间",
  "自定义规格：CPU、内存、文件空间和任务并发数",
  "多个任务可以复用同一组计算资源",
  "5 个必须写成任务并发，不是 session 并发",
  "`runId` 是任务级成本标签，可为空",
  "T+1 账单用于对账和审计，不作为实时扣费来源",
  "resourceBindingId",
  "cloudOperationId",
  "billingAttributionId",
  "accountId",
  "runId",
  "serverPlanId",
  "tenantId",
  "workspaceId",
  "resourceBindingId",
  "environmentId",
  "计划中 -> 待授权 -> 准备中 -> 可用 -> 释放中 -> 已释放",
  "准备失败待处理",
  "释放失败待审计",
  "工作空间、计算资源和文件空间生命周期分离",
  "释放计算资源不删除文件空间",
  "释放计算资源不让文件空间进入 7 天保护期",
  "删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期",
  "计算资源已释放但文件空间仍保留，是合法状态",
  "7 天保护期",
  "普通删除不需要二次确认",
  "永久删除或清空文件空间需要二次确认",
  "创建文件夹",
  "重命名文件夹",
  "移动文件或文件夹",
  "批量下载",
  "批量删除",
  "COS prefix 是内部实现",
  "TKE shared cluster",
  "namespace / quota",
  "node pool class",
  "SecretId / SecretKey / kubeconfig 只进入后端 secret boundary",
  "真实执行必须另开 feat/* 并单独授权",
];

for (const phrase of requiredPhrases) {
  assert(contract.includes(phrase), `authorized_tencent_contract_missing:${phrase}`);
}

const forbiddenOrdinaryUserLanguage = [
  "普通用户管理 CVM",
  "普通用户管理 COS",
  "普通用户管理 K8s",
  "用户编辑 kubeconfig",
  "用户编辑 SecretId",
  "用户编辑 SecretKey",
];

for (const phrase of forbiddenOrdinaryUserLanguage) {
  assert.equal(contract.includes(phrase), false, `authorized_tencent_contract_forbidden_phrase:${phrase}`);
}

const requiredJsonFields = [
  '"resourceBindingId"',
  '"cloudOperationId"',
  '"billingAttributionId"',
  '"accountId"',
  '"serverPlanId"',
  '"tenantId"',
  '"workspaceId"',
  '"resourceBindingId"',
  '"environmentId"',
  '"runId"',
  '"workspaceResource"',
  '"fileSpacePolicy"',
  '"createReleaseState"',
  '"billingTags"',
];

for (const phrase of requiredJsonFields) {
  assert(contract.includes(phrase), `authorized_tencent_contract_json_missing:${phrase}`);
}

for (const forbidden of [
  "legacyResourceOrderId",
  "legacyresourceorderid",
  "migration-only alias",
]) {
  assert.equal(contract.includes(forbidden), false, `authorized_tencent_contract_retired_alias_must_not_be_required:${forbidden}`);
}

assert(readme.includes("v22-authorized-tencent-create-release-boundary.md"), "contracts_readme_missing_authorized_tencent_contract");
assert(readme.includes("authorized/tencent create/release"), "contracts_readme_missing_authorized_tencent_route");
assert(suite.includes("smoke-test-v22-authorized-tencent-create-release-contract"), "mvp_suite_missing_authorized_tencent_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_authorized_tencent_create_release_boundary",
  checked: {
    contractPath,
    readmePath,
    suitePath,
  },
}, null, 2));
