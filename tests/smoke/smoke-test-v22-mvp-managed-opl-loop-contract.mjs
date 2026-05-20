import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractPath = path.join(__dirname, "../../docs/contracts/v22-mvp-managed-opl-loop.md");

const CONTRACT_START = "<!-- v22-mvp-managed-opl-loop-contract:start -->";
const CONTRACT_END = "<!-- v22-mvp-managed-opl-loop-contract:end -->";

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "mvp_loop_contract_start_marker_missing");

  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "mvp_loop_contract_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "mvp_loop_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "mvp_loop_contract_end_marker_must_be_unique");

  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "mvp_loop_contract_must_be_a_single_json_fence");

  return JSON.parse(match[1]);
}

function assertIncludesAll(actualItems, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(actualItems.includes(expected), `${label}_missing:${expected}`);
  }
}

function assertExcludesAll(actualItems, forbiddenItems, label) {
  for (const forbidden of forbiddenItems) {
    assert.equal(actualItems.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

function assertNoRawSecretSurface(value, label) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "rawKey",
    "rawProviderKey",
    "providerApiKey",
    "providerSecret",
    "bearerToken",
    "launchToken",
    "runtimeToken",
    "sessionStorage",
    "localStorage",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${label}_must_not_expose_${forbidden}`);
  }
}

const markdown = await readFile(contractPath, "utf8");
const contract = extractContractJson(markdown);

assert.equal(contract.contract, "v22_mvp_managed_opl_loop", "contract_name_mismatch");
assert.equal(contract.version, 1, "contract_version_mismatch");
assert.deepEqual(
  sortedKeys(contract),
  [
    "auditingAndCleanup",
    "backendImplementationBoundary",
    "billingBoundary",
    "contract",
    "defaultPlans",
    "forbiddenUserNarrative",
    "mvpLoop",
    "productNarrative",
    "secretBoundary",
    "upstreamBoundary",
    "userVisibleConcepts",
    "version",
  ].sort(),
  "contract_top_level_keys_mismatch",
);

assert.equal(contract.productNarrative.audience, "AI 小白科研用户", "audience_must_be_ai_beginner_research_users");
assert.equal(contract.productNarrative.category, "OPL 科研托管平台", "category_must_be_managed_opl_research_platform");
assert.equal(contract.productNarrative.notCloudConsole, true, "product_must_not_be_cloud_console");
assert.equal(
  contract.productNarrative.primaryStatement,
  "MedOPL 是面向 AI 小白科研用户的 OPL 科研托管平台，不是云资源控制台。",
  "primary_product_statement_mismatch",
);

assertIncludesAll(contract.userVisibleConcepts, [
  "科研工作台",
  "托管运行环境",
  "工作空间",
  "文件空间",
  "套餐",
  "余额",
  "任务",
  "输出文件",
  "运行轨迹",
  "停止使用 / 释放托管环境",
], "user_visible_concepts");
assertExcludesAll(contract.userVisibleConcepts, [
  "CVM",
  "COS",
  "TKE",
  "K8s",
  "云资源控制台",
  "resourceBinding",
  "billingAccount",
  "auditTag",
], "user_visible_concepts");

assertIncludesAll(contract.forbiddenUserNarrative, [
  "CVM",
  "COS",
  "K8s",
  "TKE",
  "云资源控制台",
], "forbidden_user_narrative");

assertIncludesAll(contract.backendImplementationBoundary.allowedBackendTerms, [
  "CVM",
  "COS",
  "runtime",
  "resourceBinding",
  "billingAccount",
  "auditTag",
], "backend_terms");
assert.equal(contract.backendImplementationBoundary.userNarrativeAllowed, false, "backend_terms_must_not_be_user_narrative");
assert.equal(contract.backendImplementationBoundary.cloudConsoleShownToUser, false, "cloud_console_must_not_be_shown_to_user");
assert.equal(contract.backendImplementationBoundary.tkeUserNarrativeAllowed, false, "tke_must_not_be_user_narrative");

assert.deepEqual(contract.defaultPlans, ["starter_2c4g_10gb", "pro_8c16g_100gb"], "default_plans_mismatch");
assert.equal(contract.defaultPlans.includes("custom"), false, "custom_plan_must_not_be_implemented_in_mvp_contract");
assert.equal(contract.defaultPlans.includes("custom_package"), false, "custom_package_must_not_be_implemented_in_mvp_contract");

assert.equal(contract.secretBoundary.provider, "gflabtoken", "provider_must_be_gflabtoken");
assert.equal(contract.secretBoundary.portalLoginRequiresProviderKey, false, "portal_login_must_not_require_provider_key");
assert.equal(contract.secretBoundary.oplEntryRequiresProviderKey, true, "opl_entry_must_require_provider_key");
assert.equal(contract.secretBoundary.inputLocation, "OPL 登录页密码下面", "provider_key_input_location_mismatch");
assert.equal(contract.secretBoundary.gflabtokenSiteInUserMainFlow, false, "gflabtoken_site_must_not_enter_user_main_flow");
assert.equal(contract.secretBoundary.rawKeyBackendOnly, true, "raw_key_must_be_backend_only");
assert.deepEqual(contract.secretBoundary.publicFields, ["providerKeyRef", "boundStatus"], "public_secret_fields_mismatch");
assertNoRawSecretSurface(contract.secretBoundary.publicFields, "secret_public_fields");

assert.equal(contract.upstreamBoundary.repository, "https://github.com/gaofeng21cn/one-person-lab", "upstream_repository_mismatch");
assert.equal(contract.upstreamBoundary.cleanUpstream, true, "upstream_must_be_clean");
assert.equal(contract.upstreamBoundary.modifySource, false, "upstream_source_must_not_be_modified");
assert.equal(contract.upstreamBoundary.importInternalModules, false, "upstream_internal_modules_must_not_be_imported");

assert.equal(contract.billingBoundary.reconcileWithinBillingDay, true, "billing_day_reconcile_required");
assert.equal(contract.billingBoundary.stopBillingConfirmationWithinMinutesAfterRelease, 120, "stop_billing_confirmation_sla_mismatch");
assert.equal(contract.billingBoundary.auditTPlusOne, true, "audit_t_plus_one_required");
assert.equal(contract.billingBoundary.stopChargingAfterRelease, true, "billing_must_stop_after_release");

assert.equal(contract.auditingAndCleanup.postReleaseProtectionBoundary, true, "post_release_protection_boundary_required");
assert.equal(contract.auditingAndCleanup.dataCleanupAudited, true, "data_cleanup_must_be_audited");
assert.equal(contract.auditingAndCleanup.langfuseMvpNarrative, false, "langfuse_must_not_enter_mvp_product_narrative");
assert.equal(contract.auditingAndCleanup.langfuseFutureTraceMetadataSourceOnly, true, "langfuse_must_be_future_trace_metadata_source_only");

assert(Array.isArray(contract.mvpLoop), "mvp_loop_must_be_array");
assert.equal(contract.mvpLoop.length, 14, "mvp_loop_step_count_mismatch");

const expectedStepIds = Array.from({ length: 14 }, (_, index) => index + 1);
assert.deepEqual(contract.mvpLoop.map((step) => step.id), expectedStepIds, "mvp_loop_step_ids_mismatch");
assert.deepEqual(contract.mvpLoop.map((step) => step.userFacing), [
  false,
  false,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
], "mvp_loop_user_facing_flags_mismatch");

const requiredStepKeys = ["id", "name", "requiredEvidence", "userFacing"];
for (const step of contract.mvpLoop) {
  assert.deepEqual(sortedKeys(step), requiredStepKeys, `step_${step.id}_keys_mismatch`);
  assert.equal(typeof step.name, "string", `step_${step.id}_name_must_be_string`);
  assert.equal(step.name.length > 0, true, `step_${step.id}_name_must_not_be_empty`);
  assert(Array.isArray(step.requiredEvidence), `step_${step.id}_required_evidence_must_be_array`);
  assert.equal(step.requiredEvidence.length > 0, true, `step_${step.id}_required_evidence_must_not_be_empty`);
}

const loopNames = contract.mvpLoop.map((step) => step.name).join("\n");
for (const requiredPhrase of [
  "平台创建 1 名用户",
  "平台给用户充值额度",
  "用户登录 portal.medopl.cn",
  "用户进入 opl.medopl.cn",
  "用户在 opl.medopl.cn 登录 / 进入 OPL 工作台时绑定 gflabtoken API Key",
  "开通托管运行环境",
  "平台后台代开通 CVM / 存储 / runtime",
  "Portal 展示托管运行环境、工作空间、文件空间、余额、预扣费/冻结金额",
  "账单日内核对",
  "clean upstream one-person-lab",
  "发送信息、上传文件、用文件跑任务、下载输出",
  "workspace 文件、账单、session trace metadata",
  "停止使用 / 释放托管环境后停止扣费",
  "资源与数据清理进入保护/审计边界",
]) {
  assert(loopNames.includes(requiredPhrase), `mvp_loop_missing_phrase:${requiredPhrase}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  steps: contract.mvpLoop.length,
  defaultPlans: contract.defaultPlans,
}, null, 2));
