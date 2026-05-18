import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSmokeClassifiedIn } from "./v22-smoke-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contractPath = "docs/contracts/v22-langfuse-observability-metadata-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";
const portalPayloadPath = "services/portal/src/domain/portal-api-payloads.mjs";
const portalRuntimeClientsPath = "services/portal/src/app/portal-runtime-clients.mjs";
const runtimeBridgeRoutesPath = "services/opl-runtime-bridge/src/runtime-bridge-routes.mjs";
const inventoryPath = "docs/recovery/physical-legacy-file-retirement-inventory.md";

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

const oldRuntimeTraceSource = "Langfuse";
const oldStorageEngineName = "Click" + "House";
const portalName = "Portal";
const oldNarrativePatterns = [
  ["langfuse_storage_engine", new RegExp(`${oldRuntimeTraceSource} ${oldStorageEngineName}`)],
  ["live_langfuse_source", new RegExp(`live ${oldRuntimeTraceSource}`)],
  ["customer_default_langfuse", new RegExp(`客户默认.*${oldRuntimeTraceSource}`)],
  ["portal_storage_engine", new RegExp(`${portalName}.*${oldStorageEngineName}`)],
  ["billing_truth_phrase", new RegExp(["billing", "truth"].join(" "))],
  ["canonical_source_phrase", new RegExp(["canonical", "source"].join(" "))],
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
  assert.equal(projection.traceUrl, "https://trace.medopl.cn/project/platform/traces/trace-v22-langfuse-sanitized", `${label}_trace_url_mismatch`);
  assert.deepEqual(projection.tags, ["workspace:v22", "run:contract"], `${label}_tags_mismatch`);
  assertExcludesAnyKey(projection, forbiddenFieldNames, label);
}

