import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRuntimeAgentHttpRelay } from "../services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs";

const files = {
  portalOplConnection: "docs/contracts/v22-portal-opl-connection-boundary.md",
  realOplFileRunArtifact: "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
  runtimeBridge: "docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
  portalFilesBillingTrace: "docs/contracts/v22-portal-files-billing-trace-boundary.md",
  upstreamOpl: "docs/contracts/v22-upstream-opl-boundary.md",
  validationPath: "docs/recovery/real-opl-file-run-artifact-validation-path.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  mvpAcceptance: "docs/recovery/mvp-contract-acceptance.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalState: "docs/recovery/v22-goal-state.md",
  refreshGate: "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
  noFakeSuccessGate: "scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs",
  runtimeAgentLoopGate: "scripts/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop.mjs",
  runtimeAgentHttpRelay: "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
};

const allowedOplProjectionFields = [
  "resourceBindingId",
  "billingMetadataRef",
  "usageMetadataRef",
  "fileRef",
  "runId",
  "artifactRef",
  "outputFileRef",
];

const forbiddenProductionFields = [
  "ownerRef",
  "operationId",
  "k8sLabels",
  "kubernetesLabels",
  "deployOwnerLabels",
  "rawProviderKey",
  "providerApiKey",
  "apiKey",
  "launchToken",
  "runtimeToken",
  "bearerToken",
  "objectKey",
  "storageKey",
  "localPath",
  "signedUrl",
  "presignedUrl",
];

const canaryOnlyEvidenceTerms = [
  "local Runtime Agent HTTP API relay full-loop canary",
  "WebUI bridge negative no-fake-success gate",
  "provider message reply canary proves message reply only",
  "not production deploy evidence",
  "not true cloud runtime evidence",
  "not COS billing reconciliation evidence",
  "not Langfuse / `trace.medopl.cn` deployment evidence",
];

const requiredGateTerms = [
  "file_upload_capability_not_supported",
  "file_ref_not_observed",
  "requires_runtime_agent",
  "runtime_authorization_required",
  "artifact_not_observed",
  "output_file_ref_not_observed",
  "portal_projection_missing",
  "adapter_mapping_failed",
  "upstream_unavailable",
  "deferred_authorization",
  "no fake 200",
];

async function read(path) {
  return readFile(path, "utf8");
}

function assertIncludes(source, phrase, label) {
  assert(source.includes(phrase), `${label}_missing:${phrase}`);
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) assertIncludes(source, phrase, label);
}

function assertNoForbiddenProductionFields(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value || {});
  for (const field of forbiddenProductionFields) {
    assert.equal(
      serialized.includes(field),
      false,
      `${label}_must_not_include_forbidden_production_field:${field}`,
    );
  }
}

function assertProductionProjectionPayload(payload, label) {
  const keys = Object.keys(payload).sort();
  assert.deepEqual(keys, [...allowedOplProjectionFields].sort(), `${label}_allowed_projection_keys_mismatch`);
  assertNoForbiddenProductionFields(payload, label);
  for (const field of allowedOplProjectionFields) {
    assert.equal(typeof payload[field], "string", `${label}_${field}_must_be_string_ref`);
    assert(payload[field].length > 0, `${label}_${field}_must_not_be_empty`);
  }
}

function assertProductionProjectionRejected(payload, label) {
  assert.throws(
    () => assertProductionProjectionPayload(payload, label),
    /must_not_include_forbidden_production_field|allowed_projection_keys_mismatch/u,
    `${label}_must_fail_closed`,
  );
}

async function assertRuntimeAgentRelayRejectsPackageDOwnerResponse() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    fileRef: "file-package-d-owner-leak",
    ownerRef: "package-d-owner",
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  try {
    const relay = createRuntimeAgentHttpRelay({ timeoutMs: 1000 });
    await assert.rejects(
      () => relay.relayFile({
        runtimeSession: {
          workspaceId: "workspace-production-eval",
          runtimeAgentEndpoint: "http://runtime-agent.invalid",
        },
        input: {
          fileName: "input.md",
          contentType: "text/markdown",
        },
      }),
      /RUNTIME_AGENT_HTTP_RELAY_FORBIDDEN_FIELD|forbidden_field/u,
      "runtime_agent_http_relay_must_reject_package_d_owner_fields",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, filePath]) => [key, await read(filePath)]),
));

assertIncludesAll(contents.statusMatrix, [
  "### OPL Productionization Truth Split",
  "Leaf 6 productionization contract refresh: contract_refresh_only.",
  "OPL production branch may consume `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef` only as OPL-lane projection facts",
  "cloud/deploy owner facts remain outside this lane",
  ...canaryOnlyEvidenceTerms,
], "status_matrix_productionization_eval");

assertIncludesAll(contents.realOplFileRunArtifact, [
  "## Current Productionization Boundary Status",
  "productionization_status: contract_refresh_only",
  "OPL production branch may consume only `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`",
  "OPL production branch must not emit `ownerRef`, `operationId`, K8s labels, deploy owner labels, raw provider key, launchToken, runtimeToken, objectKey, storageKey, localPath, signedUrl, or presignedUrl",
  "Adapter 不得伪造 `fileRef`、`runId`、`artifactRef`、`outputFileRef`、`billingMetadataRef` 或 `usageMetadataRef`",
], "file_run_artifact_productionization_eval");

assertIncludesAll(contents.portalOplConnection, [
  "productionization_status: contract_refresh_only",
  "production implementation must not treat local canary evidence as deployment evidence",
  "不得包含 objectKey、storageKey、localPath、signedUrl、presignedUrl、raw API key、launchToken、runtimeToken 或 bearer token",
  "fake upstream smoke 只能证明合同实现，不能证明 one-person-lab 主仓真实 API 存在",
], "portal_opl_connection_productionization_eval");

