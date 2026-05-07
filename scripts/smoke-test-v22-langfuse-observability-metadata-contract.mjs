import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contractPath = "docs/contracts/v22-langfuse-observability-metadata-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

const CONTRACT_START = "<!-- v22-langfuse-observability-metadata-contract:start -->";
const CONTRACT_END = "<!-- v22-langfuse-observability-metadata-contract:end -->";

const forbiddenDataNames = [
  "raw prompt",
  "raw completion",
  "raw API key",
  "bearer token",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "storageKey",
  "localPath",
  "signedUrl",
];

const forbiddenFieldNames = [
  "rawPrompt",
  "prompt",
  "rawCompletion",
  "completion",
  "rawApiKey",
  "apiKey",
  "providerApiKey",
  "bearerToken",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "storageKey",
  "localPath",
  "signedUrl",
  "presignedUrl",
];

const portalProjectionAllowedFields = [
  "costEstimate",
  "latencyMs",
  "runId",
  "sessionId",
  "status",
  "tags",
  "traceId",
  "traceUrl",
  "usageSummary",
];

function extractContractJson(markdown) {
  const startIndex = markdown.indexOf(CONTRACT_START);
  assert.notEqual(startIndex, -1, "langfuse_contract_start_marker_missing");

  const contentStart = startIndex + CONTRACT_START.length;
  const endIndex = markdown.indexOf(CONTRACT_END, contentStart);
  assert.notEqual(endIndex, -1, "langfuse_contract_end_marker_missing");
  assert.equal(markdown.indexOf(CONTRACT_START, contentStart), -1, "langfuse_contract_start_marker_must_be_unique");
  assert.equal(markdown.indexOf(CONTRACT_END, endIndex + CONTRACT_END.length), -1, "langfuse_contract_end_marker_must_be_unique");

  const block = markdown.slice(contentStart, endIndex).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  assert(match, "langfuse_contract_must_be_a_single_json_fence");

  return JSON.parse(match[1]);
}

function assertIncludesAll(actualItems, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(actualItems.includes(expected), `${label}_missing:${expected}`);
  }
}

function assertExcludesAnyKey(value, forbiddenKeys, label) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertExcludesAnyKey(item, forbiddenKeys, label);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const key of Object.keys(value)) {
    assert.equal(forbiddenKeys.includes(key), false, `${label}_must_not_include_key:${key}`);
    assertExcludesAnyKey(value[key], forbiddenKeys, label);
  }
}

function assertProjectionShape(projection, label) {
  assert.deepEqual(Object.keys(projection).sort(), portalProjectionAllowedFields, `${label}_projection_keys_mismatch`);
  assert.equal(projection.traceId, "trace-v22-langfuse-sanitized", `${label}_trace_id_mismatch`);
  assert.equal(projection.sessionId, "session-v22-langfuse", `${label}_session_id_mismatch`);
  assert.equal(projection.runId, "run-v22-langfuse", `${label}_run_id_mismatch`);
  assert.equal(projection.status, "succeeded", `${label}_status_mismatch`);
  assert.equal(projection.latencyMs, 1280, `${label}_latency_mismatch`);
  assert.equal(projection.usageSummary.totalTokens, 52, `${label}_usage_summary_mismatch`);
  assert.equal(projection.costEstimate.currency, "CNY", `${label}_cost_estimate_currency_mismatch`);
  assert.equal(projection.traceUrl, "https://observability.medopl.example/trace/trace-v22-langfuse-sanitized", `${label}_trace_url_mismatch`);
  assert.deepEqual(projection.tags, ["workspace:v22", "run:contract"], `${label}_tags_mismatch`);
  assertExcludesAnyKey(projection, forbiddenFieldNames, label);
}

const markdown = await readFile(path.join(repoRoot, contractPath), "utf8");
const readme = await readFile(path.join(repoRoot, readmePath), "utf8");
const suite = await readFile(path.join(repoRoot, suitePath), "utf8");

for (const required of [
  "Runtime Bridge session/run metadata 是 MedOPL 业务事实",
  "Portal / Billing / Audit 的 canonical source",
  "workspace、run、artifact、resourceBinding、providerKeyRef、billing/cost summary、release/audit",
  "Langfuse session/trace 是观测附件",
  "trace/session 可视化、模型调用耗时、usage、debug、错误链路",
  "不是 Portal canonical source",
  "不是 billing truth",
  "不决定余额、扣费、资源状态、文件归属、释放状态",
  "Runtime Bridge 先清洗，再投递 Langfuse",
  "Langfuse 只接收 sanitized trace/session metadata",
  "Portal 只读取 sanitized projection",
  "traceId、sessionId、runId、status、latencyMs、usage summary、cost estimate、traceUrl、tags",
  "Langfuse 不能成为用户、账单、文件、资源、审计的真相源",
  "Langfuse 部署、ClickHouse、真实 API key、真实 trace source 后续单独授权",
  "当前分支不改 runtime 实现，不接真实 Langfuse",
  "不调用真实 Langfuse / 真实云 API",
]) {
  assert(markdown.includes(required), `langfuse_contract_missing:${required}`);
}

for (const forbidden of forbiddenDataNames) {
  assert(markdown.includes(forbidden), `langfuse_forbidden_data_missing:${forbidden}`);
}