function assertNoForbiddenValue(value, label) {
  const serialized = JSON.stringify(value);
  for (const fieldName of forbiddenFieldNames) {
    assert.equal(new RegExp(fieldName, "i").test(serialized), false, `${label}_must_not_include_forbidden_field:${fieldName}`);
  }
  for (const forbidden of [
    "raw prompt content",
    "raw completion content",
    "gflabtoken_raw_secret",
    "bearer-token-secret",
    "launch-token-secret",
    "runtime-token-secret",
    "internal/object/key.csv",
    "internal-storage-key",
    "/private/local/result.csv",
    "https://storage.example.test/signed",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${label}_must_not_leak_forbidden_value:${forbidden}`);
  }
}

function assertNoOldNarrative(text, label) {
  for (const [patternLabel, pattern] of oldNarrativePatterns) {
    assert.equal(pattern.test(text), false, `${label}_must_not_include_old_narrative:${patternLabel}`);
  }
}

const markdown = await readFile(path.join(repoRoot, contractPath), "utf8");
const readme = await readFile(path.join(repoRoot, readmePath), "utf8");
const suite = await readFile(path.join(repoRoot, suitePath), "utf8");
const { createLangfuseSanitizedProjectionAdapter } = await import("../services/portal/src/integrations/langfuse-trace-client.mjs");
const { createPortalApiPayloads } = await import("../services/portal/src/domain/portal-api-payloads.mjs");
const portalPayloadSource = await readFile(path.join(repoRoot, portalPayloadPath), "utf8");
const portalRuntimeClientsSource = await readFile(path.join(repoRoot, portalRuntimeClientsPath), "utf8");
const runtimeBridgeRoutesSource = await readFile(path.join(repoRoot, runtimeBridgeRoutesPath), "utf8");
const inventory = await readFile(path.join(repoRoot, inventoryPath), "utf8");

assertNoOldNarrative(markdown, "langfuse_contract");
assertNoOldNarrative(portalPayloadSource, "portal_api_payloads");

for (const required of [
  "Runtime Bridge session/run metadata 是 MedOPL 业务事实",
  "Portal / Billing / Audit 的业务事实源",
  "workspace、run、artifact、resourceBinding、providerKeyRef、billing/cost summary、release/audit",
  "Langfuse session/trace 是 optional observability attachment",
  "trace/session 可视化、模型调用耗时、usage、debug、错误链路",
  "不承担 Portal 事实源角色",
  "不是结算真相源",
  "不决定余额、扣费、资源状态、文件归属、释放状态",
  "Runtime Bridge 先清洗，再投递 Langfuse",
  "Langfuse 只接收 sanitized trace/session metadata",
  "Portal 只读取 sanitized projection",
  "traceId、sessionId、runId、status、latencyMs、usage summary、cost estimate、traceUrl、tags",
  "sanitized projection adapter",
  "输入为 Runtime Bridge 已清洗 metadata + Langfuse trace/session 摘要",
  "Portal “会话轨迹”展示合并后的业务化摘要",
  "trace.medopl.cn 是 Langfuse admin/ops console",
  "客户侧 trace 浏览仍在 Portal 的“会话轨迹”页面",
  "trace.medopl.cn 是管理员/运维原生观测台，不承担 Portal/结算事实源角色，也不是客户默认 trace 页面",
  "trace.medopl.cn 的真实部署、Ingress/TLS、LB、DNS、Langfuse secret、ClickHouse 等仍需后续单独授权",
  "projection 中的 traceUrl 必须静态严格校验 URL origin，不能用字符串前缀匹配",
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
assert.equal(contract.langfuseObservabilityAttachment.attachmentKind, "optional observability attachment", "langfuse_attachment_kind_mismatch");
assert.equal(contract.langfuseConsole.consoleRole, "admin/ops console", "langfuse_console_role_mismatch");
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
assert.equal(contract.sanitizationPipeline.adapter, "sanitized projection adapter", "sanitization_pipeline_adapter_mismatch");
assert.equal(contract.sanitizationPipeline.adapterInput, "Runtime Bridge 已清洗 metadata + Langfuse trace/session 摘要", "sanitization_pipeline_adapter_input_mismatch");
assert.equal(contract.sanitizationPipeline.portalBusinessSummarySurface, "Portal 会话轨迹", "sanitization_pipeline_portal_surface_mismatch");
assert.equal(contract.langfuseConsole.adminConsoleUrl, "https://trace.medopl.cn", "langfuse_admin_console_url_mismatch");
assert.equal(contract.langfuseConsole.customerTraceSurface, "Portal 会话轨迹", "customer_trace_surface_mismatch");
assert.equal(contract.langfuseConsole.customerDefaultLangfuseUi, false, "customer_default_langfuse_ui_must_be_false");
assert.equal(contract.langfuseConsole.portalCanonicalSource, false, "trace_medopl_cn_must_not_be_portal_canonical_source");
assert.equal(contract.langfuseConsole.billingTruth, false, "trace_medopl_cn_must_not_be_billing_truth");
assert.deepEqual(contract.portalSanitizedProjection.allowedFields.sort(), portalProjectionAllowedFields, "portal_projection_allowed_fields_mismatch");
assert.deepEqual(contract.traceUrlOriginValidation, {
  requiredOrigin: "https://trace.medopl.cn",
  urlParserRequired: true,
  stringPrefixMatchingAllowed: false,
  invalidOriginRejected: true,
}, "trace_url_origin_validation_mismatch");
assert.deepEqual(contract.forbiddenData, forbiddenDataNames, "forbidden_data_mismatch");
assert.deepEqual(contract.langfusePersistenceForbidden, forbiddenDataNames, "langfuse_persistence_forbidden_mismatch");
assertIncludesAll(contract.deferredAuthorization, [
  "trace.medopl.cn 真实部署",
  "Ingress/TLS",
  "LB",
  "DNS",
  "Langfuse secret",
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
  traceUrl: "https://trace.medopl.cn/project/platform/traces/trace-v22-langfuse-sanitized",
  tags: ["workspace:v22", "run:contract"],
};
assertProjectionShape(langfuseSanitizedEvent, "langfuse_sanitized_event");

const portalSanitizedProjection = { ...langfuseSanitizedEvent };
assertProjectionShape(portalSanitizedProjection, "portal_sanitized_projection");

const projectionAdapter = createLangfuseSanitizedProjectionAdapter({
  adminConsoleUrl: "https://trace.medopl.cn",
});
assert.throws(
  () => createLangfuseSanitizedProjectionAdapter({ adminConsoleUrl: "https://trace.medopl.cn.evil.example" }),
  /langfuse_projection_admin_console_origin_mismatch/,
  "admin_console_origin_must_be_fixed_to_trace_medopl_cn",
);

function projectionInputWithTraceUrl(traceUrl) {
  return {
    runtimeBridgeMetadata: {
      sessionId: "session-v22-langfuse",
      runId: "run-v22-langfuse",
      status: "succeeded",
      tags: ["workspace:v22", "run:contract"],
      billingCostSummary: {
        currency: "CNY",
        estimatedAmount: 0.08,
      },
    },
    langfuseTraceSummary: {
      traceId: "trace-v22-langfuse-sanitized",
      latencyMs: 1280,
      usageSummary: {
        inputTokens: 31,
        outputTokens: 21,
        totalTokens: 52,
      },
      traceUrl,
    },
  };
}

const adapterProjection = projectionAdapter.project({
  runtimeBridgeMetadata: {
    sessionId: "session-v22-langfuse",
    runId: "run-v22-langfuse",
    status: "succeeded",
    tags: ["workspace:v22", "run:contract"],
    billingCostSummary: {
      currency: "CNY",
      estimatedAmount: 0.08,
    },
  },
  langfuseTraceSummary: {
    traceId: "trace-v22-langfuse-sanitized",
    latencyMs: 1280,
    usageSummary: {
      inputTokens: 31,
      outputTokens: 21,
      totalTokens: 52,
    },
    traceUrl: "https://trace.medopl.cn/project/platform/traces/trace-v22-langfuse-sanitized",
    rawPrompt: "raw prompt content",
    rawCompletion: "raw completion content",
    rawApiKey: "gflabtoken_raw_secret",
    bearerToken: "bearer-token-secret",
    launchToken: "launch-token-secret",
    runtimeToken: "runtime-token-secret",
    objectKey: "internal/object/key.csv",
    storageKey: "internal-storage-key",
    localPath: "/private/local/result.csv",
    signedUrl: "https://storage.example.test/signed",
  },
});
assertProjectionShape(adapterProjection, "adapter_projection");
assertNoForbiddenValue(adapterProjection, "adapter_projection");

for (const forgedTraceUrl of [
  "https://trace.medopl.cn.evil.example/project/platform/traces/trace-v22-langfuse-sanitized",
  "https://evil.example/https://trace.medopl.cn/project/platform/traces/trace-v22-langfuse-sanitized",
  "http://trace.medopl.cn/project/platform/traces/trace-v22-langfuse-sanitized",
  "//trace.medopl.cn.evil.example/project/platform/traces/trace-v22-langfuse-sanitized",
]) {
  assert.throws(
    () => projectionAdapter.project(projectionInputWithTraceUrl(forgedTraceUrl)),
    /langfuse_projection_trace_url_must_use_admin_console_origin|langfuse_projection_trace_url_invalid/,
    `forged_trace_url_must_be_rejected:${forgedTraceUrl}`,
  );
}

const payloads = createPortalApiPayloads({
  collectRunsForUser: async () => [],
  defaultTaskTitle: (slug) => `Task ${slug}`,
  ensureTaskSpace: async (_db, user, slug) => ({ slug, userId: user.id }),
  fetchBillingSummary: async () => ({ totals: { totalCost: 0 }, items: [] }),
  fetchHarborSummary: async () => ({ available: false }),
  fetchLangfuseSummary: async () => ({
    available: true,
    source: "langfuse_observability_attachment",
    canonicalSource: false,
    billingTruth: false,
  }),
  fetchTraceRows: async () => ({
    source: "langfuse_sanitized_projection",
    type: "sanitized_projection",
    rows: [adapterProjection],
  }),
  findTaskSpace: () => null,
  isRunTerminal: () => false,
  normalizePageSize: (value) => Number(value || 10),
  paginateRows: (rows, pageValue = 1, pageSizeValue = 10) => ({
    rows: rows.slice(0, Number(pageSizeValue || 10)),
    page: Number(pageValue || 1),
    pageSize: Number(pageSizeValue || 10),
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / Number(pageSizeValue || 10))),
  }),
  buildWorkspacePayload: async () => ({ workspace: { slug: "" }, counts: {}, distribution: {} }),
});
const portalTracePayload = await payloads.buildTracesApiPayload({
  userId: "user-v22-langfuse",
  workspaceId: "workspace-v22-langfuse",
  runId: "run-v22-langfuse",
});
assert.deepEqual(portalTracePayload.items, [adapterProjection], "portal_trace_payload_must_consume_sanitized_projection");
assert.equal(portalTracePayload.summary.canonicalSource, false, "portal_trace_summary_must_not_make_langfuse_canonical_source");
assert.equal(portalTracePayload.summary.billingTruth, false, "portal_trace_summary_must_not_make_langfuse_billing_truth");
assert.equal(portalTracePayload.customerTraceSurface, "Portal 会话轨迹", "portal_trace_customer_surface_mismatch");
assert.equal(portalTracePayload.customerDefaultLangfuseUi, false, "portal_trace_must_not_use_langfuse_ui_as_customer_default");
assertNoForbiddenValue(portalTracePayload, "portal_trace_payload");

assert(readme.includes("v22-langfuse-observability-metadata-boundary.md"), "contracts_readme_missing_langfuse_contract");
assert(readme.includes("观测附件"), "contracts_readme_must_describe_langfuse_as_observability_attachment");
assert(isSmokeClassifiedIn("scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs"), "mvp_suite_missing_langfuse_smoke");
assert(portalPayloadSource.includes("Portal 会话轨迹 sanitized projection"), "portal_payload_trace_summary_datasource_mismatch");
assert(portalPayloadSource.includes('source: traceRows.source || "langfuse_sanitized_projection"'), "portal_payload_must_preserve_sanitized_projection_source");
assert(
  portalRuntimeClientsSource.includes("../integrations/langfuse-trace-client.mjs"),
  "langfuse_trace_client_active_import_missing",
);
assert(
  runtimeBridgeRoutesSource.includes("./langfuse-publisher.mjs"),
  "langfuse_publisher_active_import_missing",
);
assert(
  inventory.includes("active import from `services/portal/src/app/portal-runtime-clients.mjs`"),
  "inventory_must_record_langfuse_trace_client_active_import",
);
assert(
  inventory.includes("active import from `services/opl-runtime-bridge/src/runtime-bridge-routes.mjs`"),
  "inventory_must_record_langfuse_publisher_active_import",
);
assert(
  inventory.includes("zero-compat correction:"),
  "inventory_must_record_zero_compat_truth_writeback",
);

console.log(JSON.stringify({
  ok: true,
  contract: contract.contract,
  portalProjectionAllowedFields,
}, null, 2));
