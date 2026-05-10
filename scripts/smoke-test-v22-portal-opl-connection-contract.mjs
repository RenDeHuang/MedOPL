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
  "POST /portal-adapter/api/opl/files",
  "POST /portal-adapter/api/opl/runs",
  "GET /portal-adapter/api/opl/runs/{runId}/status",
  "GET /portal-adapter/api/opl/artifacts/{artifactRef}",
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
  "Portal 点击“进入 OPL 工作台”后打开 clean upstream OPL",
  "bootstrap 不含 raw key、token 或内部存储路径",
  "OPL session 绑定到 `portalUserId`、`tenantId`、`workspaceId`、`runtimeSessionId` 和 `resourceBindingId`",
  "start run 后平台生成 `runId`",
  "输出文件只以 `artifactRef` 或 `outputFileRef` 回到 Portal",
  "Portal 能按 workspace、session 和 run 看到任务、文件、trace 和账单状态",
], "connection_acceptance");

assertIncludesAll(contents.readme, [
  "v22-portal-opl-connection-boundary.md",
  "Portal-OPL connection",
], "readme_connection_subscription");

assertIncludesAll(contents.suite, [
  "smoke-test-v22-portal-opl-connection-contract",
], "mvp_suite_includes_connection_contract");

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
