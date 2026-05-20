import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/specs/README.md";
const readmePath = "docs/specs/README.md";
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

const contract = await readFile(contractPath, "utf8");
const readme = await readFile(readmePath, "utf8");
const suite = await readFile(suitePath, "utf8");

assertIncludesAll(contract, [
  "Official SDK Provider Strategy",
  "future authorized provider candidate = Tencent official SDK wrapper",
  "hand-rolled TC3 = diagnostic/reference only",
  "not future authorized default readonly live path",
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
  "Package A SDK dependency diff 属于 cloud-lane candidate 事实",
], "official_sdk_strategy_dependency_policy");

assertIncludesAll(contract, [
  "official SDK readonly live 跑通前，不删除 TC3",
  "official SDK readonly live 跑通并由 B 接受后，另开 cleanup 分支",
  "TC3 从 future authorized default candidate 退场",
  "TC3 可保留为 isolated diagnostic fixture",
  "不能作为 create/release 或默认 readonly live 主路径",
], "official_sdk_strategy_cleanup_policy");

assertIncludesAll(contract, [
  "cloud-lane candidate 已记录 SDK dependency / loader / readonly client 连接形状",
  "`defaultExecutable=false`",
  "`readsSecretNow=false`",
  "`implementsRealCloudCallNow=false`",
  "调用真实 readonly 云 API",
  "不删除 TC3",
  "不改 create/release mutation 边界",
], "official_sdk_strategy_non_goals");

assertIncludesAll(contract, [
  "\"futureAuthorizedProviderCandidate\": \"tencent_official_sdk_wrapper\"",
  "\"tc3ProviderStrategy\": \"diagnostic_reference_only\"",
  "\"officialSdkWrapperExposesOnlyReadonlyInventoryInterface\": true",
  "\"rawSdkClientExposedToBusinessLayer\": false",
  "\"genericApiCallExposed\": false",
  "\"sdkRawResponseAllowedInStdoutReportOrPortalPayload\": false",
  "\"newSdkDependencyRequiresUserAuthorizationAndPackageDiffReview\": true",
  "\"contractBranchInstallsSdkDependency\": false",
  "\"cloudLaneCandidateInstallsSdkDependency\": true",
  "\"removeTc3BeforeOfficialSdkLivePass\": false",
  "\"tc3AllowedAsCreateReleaseProvider\": false",
  "\"changesCreateReleaseMutationBoundary\": false",
], "official_sdk_strategy_contract_data");

assertIncludesAll(readme, [
  "official Tencent SDK wrapper",
  "future authorized provider candidate",
  "`defaultExecutable=false`",
  "`readsSecretNow=false`",
  "`implementsRealCloudCallNow=false`",
  "TC3 仅作为 diagnostic/reference",
], "readme_official_sdk_strategy");

assert(suite.includes("future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs"), "mvp_suite_must_include_official_sdk_strategy_smoke");

assertNotIncludesAny(contract, [
  "\"tc3AllowedAsCreateReleaseProvider\": true",
  "\"rawSdkClientExposedToBusinessLayer\": true",
  "\"genericApiCallExposed\": true",
], "official_sdk_strategy_forbidden_contract_data");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_official_sdk_provider_strategy",
  checked: [
    "official_sdk_wrapper_is_future_authorized_provider_candidate",
    "tc3_diagnostic_reference_only",
    "readonly_inventory_interface_only",
    "raw_sdk_and_generic_call_forbidden",
    "sdk_dependency_requires_separate_feat_and_package_diff_review",
    "tc3_cleanup_after_official_sdk_live_pass",
    "contract_branch_non_goals",
  ],
}, null, 2));
