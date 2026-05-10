import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-tencent-readonly-inventory-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

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
  "Official SDK Provider Strategy",
  "production default provider = Tencent official SDK wrapper",
  "hand-rolled TC3 = diagnostic/reference only",
  "not production default",
  "official SDK wrapper 仍必须 obey readonly allowlist",
  "secret allowlist",
  "redaction",
  "RUN gate",
  "no raw SDK exposure",
], "official_sdk_strategy_boundary");

assertIncludesAll(contract, [
  "describeAccount",
  "describeRegions",
  "describeCvmInstances",
  "describeTkeClusters",
  "describeCosBuckets",
  "describeCosMetadata",
  "describeBillingSummary",
  "describeTagResources",
], "official_sdk_strategy_interface");

assertIncludesAll(contract, [
  "禁止 raw SDK client 泄露到业务层",
  "禁止通用 call(apiName, params)",
  "禁止 mutation API",
  "SDK raw response 不得进入 stdout/report/Portal payload",
], "official_sdk_strategy_forbidden_surface");

assertIncludesAll(contract, [
  "新增或升级 tencentcloud-sdk-nodejs",
  "cos-nodejs-sdk-v5",
  "必须有用户授权",
  "B 审查 package diff",
  "Package A 已安装",
], "official_sdk_strategy_dependency_policy");

assertIncludesAll(contract, [
  "official SDK readonly live 跑通前，不删除 TC3",
  "official SDK readonly live 跑通后，另开 cleanup 分支",
  "TC3 从 production default 退场",
  "TC3 可保留为 isolated diagnostic fixture",
  "不能作为 create/release 或默认 readonly live 主路径",
], "official_sdk_strategy_cleanup_policy");

assertIncludesAll(contract, [
  "本分支已在 Package A/B 授权下安装 SDK",
  "调用真实 readonly 云 API",
  "不删除 TC3",
  "不改 create/release mutation 边界",
], "official_sdk_strategy_non_goals");

assertIncludesAll(contract, [
  "\"productionDefaultProviderStrategy\": \"tencent_official_sdk_wrapper\"",
  "\"tc3ProviderStrategy\": \"diagnostic_reference_only\"",
  "\"officialSdkWrapperExposesOnlyReadonlyInventoryInterface\": true",
  "\"rawSdkClientExposedToBusinessLayer\": false",
  "\"genericApiCallExposed\": false",
  "\"sdkRawResponseAllowedInStdoutReportOrPortalPayload\": false",
  "\"newSdkDependencyRequiresUserAuthorizationAndPackageDiffReview\": true",
  "\"contractBranchInstallsSdkDependency\": true",
  "\"removeTc3BeforeOfficialSdkLivePass\": false",
  "\"tc3AllowedAsCreateReleaseProvider\": false",
  "\"changesCreateReleaseMutationBoundary\": false",
], "official_sdk_strategy_contract_data");

assertIncludesAll(readme, [
  "official Tencent SDK wrapper",
  "production default provider strategy",
  "TC3 仅作为 diagnostic/reference",
], "readme_official_sdk_strategy");

assert(suite.includes("smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"), "mvp_suite_must_include_official_sdk_strategy_smoke");

assertNotIncludesAny(contract, [
  "\"tc3AllowedAsCreateReleaseProvider\": true",
  "\"rawSdkClientExposedToBusinessLayer\": true",
  "\"genericApiCallExposed\": true",
], "official_sdk_strategy_forbidden_contract_data");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_official_sdk_provider_strategy",
  checked: [
    "official_sdk_wrapper_is_production_default_strategy",
    "tc3_diagnostic_reference_only",
    "readonly_inventory_interface_only",
    "raw_sdk_and_generic_call_forbidden",
    "sdk_dependency_requires_separate_feat_and_package_diff_review",
    "tc3_cleanup_after_official_sdk_live_pass",
    "contract_branch_non_goals",
  ],
}, null, 2));
