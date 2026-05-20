import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isSmokeClassifiedIn } from "./v22-smoke-classification.mjs";

const read = (filePath) => readFile(filePath, "utf8");

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

const authorizedBoundaryPath = "docs/contracts/v22-authorized-tencent-create-release-boundary.md";
const implementationBoundaryPath = "docs/contracts/v22-authorized-tencent-create-release-implementation-boundary.md";
const readmePath = "docs/contracts/README.md";
const productPath = "docs/product.md";
const activeTruthPath = "docs/active/README.md";
const decisionsPath = "docs/recovery/decisions.md";

const [
  authorizedBoundary,
  implementationBoundary,
  readme,
  product,
  activeTruth,
  decisions,
] = await Promise.all([
  read(authorizedBoundaryPath),
  read(implementationBoundaryPath),
  read(readmePath),
  read(productPath),
  read(activeTruthPath),
  read(decisionsPath),
]);

const packageDocs = [
  ["authorized_boundary", authorizedBoundary],
  ["implementation_boundary", implementationBoundary],
  ["product", product],
  ["active_truth", activeTruth],
  ["decisions", decisions],
];

for (const [label, source] of packageDocs) {
  assertIncludesAll(source, [
    "基础套餐",
    "Pro 套餐",
    "任务并发",
  ], `${label}_package_terms`);
  assertNotIncludesAny(source, [
    "进阶科研环境",
    "基础科研环境",
    "默认套餐 1",
    "默认套餐 2",
    "5 个 session 并发",
  ], `${label}_legacy_package_terms`);
}

const lifecycleDocs = [
  ["authorized_boundary", authorizedBoundary],
  ["implementation_boundary", implementationBoundary],
  ["product", product],
  ["active_truth", activeTruth],
  ["decisions", decisions],
];

for (const [label, source] of lifecycleDocs) {
  assertIncludesAll(source, [
    "工作空间是业务容器",
    "计算资源可独立开通、扩容、缩容、释放",
    "存储资源 / 文件空间可独立开通、扩容、删除",
    "释放计算资源不删除文件空间",
    "释放计算资源不让文件空间进入 7 天保护期",
    "删除存储资源 / 文件空间，或独立欠费保留策略，才进入 7 天保护期",
    "计算资源已释放但文件空间仍保留，是合法状态",
  ], `${label}_resource_lifecycle`);
  assertNotIncludesAny(source, [
    "冻结保护期是 7 天；7 天后清理对应数据和资源",
    "用户删除或释放资源后，扣费停止",
    "释放计算资源会删除文件空间",
    "释放计算资源后文件空间进入 7 天保护期",
    "文件进入保留、保护或清理策略",
  ], `${label}_ambiguous_release_retention`);
}

const userNarrativeDocs = [
  ["product", product],
  ["active_truth", activeTruth],
  ["decisions", decisions],
];

for (const [label, source] of userNarrativeDocs) {
  assertIncludesAll(source, [
    "普通用户主语言优先使用：账号、工作空间、计算资源、文件空间、套餐、任务并发、余额、冻结金额",
    "租户 / runtime / 运行环境 / environmentId 只能作为内部标签、对账标签或审计字段",
  ], `${label}_user_narrative_boundary`);
  assertNotIncludesAny(source, [
    "开通 runtime、compute、storage",
    "用户或租户可以选择开通托管 runtime",
    "用户选择是否开通托管 runtime",
    "Portal 展示租户的 runtime",
  ], `${label}_legacy_user_narrative`);
}

assertIncludesAll(readme, [
  "smoke-test-v22-real-resource-contract-alignment",
  "基础套餐、Pro 套餐、自定义规格",
  "计算资源和存储资源生命周期分离",
  "7 天保护期只由存储资源 / 文件空间删除或独立欠费保留策略触发",
], "contracts_readme_alignment");

assert.equal(
  isSmokeClassifiedIn("scripts/smoke-test-v22-real-resource-contract-alignment.mjs", { categories: ["cloud-future-authorized"] }),
  true,
  "real_resource_alignment_must_remain_classified_future_authorized",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_real_resource_contract_alignment",
  checked: {
    authorizedBoundaryPath,
    implementationBoundaryPath,
    readmePath,
    productPath,
    activeTruthPath,
    decisionsPath,
  },
}, null, 2));
