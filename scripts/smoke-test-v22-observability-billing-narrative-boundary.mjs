import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const filePaths = {
  contractsReadme: "docs/contracts/README.md",
  langfuseContract: "docs/contracts/v22-langfuse-observability-metadata-boundary.md",
  traceContract: "docs/contracts/v22-trace-metadata-boundary.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  repoZoning: "docs/recovery/repo-zoning.md",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
  mvpAcceptance: "docs/recovery/mvp-contract-acceptance.md",
  mvpSuite: "scripts/smoke-test-v22-mvp-contract-suite.mjs",
  langfuseClient: "services/portal/src/integrations/langfuse-trace-client.mjs",
  sessionTraces: "services/portal/src/domain/session-traces.mjs",
};

const forbiddenDiffPrefixes = [
  "infra/",
  "adapters/",
  "deploy/",
  ".sentrux/",
];

const authorizedExternalScriptNames = [
  "scripts/load-test-v13-langfuse-ingestion.mjs",
  "scripts/smoke-test-v13-langfuse-trace.mjs",
  "scripts/smoke-test-billing-opencost.mjs",
  "scripts/install-opencost-local.ps1",
  "scripts/start-opencost-port-forward.ps1",
  "scripts/start-opencost-ui-live.mjs",
];

const forbiddenProjectionKeys = [
  "inputPreview",
  "outputPreview",
  "rawPrompt",
  "rawCompletion",
  "rawInput",
  "rawOutput",
  "providerApiKey",
  "apiKey",
  "bearerToken",
  "launchToken",
  "runtimeToken",
  "objectKey",
  "storageKey",
  "localPath",
  "signedUrl",
  "presignedUrl",
];

