import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  portalOplConnection: "docs/contracts/v22-portal-opl-connection-boundary.md",
  realOplFileRunArtifact: "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
  validationPath: "docs/recovery/real-opl-file-run-artifact-validation-path.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  gapMatrix: "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
  goalState: "docs/recovery/v22-goal-state.md",
  mvpAcceptance: "docs/recovery/mvp-contract-acceptance.md",
  mvpSuite: "scripts/smoke-test-v22-mvp-contract-suite.mjs",
};

async function read(path) {
  return readFile(path, "utf8");
}

function assertIncludesAll(source, required, label) {
  for (const phrase of required) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, filePath]) => [key, await read(filePath)]),
));

assertIncludesAll(contents.portalOplConnection, [
  "## Current Productionization Boundary Status",
  "productionization_status: contract_refresh_only",
  "absorbed_canary_fact: local Runtime Agent HTTP API relay full-loop",
  "absorbed_canary_fact: WebUI bridge negative no-fake-success gates",
  "absorbed_canary_fact: provider message reply is message-only",
  "not_production_truth: real cloud runtime is not上线",
  "not_production_truth: COS billing reconciliation is not上线",
  "not_production_truth: Langfuse / trace.medopl.cn is not deployed",
  "not_production_truth: one-person-lab upstream HTTP Product API is not available",
  "production implementation must not treat local canary evidence as deployment evidence",
], "portal_opl_connection_status");

assertIncludesAll(contents.realOplFileRunArtifact, [
  "## Current Productionization Boundary Status",
  "productionization_status: contract_refresh_only",
  "absorbed_local_canary: runtime_agent_http_api_full_loop",
  "absorbed_local_canary: webui_file_run_artifact_no_fake_success_gate",
  "absorbed_authorized_canary: provider_message_reply_only",
  "production_truth_blocked_until: stable Runtime Agent endpoint binding",
  "production_truth_blocked_until: authorized cloud runtime lane",
  "production_truth_blocked_until: COS billing reconciliation lane",
  "production_truth_blocked_until: authorized Langfuse attachment lane",
  "OPL production branch may consume only `resourceBindingId`, `billingMetadataRef`, `usageMetadataRef`, `fileRef`, `runId`, `artifactRef`, and `outputFileRef`",
  "OPL production branch must not emit `ownerRef`, `operationId`, K8s labels, deploy owner labels, raw provider key, launchToken, runtimeToken, objectKey, storageKey, localPath, signedUrl, or presignedUrl",
], "file_run_artifact_status");

assertIncludesAll(contents.validationPath, [
  "Leaf 6: OPL productionization contract refresh",
  "This leaf is contract/status refresh only",
  "local Runtime Agent HTTP API relay full-loop is absorbed as canary evidence",
  "WebUI bridge negative no-fake-success gates are absorbed as canary evidence",
  "provider message live canary remains message/reply only",
  "production implementation remains separate",
  "no secret, live provider, real cloud, build/push, kubectl, deploy, upstream modification, or live-test ran in this leaf",
], "validation_path_leaf6");

assertIncludesAll(contents.statusMatrix, [
  "Leaf 6 productionization contract refresh",
  "contract_refresh_only",
  "local Runtime Agent HTTP API relay full-loop canary",
  "WebUI bridge negative no-fake-success gate",
  "message reply only",
  "not production deploy evidence",
], "status_matrix_leaf6");

assertIncludesAll(contents.gapMatrix, [
  "leaf-opl-connection-productionization-contract-refresh",
  "leaf-opl-connection-productionization-eval-shell",
  "contract_refresh_only",
  "next_leaf_step: leaf-opl-connection-productionization-eval-shell",
  "future `node scripts/smoke-test-v22-opl-productionization-eval-shell.mjs`",
  "canary facts must not become production truth without productionized branch absorption",
], "gap_matrix_leaf6");

assertIncludesAll(contents.goalState, [
  "leaf-opl-connection-productionization-contract-refresh",
  "Leaf 6 B absorb/push result",
  "bc22a76b4776f54c10bcc659f1c777e30791b72d",
  "next cursor is `leaf-opl-connection-productionization-eval-shell`",
  "leaf-opl-connection-productionization-eval-shell",
  "OPL connection productionization contract refresh",
  "OPL connection productionization eval shell",
  "no raw provider key, no live canary unless separately authorized",
  "truth_writeback_target: `docs/recovery/real-opl-file-run-artifact-validation-path.md`, `docs/recovery/status-matrix.md`, `docs/recovery/v22-goal-state.md`",
], "goal_state_leaf6");

assertIncludesAll(contents.mvpAcceptance, [
  "Leaf 6 OPL productionization contract refresh",
  "contract_refresh_only",
  "local Runtime Agent HTTP API relay full-loop canary is not production deploy evidence",
], "mvp_acceptance_leaf6");

assertIncludesAll(contents.mvpSuite, [
  "smoke-test-v22-opl-productionization-contract-refresh",
  "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
], "mvp_suite_leaf6");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_productionization_contract_refresh",
  checkedFiles: files,
}, null, 2));
