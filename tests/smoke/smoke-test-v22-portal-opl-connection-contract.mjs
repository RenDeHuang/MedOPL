import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSmokeClassifiedIn } from "../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const files = {
  specsIndex: "docs/specs/README.md",
  runtimeSpec: "specs/runtime/spec.md",
  sourceSpec: "specs/source/spec.md",
  productTruth: "docs/product/README.md",
  runtimeTruth: "docs/runtime/README.md",
  stateStoreSmoke: "tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs",
  runtimeGate: "tests/contract/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs",
  goControlplaneService: "services/medopl-go-backend/internal/service/controlplane/service.go",
  goControlplaneDomain: "services/medopl-go-backend/internal/domain/controlplane/controlplane.go",
  runtimeRoutes: "services/opl-runtime-bridge/src/runtime-bridge-routes.mjs",
  runtimeLaunch: "services/opl-runtime-bridge/src/runtime-bridge-launch.mjs",
  webuiBridgeClient: "services/opl-runtime-bridge/src/opl-webui-bridge-client.mjs",
};

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludesAll(text, required, label) {
  for (const phrase of required) {
    assert(text.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertExcludesAll(text, forbidden, label) {
  for (const phrase of forbidden) {
    assert.equal(text.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const contents = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, relativePath]) => [key, await read(relativePath)]),
));

assert.equal(contents.specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${contents.specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(contents.specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(contents.specsIndex, [
  "spec:v22-portal-opl-connection-boundary",
  "spec:v22-opl-entry-preflight-auth-boundary",
  "spec:v22-runtime-bridge-session-run-file-provider-keyref-boundary",
  "specs/runtime/spec.md",
], "connection_specs_index");

assertIncludesAll(contents.runtimeSpec, [
  "Runtime specs define Portal -> Gateway -> clean OPL upstream -> Runtime Bridge / Runtime Agent boundaries",
  "`runtime:opl-entry-real-preflight-launch`",
  "`runtime:portal-opl-entry-alias-preflight`",
  "`runtime:bridge-projection`",
  "`runtime:local-clean-opl-delivery-rc`",
  "providerKeyRef",
], "connection_runtime_spec");

assertIncludesAll(contents.sourceSpec, [
  "`source:portal-typed-api-contract`",
  "`source:opl-entry-real-preflight-launch`",
  "`source:go-control-plane-mvp-takeover`",
], "connection_source_spec");

assertIncludesAll(contents.productTruth, [
  "Portal “进入 OPL 工作台”按钮和 Gateway preflight 最终进入同一套 Gateway / launch / provider binding 逻辑",
  "进入 OPL 工作台和运行平台托管任务是两道 gate",
  "OPL entry / Gateway preflight / launch 边界",
  "Runtime Bridge session、message、fileRef、run、artifact 和 trace projection",
], "connection_product_truth");

assertIncludesAll(contents.runtimeTruth, [
  "OPL Web 用户可见入口必须是 Portal “进入 OPL 工作台”或 `/opl/entry/preflight`",
  "Runtime Bridge 负责 session/message/run/file/artifact/provider route/providerKeyRef/trace projection",
  "Real OPL canary 是验证链路，不是 production completion claim",
], "connection_runtime_truth");

for (const scriptPath of [
  "tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs",
  "tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs",
  "tests/contract/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs",
]) {
  assert(isSmokeClassifiedIn(scriptPath), `mvp_suite_includes_connection_contract_missing:${scriptPath}`);
}

assertIncludesAll(`${contents.goControlplaneService}\n${contents.goControlplaneDomain}`, [
  "ProviderKeyRef",
  "LaunchID",
  "RuntimeSessionID",
  "OPLSessionID",
  "ArtifactRef",
  "NewBootstrap",
], "connection_go_controlplane_surface");

assertIncludesAll(`${contents.runtimeGate}\n${contents.runtimeRoutes}\n${contents.runtimeLaunch}`, [
  "/runtime-bridge/api/opl/status",
  "/runtime-bridge/api/opl/bootstrap",
  "/runtime-bridge/api/opl/sessions/bind",
  "/runtime-bridge/api/opl/messages",
  "/runtime-bridge/api/opl/files",
  "/runtime-bridge/api/opl/runs",
  "/runtime-bridge/api/opl/artifacts/",
  "/runtime-bridge/api/opl/artifacts/{artifactRef}",
], "runtime_bridge_current_surface_contract");

assertIncludesAll(contents.stateStoreSmoke, [
  "state_store_must_export_transactional_update_state",
  "state_store_must_preserve_concurrent_message_backflow",
  "state_store_must_preserve_concurrent_file_backflow",
], "state_store_atomic_flow_smoke");

assertIncludesAll(contents.webuiBridgeClient, [
  "OplWebuiCapabilityError",
  "hasOplWebuiBridge",
  "getWebuiBootstrap",
  "bindWebuiWorkspace",
  "createWebuiSession",
  "sendWebuiMessage",
], "real_opl_webui_bridge_client");

assertExcludesAll(`${contents.runtimeTruth}\n${contents.runtimeSpec}`, [
  "用户直接访问 upstream 作为 v22 产品入口",
  "允许修改 one-person-lab upstream",
  "需要修改 one-person-lab upstream",
], "connection_forbidden_narrative");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_opl_connection_boundary",
  checkedFiles: Object.values(files),
}, null, 2));