const forbiddenPayloadValues = [
  "raw prompt should never leave langfuse",
  "raw input should never leave langfuse",
  "raw output should never leave langfuse",
  "raw completion should never leave langfuse",
  "sk-live-provider-key",
  "bearer-secret-token",
  "launch-token-secret",
  "runtime-token-secret",
  "tenant/object/private.txt",
  "/private/local/path.txt",
  "https://storage.example.invalid/signed",
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

async function readContractJson(filePath, startMarker, endMarker) {
  const source = await readRepoFile(filePath);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  assert.notEqual(start, -1, `${filePath}_contract_start_missing`);
  assert.notEqual(end, -1, `${filePath}_contract_end_missing`);
  const block = source.slice(start + startMarker.length, end);
  const match = block.match(/```json\n([\s\S]*?)\n```/u);
  assert(match, `${filePath}_contract_json_block_missing`);
  return JSON.parse(match[1]);
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertDoesNotInclude(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function defaultSuiteScriptReferences(source) {
  return [...source.matchAll(/scripts\/[A-Za-z0-9_.-]+\.mjs/g)].map((match) => match[0]);
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
  return [...new Set(outputs
    .flatMap((output) => output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)))];
}

async function assertNoZone4Diffs() {
  const changedFiles = changedFilesFromBase();
  for (const filePath of changedFiles) {
    assert(
      !forbiddenDiffPrefixes.some((prefix) => filePath.startsWith(prefix)),
      `zone4_path_must_not_be_modified:${filePath}`,
    );
  }
}

async function assertLangfuseContractBoundary() {
  const contract = await readContractJson(
    filePaths.langfuseContract,
    "<!-- v22-langfuse-observability-metadata-contract:start -->",
    "<!-- v22-langfuse-observability-metadata-contract:end -->",
  );
  assert.equal(contract.langfuseObservabilityAttachment.sourceOfTruth, false, "langfuse_must_not_be_source_of_truth");
  assert.equal(contract.langfuseObservabilityAttachment.portalCanonicalSource, false, "langfuse_must_not_be_portal_canonical");
  assert.equal(contract.langfuseObservabilityAttachment.billingTruth, false, "langfuse_must_not_be_billing_truth");
  assert.equal(contract.langfuseConsole.customerDefaultLangfuseUi, false, "langfuse_must_not_be_customer_default_ui");

  for (const notCanonical of [
    "Portal",
    "run",
    "artifact",
    "billing",
    "Portal session",
    "用户",
    "账单",
    "文件",
    "资源",
    "审计",
  ]) {
    assert(
      contract.langfuseObservabilityAttachment.notCanonicalFor.includes(notCanonical),
      `langfuse_not_canonical_for_missing:${notCanonical}`,
    );
  }

  for (const forbidden of [
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
  ]) {
    assert(contract.forbiddenData.includes(forbidden), `langfuse_forbidden_data_missing:${forbidden}`);
    assert(contract.langfusePersistenceForbidden.includes(forbidden), `langfuse_persistence_forbidden_missing:${forbidden}`);
  }

  for (const forbidden of [
    "raw prompt",
    "raw input",
    "raw output",
    "raw completion",
    "raw API key",
    "provider key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "object path",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl",
    "presignedUrl",
  ]) {
    assert(
      contract.portalProjectionForbiddenData.includes(forbidden),
      `langfuse_portal_projection_forbidden_data_missing:${forbidden}`,
    );
  }
}

async function assertTraceContractBoundary() {
  const traceContract = await readRepoFile(filePaths.traceContract);
  for (const forbidden of [
    "raw prompt",
    "raw input",
    "raw output",
    "raw completion",
    "raw API key",
    "provider key",
    "bearer token",
    "launchToken",
    "runtimeToken",
    "object path",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl",
    "presignedUrl",
  ]) {
    assertIncludes(traceContract, forbidden, "trace_contract_forbidden_data");
  }
}

async function assertLangfuseClientDoesNotProjectRawFields() {
  const clientSource = await readRepoFile(filePaths.langfuseClient);
  for (const forbiddenKey of forbiddenProjectionKeys) {
    assertDoesNotInclude(clientSource, forbiddenKey, "langfuse_client_source");
  }
  for (const rawMetadataPath of [
    "metadata.inputText",
    "metadata.input",
    "metadata.prompt",
    "metadata.question",
    "metadata.outputText",
    "metadata.output",
    "metadata.answer",
    "metadata.completion",
  ]) {
    assertDoesNotInclude(clientSource, rawMetadataPath, "langfuse_client_raw_metadata_projection");
  }
}

async function assertLangfuseClientFixtureSanitizesRawValues() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: [{
          id: "trace-v22-raw-leak-check",
          userId: "user-v22",
          timestamp: "2026-05-13T00:00:00.000Z",
          metadata: {
            tenantId: "tenant-v22",
            workspaceId: "workspace-v22",
            workspaceSessionId: "workspace-session-v22",
            runtimeSessionId: "runtime-session-v22",
            sessionId: "session-v22",
            runId: "run-v22",
            status: "recorded",
            totalTokens: 42,
            latencyMs: 120,
            inputText: "raw input should never leave langfuse",
            prompt: "raw prompt should never leave langfuse",
            outputText: "raw output should never leave langfuse",
            completion: "raw completion should never leave langfuse",
            providerApiKey: "sk-live-provider-key",
            authorization: "bearer-secret-token",
            launchToken: "launch-token-secret",
            runtimeToken: "runtime-token-secret",
            objectKey: "tenant/object/private.txt",
            localPath: "/private/local/path.txt",
            signedUrl: "https://storage.example.invalid/signed",
          },
        }],
      };
    },
  });

  try {
    const { createLangfuseTraceClient } = await import(new URL("../services/portal/src/integrations/langfuse-trace-client.mjs", import.meta.url).href);
    const client = createLangfuseTraceClient({
      langfuseUrl: "https://trace.medopl.cn",
      publicKey: "pk-local-fixture",
      secretKey: "sk-local-fixture",
      projectId: "platform",
      formatDateTime: (value) => String(value),
    });
    const rows = await client.fetchTraceRows({ userId: "user-v22", workspaceId: "workspace-v22", runId: "run-v22" });
    const serialized = JSON.stringify(rows);
    for (const forbiddenValue of forbiddenPayloadValues) {
      assertDoesNotInclude(serialized, forbiddenValue, "langfuse_client_fixture_payload");
    }
    for (const forbiddenKey of forbiddenProjectionKeys) {
      assertDoesNotInclude(serialized, `"${forbiddenKey}"`, "langfuse_client_fixture_payload_key");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertSessionTraceProjectionBoundary() {
  const sessionSource = await readRepoFile(filePaths.sessionTraces);
  assertIncludes(sessionSource, 'businessFactSource: "runtime_bridge_canonical_metadata"', "session_trace_runtime_bridge_fact_source");
  assertIncludes(sessionSource, 'canonicalSource: "runtime_bridge_canonical_metadata"', "session_trace_runtime_bridge_canonical_source");
  assertIncludes(sessionSource, "billingTruth: false", "session_trace_billing_truth_false");
  assertIncludes(sessionSource, "strictAdminTraceUrl", "session_trace_strict_trace_url");
  for (const forbiddenKey of ["rawPrompt", "rawCompletion", "rawInput", "rawOutput", "providerApiKey", "objectKey", "signedUrl"]) {
    assertDoesNotInclude(sessionSource, forbiddenKey, "session_trace_source_raw_projection");
  }
}

async function assertOpenCostArchiveBoundary() {
  const statusMatrix = await readRepoFile(filePaths.statusMatrix);
  const repoZoning = await readRepoFile(filePaths.repoZoning);
  const legacyBacklog = await readRepoFile(filePaths.legacyBacklog);

  assertIncludes(statusMatrix, "| OpenCost 主叙事 | 无正式入口 | archive/reference，非 v22 主线 |", "status_matrix_opencost_archive");
  assertIncludes(statusMatrix, "OpenCost 作为默认账单事实源", "status_matrix_opencost_cleanup_target");
  assertIncludes(repoZoning, "| `infra/**` | Zone 4 | forbidden_without_authorization |", "repo_zoning_infra_zone4");
  assertIncludes(repoZoning, "| `compose.langfuse.yaml` | Zone 3 | archive |", "repo_zoning_langfuse_compose_archive");
  assertIncludes(legacyBacklog, "OpenCost 只作历史或后续授权运维参考，不是当前主账单事实源。", "legacy_backlog_opencost_authorized_ops_reference");
}

async function assertDefaultEntrypointsDoNotRunLegacyObservabilityScripts() {
  const mvpSuite = await readRepoFile(filePaths.mvpSuite);
  const mvpAcceptance = await readRepoFile(filePaths.mvpAcceptance);
  const suiteScripts = defaultSuiteScriptReferences(mvpSuite);
  const defaultSuiteDoc = mvpAcceptance.match(/## 默认本地 MVP suite([\s\S]*?)(?:\n## |\n$)/u)?.[1] ?? "";
  assert(defaultSuiteDoc, "mvp_acceptance_default_suite_section_missing");

  for (const scriptPath of authorizedExternalScriptNames) {
    assert(
      !suiteScripts.includes(scriptPath),
      `default_mvp_suite_must_not_include_authorized_observability_script:${scriptPath}`,
    );
    assertDoesNotInclude(defaultSuiteDoc, scriptPath, "default_mvp_suite_doc_authorized_observability_script");
  }

  for (const scriptReference of suiteScripts) {
    assertDoesNotInclude(scriptReference, "v13", "default_mvp_suite_legacy_observability_script");
    assertDoesNotInclude(scriptReference.toLowerCase(), "opencost", "default_mvp_suite_opencost_script");
    if (scriptReference.toLowerCase().includes("langfuse")) {
      assert.equal(
        scriptReference,
        "scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs",
        `default_mvp_suite_langfuse_allowlist_violation:${scriptReference}`,
      );
    }
  }
}

async function assertOrdinaryUserPagesDoNotPromoteObservabilityTools() {
  const userSurfaceFiles = [
    "services/portal/frontend/src/views/trace/TraceView.vue",
    "services/portal/frontend/src/components/trace/TraceFilterPanel.vue",
    "services/portal/frontend/src/components/trace/TraceHero.vue",
    "services/portal/frontend/src/components/trace/TraceSessionTablePanel.vue",
  ];

  for (const filePath of userSurfaceFiles) {
    const source = await readRepoFile(filePath);
    assertDoesNotInclude(source, "OpenCost", `ordinary_user_surface_${filePath}`);
    assertDoesNotInclude(source, "opencost", `ordinary_user_surface_${filePath}`);
    assert(!/>[^<]*Langfuse[^<]*</u.test(source), `ordinary_user_surface_must_not_show_langfuse:${filePath}`);
  }
}

await assertNoZone4Diffs();
await assertLangfuseContractBoundary();
await assertTraceContractBoundary();
await assertLangfuseClientDoesNotProjectRawFields();
await assertLangfuseClientFixtureSanitizesRawValues();
await assertSessionTraceProjectionBoundary();
await assertOpenCostArchiveBoundary();
await assertDefaultEntrypointsDoNotRunLegacyObservabilityScripts();
await assertOrdinaryUserPagesDoNotPromoteObservabilityTools();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_observability_billing_narrative_boundary",
  protectedBoundaries: [
    "langfuse_sanitized_observability_attachment",
    "runtime_bridge_portal_billing_canonical_metadata",
    "opencost_archive_authorized_ops_reference",
    "default_v22_suite_no_v13_opencost_langfuse_live_load_scripts",
    "zone4_no_diff",
  ],
}, null, 2));