const contract = extractContractJson(markdown);

assert.equal(contract.contract, "v22_langfuse_observability_metadata_boundary", "contract_name_mismatch");
assert.equal(contract.version, 1, "contract_version_mismatch");
assert.deepEqual(contract.runtimeBridgeCanonicalSource.canonicalFor, [
  "Portal",
  "Billing",
  "Audit",
], "runtime_bridge_canonical_for_mismatch");
assertIncludesAll(contract.runtimeBridgeCanonicalSource.metadataResponsibilities, [
  "workspace",
  "run",
  "artifact",
  "resourceBinding",
  "providerKeyRef",
  "billing/cost summary",
  "release/audit",
], "runtime_bridge_metadata_responsibilities");

assert.equal(contract.langfuseObservabilityAttachment.sourceOfTruth, false, "langfuse_must_not_be_truth_source");
assertIncludesAll(contract.langfuseObservabilityAttachment.responsibleFor, [
  "trace/session 可视化",
  "模型调用耗时",
  "usage",
  "debug",
  "错误链路",
], "langfuse_responsible_for");
assertIncludesAll(contract.langfuseObservabilityAttachment.notCanonicalFor, [
  "用户",
  "账单",
  "文件",
  "资源",
  "审计",
  "余额",
  "扣费",
  "资源状态",
  "文件归属",
  "释放状态",
], "langfuse_not_canonical_for");

assert.equal(contract.sanitizationPipeline.runtimeBridgeSanitizesBeforeLangfuse, true, "runtime_bridge_must_sanitize_before_langfuse");
assert.equal(contract.sanitizationPipeline.langfuseReceives, "sanitized trace/session metadata", "langfuse_receives_mismatch");
assert.equal(contract.sanitizationPipeline.portalReads, "sanitized projection", "portal_reads_mismatch");
assert.deepEqual(contract.portalSanitizedProjection.allowedFields.sort(), portalProjectionAllowedFields, "portal_projection_allowed_fields_mismatch");
assert.deepEqual(contract.forbiddenData, forbiddenDataNames, "forbidden_data_mismatch");
assert.deepEqual(contract.langfusePersistenceForbidden, forbiddenDataNames, "langfuse_persistence_forbidden_mismatch");
assertIncludesAll(contract.deferredAuthorization, [
  "Langfuse 部署",
  "ClickHouse",
  "真实 API key",
  "真实 trace source",
], "deferred_authorization");
assertIncludesAll(contract.nonGoals, [
  "不改业务代码",
  "不改 Portal UI",
  "不改 Runtime Bridge 实现",
  "不改 Gateway / deploy / .sentrux / adapters / one-person-lab upstream",
  "不读取 secret",
  "不调用真实 Langfuse / 真实云 API",
  "不运行 build/push/kubectl/live-test",
], "non_goals");

const runtimeBridgeCanonicalMetadata = {
  workspaceId: "workspace-v22-langfuse",
  runId: "run-v22-langfuse",
  artifactRefs: ["artifact-ref-v22-langfuse-result"],
  resourceBindingId: "resource-binding-v22-langfuse",
  providerKeyRef: "provider-key-ref-v22-langfuse",
  billingCostSummary: {
    currency: "CNY",
    estimatedUsageAmount: 0.08,
    reconciliationStatus: "pending",
  },
  releaseAudit: {
    releaseStatus: "active",
    auditStatus: "pending",
  },
};
assert.deepEqual(Object.keys(runtimeBridgeCanonicalMetadata).sort(), [
  "artifactRefs",
  "billingCostSummary",
  "providerKeyRef",
  "releaseAudit",
  "resourceBindingId",
  "runId",
  "workspaceId",
], "runtime_bridge_canonical_metadata_keys_mismatch");
assertExcludesAnyKey(runtimeBridgeCanonicalMetadata, forbiddenFieldNames, "runtime_bridge_canonical_metadata");

const langfuseSanitizedEvent = {
  traceId: "trace-v22-langfuse-sanitized",
  sessionId: "session-v22-langfuse",
  runId: "run-v22-langfuse",
  status: "succeeded",
  latencyMs: 1280,
  usageSummary: {
    inputTokens: 31,
    outputTokens: 21,
    totalTokens: 52,
  },
  costEstimate: {
    currency: "CNY",
    amount: 0.08,
  },
  traceUrl: "https://observability.medopl.example/trace/trace-v22-langfuse-sanitized",
  tags: ["workspace:v22", "run:contract"],
};
assertProjectionShape(langfuseSanitizedEvent, "langfuse_sanitized_event");

const portalSanitizedProjection = { ...langfuseSanitizedEvent };
assertProjectionShape(portalSanitizedProjection, "portal_sanitized_projection");

assert(readme.includes("v22-langfuse-observability-metadata-boundary.md"), "contracts_readme_missing_langfuse_contract");
assert(readme.includes("观测附件"), "contracts_readme_must_describe_langfuse_as_observability_attachment");
assert(suite.includes("smoke-test-v22-langfuse-observability-metadata-contract"), "mvp_suite_missing_langfuse_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  portalProjectionAllowedFields,
}, null, 2));