assertIncludesAll(contents.runtimeBridge, [
  "`resourceBindingId`",
  "`providerKeyRef`",
  "`artifactRef`",
  "`storageKey`、`objectKey`、`localPath`、`signedUrl`、`presignedUrl`",
  "`rawPayload`、raw prompt、raw API key、`providerApiKey`、`apiKey`、`launchToken`、`runtimeToken`、bearer token",
], "runtime_bridge_productionization_eval");

assertIncludesAll(contents.portalFilesBillingTrace, [
  "`resourceBindingId`",
  "`launchToken`",
  "`runtimeToken`",
], "portal_files_billing_trace_productionization_eval");

assertIncludesAll(contents.upstreamOpl, [
  "one-person-lab 是 clean upstream",
  "upstream 目录只读/clean",
  "不修改 upstream 源码",
  "不得回退到旧端口、旧 workbench 或 fake upstream",
  "raw API Key、launchToken、runtimeToken、bearer token、objectKey、localPath、signedUrl 不进入 upstream、URL query、response、log、localStorage 或 sessionStorage",
], "upstream_opl_productionization_eval");

assertIncludesAll(contents.mvpAcceptance, [
  "Leaf 6 OPL productionization contract refresh is contract_refresh_only",
  "local Runtime Agent HTTP API relay full-loop canary is not production deploy evidence",
  "WebUI bridge negative no-fake-success gate is not production deploy evidence",
  "provider message reply canary remains message/reply only",
], "mvp_acceptance_productionization_eval");

assertIncludesAll(contents.validationPath, [
  "Stage 12: Productionization handoff",
  "production implementation remains separate",
  "no secret, live provider, real cloud, build/push, kubectl, deploy, upstream modification, or live-test ran in this leaf",
  "未验证能力必须保留 gate",
  ...requiredGateTerms,
], "validation_path_productionization_eval");

assertIncludesAll(contents.gapMatrix, [
  "next_leaf_step: deferred_authorized_without_step_local_auth_record",
  "eval: `node scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs`, `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`",
  "block canary-only production claims, fake success, raw secret/token/storage leakage, upstream modification, cloud/deploy owner-field leakage, and unauthorized cloud/deploy operations",
  "f114ee587db2a41a3a85fc5f67bbed4fbe63e57b",
  "leaf-frontend-product-evalset-gap",
], "gap_matrix_productionization_eval");

assertIncludesAll(contents.goalState, [
  "leaf-opl-connection-productionization-local-implementation",
  "OPL connection productionization local implementation",
  "implement the smallest local OPL productionization slice",
  "Leaf 8 B absorb/push result",
  "next cursor is `leaf-frontend-product-evalset-gap`",
  "production implementation must not treat canary evidence as production deploy evidence",
  "node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
  "no service/upstream/deploy/cloud/secret operation may be present",
], "goal_state_productionization_eval");

assertIncludesAll(contents.refreshGate, [
  "leaf-opl-connection-productionization-eval-shell",
  "eval: `node scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs`, `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`",
], "refresh_gate_productionization_eval");

assertIncludesAll(contents.noFakeSuccessGate, [
  "file_upload_capability_not_supported",
  "requires_runtime_agent",
  "artifact_not_observed",
  "output_file_ref_not_observed",
  "no_secret_or_storage_leak",
], "no_fake_success_gate_productionization_eval");

assertIncludesAll(contents.runtimeAgentLoopGate, [
  "FORBIDDEN_PACKAGE_D_PATTERN",
  "FORBIDDEN_PUBLIC_PATTERN",
  "billingMetadataRef",
  "usageMetadataRef",
  "resourceBindingId",
  "fileRef",
  "artifactRef",
], "runtime_agent_loop_gate_productionization_eval");

assertIncludesAll(contents.runtimeAgentHttpRelay, [
  "ownerRef",
  "operationId",
  "k8sLabels",
  "deployOwnerLabels",
], "runtime_agent_http_relay_package_d_owner_guard");

await assertRuntimeAgentRelayRejectsPackageDOwnerResponse();

assertProductionProjectionPayload({
  resourceBindingId: "rb-production-eval",
  billingMetadataRef: "billing-meta-production-eval",
  usageMetadataRef: "usage-meta-production-eval",
  fileRef: "file-production-eval",
  runId: "run-production-eval",
  artifactRef: "artifact-production-eval",
  outputFileRef: "output-production-eval",
}, "positive_projection_fixture");

assertProductionProjectionRejected({
  resourceBindingId: "rb-production-eval",
  billingMetadataRef: "billing-meta-production-eval",
  usageMetadataRef: "usage-meta-production-eval",
  fileRef: "file-production-eval",
  runId: "run-production-eval",
  artifactRef: "artifact-production-eval",
  outputFileRef: "output-production-eval",
  ownerRef: "package-d-owner",
}, "owner_field_projection_fixture");

assertProductionProjectionRejected({
  resourceBindingId: "rb-production-eval",
  billingMetadataRef: "billing-meta-production-eval",
  usageMetadataRef: "usage-meta-production-eval",
  fileRef: "file-production-eval",
  runId: "run-production-eval",
  artifactRef: "artifact-production-eval",
  outputFileRef: "output-production-eval",
  signedUrl: "https://storage.example.invalid/object",
}, "storage_leak_projection_fixture");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_connection_productionization_eval_shell",
  checkedFiles: files,
  allowedOplProjectionFields,
  forbiddenProductionFields,
  canaryOnlyEvidenceTerms,
  requiredGateTerms,
}, null, 2));
