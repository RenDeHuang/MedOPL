import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = {
  connection: "docs/contracts/v22-portal-opl-connection-boundary.md",
  readme: "docs/contracts/README.md",
  mvp: "docs/contracts/v22-mvp-managed-opl-loop.md",
  entry: "docs/contracts/v22-opl-entry-preflight-auth-boundary.md",
  upstream: "docs/contracts/v22-upstream-opl-boundary.md",
  runtime: "docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
  oplWork: "docs/contracts/v22-opl-work-message-file-run-boundary.md",
  portalFiles: "docs/contracts/v22-portal-files-billing-trace-boundary.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  suite: "scripts/smoke-test-v22-mvp-contract-suite.mjs",
  stateStoreSmoke: "scripts/smoke-test-v22-opl-adapter-state-store-atomic-flow.mjs",
  adapterApiSmoke: "scripts/smoke-test-v22-portal-opl-adapter-api-local-flow.mjs",
  realOplCanarySmoke: "scripts/smoke-test-v22-real-opl-canary.mjs",
  realOplWebuiCanarySmoke: "scripts/smoke-test-v22-real-opl-webui-canary.mjs",
  realOplWebuiAdapterSmoke: "scripts/smoke-test-v22-real-opl-webui-adapter-flow.mjs",
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

assertIncludesAll(contents.connection, [
  "Portal-OPL Connection Boundary Contract",
  "不修改 one-person-lab upstream",
  "Portal 发起进入 OPL",
  "Gateway 打开 clean upstream OPL",
  "OPL 获取 MedOPL 公开上下文",
  "OPL session 绑定到 Portal 用户、tenant、workspace 和 runtime session",
  "OPL 发消息、上传文件或发起 run",
  "Runtime Agent 生成 run record、artifact reference、trace metadata 和 billing metadata",
  "Portal 按 workspace/session/run 展示文件、账单和运行轨迹",
], "connection_closed_loop_summary");

assertIncludesAll(contents.connection, [
  "POST /portal/api/opl/launch",
  "GET /portal-adapter/api/opl/bootstrap",
  "POST /portal-adapter/api/opl/sessions/bind",
  "POST /portal-adapter/api/opl/messages",
  "GET /portal-adapter/api/opl/messages/{messageId}/status",
  "POST /portal-adapter/api/opl/files",
  "POST /portal-adapter/api/opl/runs",
  "GET /portal-adapter/api/opl/runs/{runId}/status",
  "GET /portal-adapter/api/opl/runs/{runId}/artifacts",
  "GET /portal-adapter/api/opl/artifacts/{artifactRef}",
  "GET /portal/api/opl/bootstrap",
  "POST /portal/api/opl/sessions/bind",
  "POST /portal/api/opl/messages",
  "GET /portal/api/opl/messages/{messageId}/status",
  "POST /portal/api/opl/files",
  "POST /portal/api/opl/runs",
  "GET /portal/api/opl/runs/{runId}/status",
  "GET /portal/api/opl/runs/{runId}/artifacts",
  "GET /portal/api/opl/artifacts/{artifactRef}",
], "connection_required_interfaces");

assertIncludesAll(contents.connection, [
  "`portalUserId`",
  "`tenantId`",
  "`workspaceId`",
  "`workspaceSessionId`",
  "`oplSessionId`",
  "`runtimeSessionId`",
  "`resourceBindingId`",
  "`runId`",
  "`traceId`",
  "`providerKeyRef`",
  "`providerBound`",
  "`artifactRef`",
], "connection_identity_and_trace_fields");

assertIncludesAll(contents.connection, [
  "workspace 绑定是必需项",
  "文件归属",
  "运行归属",
  "计费归属",
  "审计归属",
  "隔离归属",
  "没有 workspaceId 的 OPL session 或 run 必须失败",
], "connection_workspace_binding_required");

assertIncludesAll(contents.connection, [
  "launchToken/runtimeToken 只能保存在 httpOnly cookie 或服务端 launch session",
  "launchToken/runtimeToken 不得进入 URL query",
  "launchToken/runtimeToken 不得进入 localStorage/sessionStorage",
  "raw gflabtoken API key 不得进入 upstream、browser public state、response、log、evidence 或 git",
  "OPL/browser public state 不得持有 raw API key、bearer token、objectKey、localPath、signedUrl",
], "connection_secret_boundary");

assertIncludesAll(contents.connection, [
  "未绑定 gflabtoken provider key 时，run 返回 `provider_key_required`",
  "未开通托管运行环境或缺少 active `resourceBindingId` 时，run 返回 `managed_environment_required`",
  "缺少 Runtime Agent identity 或 endpoint 时，run 返回 `platform_isolated_runtime_agent_required`",
  "Runtime Agent 只能接收 `providerKeyRef`，不得接收 raw API key",
], "connection_run_gates");

assertIncludesAll(contents.connection, [
  "Adapter Decoupling And Anti-Corruption Boundary",
  "Portal 只依赖 MedOPL 稳定接口",
  "不得依赖 one-person-lab upstream 内部 API、DOM、store、数据库 schema 或内部 session model",
  "Gateway / Portal OPL Adapter 是 anti-corruption layer",
  "`adapterContractVersion`",
  "`capabilities`",
  "`supportedEvents`",
  "OPL message/file/run 事件必须先归一化为 MedOPL canonical event",
  "upstream OPL 更新只允许改 Gateway/Adapter 映射层",
  "不能改 Portal billing、workspace、resourceBinding、provider secret 或 audit 的核心合同",
  "`capability_not_supported`",
  "真实 upstream 能力必须先由 canary 分类，不能从 fake Product API fixture 推断",
  "`real_http_product_api`",
  "`mapped_to_acp_runtime`",
  "`capability_not_supported`",
  "`opl web` 已 retired",
  "主仓没有 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API",
  "`opl session runtime --acp` 可作为 bootstrap/session bind 的公开映射面",
  "真实 WebUI canary 结论",
  "该 WebUI 的真实 session 协议是 WebSocket bridge",
  "`create-conversation`、`database.get-user-conversations`、`database.get-conversation-messages` 已完成真实 session 创建和数据库回读",
  "只是通用 `/api` catch-all 的 200 placeholder，不是 Product API",
  "`chat.send.message` 当前会进入 WebUI/ACP 启动路径但未形成完整 AI reply 回流",
  "真实 WebUI Adapter flow 结论",
  "Portal OPL Adapter 可以在 `OPL_RUNTIME_MODE=webui`",
  "launch 阶段创建真实 WebUI conversation",
  "bootstrap 从 WebUI database 回读 session",
  "`opl_webui_bridge_session_created`",
  "不能生成伪 run/artifact 成功",
  "当真实 upstream 没有 HTTP Product API 而只有 ACP/CLI 边界时",
  "`initialize`、`session_list`、`session_ledger`",
  "不同 API 必须低耦合演进",
  "每个 API 的验收不得只检查 HTTP 200/201/202",
  "真实访问和真实回流",
  "必须访问 upstream/Product API 的 health、system、engines、modules、agents、workspaces、sessions、progress 和 artifacts 边界",
  "message request、reply、message artifact 和 trace 写回 Adapter state",
  "调用 Runtime Agent relay/API 边界",
  "run record、runtime artifact、session ledger entry 和 trace 写回 Adapter state",
  "Portal `/portal/api/opl/*` 代理必须用当前用户的 `launchId` 换取后端 launch token",
  "Adapter state 写入必须能保留并发 message/file/run 回流",
], "connection_adapter_decoupling_boundary");

assertIncludesAll(contents.connection, [
  "Portal 点击“进入 OPL 工作台”后打开 clean upstream OPL",
  "bootstrap 不含 raw key、token 或内部存储路径",
  "OPL session 绑定到 `portalUserId`、`tenantId`、`workspaceId`、`runtimeSessionId` 和 `resourceBindingId`",
  "start run 后平台生成 `runId`",
  "输出文件只以 `artifactRef` 或 `outputFileRef` 回到 Portal",
  "Portal 能按 workspace、session 和 run 看到任务、文件、trace 和账单状态",
  "真实 OPL canary 必须输出接口事实",
  "fake upstream smoke 只能证明合同实现，不能证明 one-person-lab 主仓真实 API 存在",
], "connection_acceptance");

assertIncludesAll(contents.upstream, [
  "Real Main-Repo Canary Findings",
  "`opl web` 真实执行返回 `cli_usage_error`",
  "主仓当前不提供可启动的本地 Product API Web 进程",
  "主仓当前没有暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions`",
  "`opl session runtime --acp` 是当前可验证的公开 CLI/ACP 边界",
  "`workspace_list` 虽出现在 ACP command list 中，但隔离 canary 返回 `invalid_payload`",
  "Portal OPL Adapter 可在 `OPL_RUNTIME_MODE=acp`",
], "upstream_real_canary_findings");

assertIncludesAll(contents.readme, [
  "v22-portal-opl-connection-boundary.md",
  "Portal-OPL connection",
], "readme_connection_subscription");

assertIncludesAll(contents.suite, [
  "smoke-test-v22-portal-opl-connection-contract",
  "smoke-test-v22-opl-adapter-state-store-atomic-flow",
  "smoke-test-v22-portal-opl-adapter-api-local-flow",
], "mvp_suite_includes_connection_contract");

assertIncludesAll(contents.adapterApiSmoke, [
  "/portal-adapter/api/opl/status",
  "/portal-adapter/api/opl/bootstrap",
  "/portal-adapter/api/opl/sessions/bind",
  "/portal-adapter/api/opl/messages",
  "/portal-adapter/api/opl/messages/",
  "/portal-adapter/api/opl/files",
  "/portal-adapter/api/opl/runs",
  "/portal-adapter/api/opl/runs/",
  "/portal-adapter/api/opl/artifacts/",
  "opl_web_url_must_not_include_launch_token_query",
  "launch_cookie_must_be_http_only",
  "bootstrap_product_api_access_observed",
  "session_message_file_run_state_backflow",
  "portal_proxy_backflow",
  "stable_run_artifacts_must_read_persisted_run_artifact",
], "adapter_api_local_flow_smoke");

assertIncludesAll(contents.realOplCanarySmoke, [
  "opl web",
  "session runtime",
  "--acp",
  "/api/opl/system",
  "/api/opl/messages",
  "/api/opl/sessions",
  "capability_not_supported_until_mapping_exists",
  "adapter_acp_bootstrap_must_succeed",
  "adapter_acp_session_bind_must_succeed",
  ".runtime",
], "real_opl_canary_smoke");

assertIncludesAll(contents.realOplWebuiCanarySmoke, [
  "v22_real_opl_webui_canary",
  "OPL_WEBUI_AUTH_MODE",
  "real_webui_root_must_load",
  "/api/auth/status",
  "/api/auth/user",
  "/api/opl/system",
  "/api/opl/sessions",
  "/api/opl/messages",
  "catch_all_placeholder_not_product_api",
  "create-conversation",
  "database.get-user-conversations",
  "database.get-conversation-messages",
  "chat.send.message",
  "capability_not_supported",
  "launchScriptInjected",
  "forbiddenSecretQueryStatus",
  ".runtime",
], "real_opl_webui_canary_smoke");

assertIncludesAll(contents.realOplWebuiAdapterSmoke, [
  "v22_real_opl_webui_adapter_flow",
  "OPL_RUNTIME_MODE",
  "OPL_WEBUI_BRIDGE_URL",
  "/portal-adapter/api/opl/bootstrap",
  "/portal-adapter/api/opl/sessions/bind",
  "/portal-adapter/api/opl/messages",
  "/portal-adapter/api/opl/runs",
  "real_webui_adapter_launch",
  "real_webui_websocket_session_create",
  "real_webui_database_session_roundtrip",
  "http_product_api_classified_not_supported",
  "message_reply_not_faked",
  "capability_not_supported",
  "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED",
  "opl_webui_bridge_session_created",
  ".runtime",
], "real_opl_webui_adapter_smoke");

assertIncludesAll(contents.webuiBridgeClient, [
  "OplWebuiCapabilityError",
  "hasOplWebuiBridge",
  "getWebuiBootstrap",
  "bindWebuiWorkspace",
  "createWebuiSession",
  "sendWebuiMessage",
  "create-conversation",
  "database.get-user-conversations",
  "database.get-conversation-messages",
  "chat.send.message",
  "catch_all_placeholder_not_product_api",
  "capability_not_supported",
], "real_opl_webui_bridge_client");

assertIncludesAll(contents.stateStoreSmoke, [
  "state_store_must_export_transactional_update_state",
  "state_store_must_preserve_concurrent_message_backflow",
  "state_store_must_preserve_concurrent_file_backflow",
], "state_store_atomic_flow_smoke");

assertIncludesAll(contents.runtime, [
  "httpOnly cookie 或服务端 launch session",
  "不得通过 URL query 传递",
], "runtime_bridge_token_transport_alignment");

assertIncludesAll([
  contents.mvp,
  contents.entry,
  contents.upstream,
  contents.runtime,
  contents.oplWork,
  contents.portalFiles,
  contents.statusMatrix,
].join("\n"), [
  "workspace context is bound",
  "session 必须绑定 `tenantId`、`portalUserId`、`workspaceId`、`workspaceSessionId`、`runtimeSessionId` 和 `resourceBindingId`",
  "平台创建 OPL session contract，绑定 workspace、tenant、user、`resourceBinding` 和 `providerKeyRef`",
  "Portal canonical state 必须能输出",
  "两条路径最终进入同一套 Gateway / preflight / launch 逻辑",
  "该逻辑必须保持 MedOPL 的 tenant、workspace、runtime availability、resource binding 和 token provider boundary",
], "existing_contract_alignment");

assertIncludesAll(contents.statusMatrix, [
  "2026-05-10 主仓 canary 确认 `opl web` retired",
  "主仓未暴露 `/api/opl/system`、`/api/opl/messages`、`/api/opl/sessions` HTTP Product API",
  "独立 WebUI 页面、auth context、Gateway proxy、WebSocket session bridge 和 Adapter session bridge 可接通",
  "当前可验证公开边界是 `opl session runtime --acp` 和独立 WebUI WebSocket bridge session 创建/DB 回读",
  "未验证或不兼容能力必须显式 `capability_not_supported`",
  "不能把 run/artifact 伪成功",
], "status_matrix_real_opl_canary_alignment");

assertExcludesAll(contents.connection, [
  "用户直接访问 upstream 作为 v22 产品入口",
  "launch_token=",
  "runtime_token=",
  "localStorage.setItem",
  "sessionStorage.setItem",
  "允许修改 one-person-lab upstream",
  "需要修改 one-person-lab upstream",
], "connection_forbidden_narrative");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_opl_connection_boundary",
  checkedFiles: Object.values(files),
}, null, 2));
