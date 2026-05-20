import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const files = {
  saas: "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
  entry: "docs/contracts/v22-opl-entry-preflight-auth-boundary.md",
  upstream: "docs/contracts/v22-upstream-opl-boundary.md",
  readme: "docs/contracts/README.md",
  activeTruth: "docs/active/README.md",
  statusMatrix: "docs/recovery/status-matrix.md",
  suite: "tests/contract/smoke-test-v22-mvp-contract-suite.mjs",
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
const contractCorpus = [
  contents.saas,
  contents.entry,
  contents.upstream,
  contents.readme,
].join("\n");
const recoveryCorpus = [
  contents.activeTruth,
  contents.statusMatrix,
].join("\n");
const fullCorpus = `${contractCorpus}\n${recoveryCorpus}`;

assertIncludesAll(contractCorpus, [
  "路径 1：从 Portal SaaS 后台进入",
  "portal.medopl.cn -> Portal 工作空间 / 托管运行环境 / “进入 OPL 工作台”按钮 -> Gateway launch / preflight -> clean upstream one-person-lab Web",
  "路径 2：直接访问 OPL 工作台",
  "opl.medopl.cn -> OPL Gateway entry -> MedOPL 账号/密码/gflabtoken API Key preflight -> clean upstream one-person-lab Web",
  "两条路径最终进入同一套 Gateway / preflight / launch 逻辑",
  "Portal 普通登录页不需要 API Key",
  "API Key 只出现在 opl.medopl.cn entry/preflight 的密码下面",
  "从 Portal 进入时可复用 Portal session / workspace / launch context",
  "从 OPL 直接进入时需要 MedOPL 账号/密码/gflabtoken API Key，已绑定可显示“已绑定”",
  "用户可见入口不是 /internal/opl/auth/login",
  "/internal/opl/auth/login 只能是 internal implementation path",
  "用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight",
], "dual_entry_contract");

assertIncludesAll(contractCorpus, [
  "launchToken/runtimeToken 不进 URL query",
  "launchToken/runtimeToken 不进 localStorage/sessionStorage",
  "raw API Key 只进入后端密钥边界",
  "Gateway 不写 raw API Key 到 localStorage/sessionStorage",
  "Gateway 不 import one-person-lab 内部模块",
  "OPL Gateway 通过 `OPL_UPSTREAM_URL` 显式配置 clean upstream one-person-lab Web",
  "未配置 `OPL_UPSTREAM_URL` 时，Gateway 返回稳定错误 `opl_upstream_url_required`",
  "launchToken/runtimeToken/apiKey 不得通过 URL query 传递；Gateway 必须拒绝这类 query",
], "token_secret_boundary");

assertIncludesAll(contents.upstream, [
  "upstream 目录只读/clean",
  "不写 MedOPL 代码进 upstream",
  "不 import upstream 内部模块",
  "不把 Portal 账号、计费、资源、gflabtoken、trace、Langfuse、腾讯云逻辑写进 upstream",
  "只能通过 OPL Web Gateway、Runtime Bridge / Runtime Agent、公开 API/CLI 或反向代理边界接入",
  "Portal / Gateway / Runtime Bridge / Runtime Agent / Langfuse / 腾讯云逻辑不得写进 upstream",
  "不硬编码 v19/v20/v21 upstream 路径，不使用旧 direct upstream path 作为默认值",
  "注入/暴露给 upstream 的公开上下文只包含 `workspaceId`、`sessionId`/`launchStatus`、`providerBound`、`providerKeyRef` 和 Portal return URL",
], "upstream_pollution_boundary");

assertIncludesAll(recoveryCorpus, [
  "/internal/opl/auth/login 只能作为 internal implementation path",
  "用户可见入口必须是 Portal “进入 OPL 工作台”或 /opl/entry/preflight",
  "旧 v19/v20/v21 OPL direct path、direct upstream path、internal path 不能成为 v22 产品入口",
  "后续真实 proxy / upstream 运行接入单独 feat",
  "旧入口删除如需要另开 cleanup/*",
  "active surface 不允许修改 one-person-lab upstream",
  "one-person-lab upstream 不属于 active surface",
], "recovery_cleanup_boundary");

assertExcludesAll(fullCorpus, [
  "用户可见入口：GET /internal/opl/auth/login",
  "用户可见入口：POST /internal/opl/auth/login",
  "direct upstream path 是 v22 用户入口",
  "direct upstream path is v22 user entry",
  "用户直接访问 upstream 作为 v22 产品入口",
], "forbidden_dual_entry_narrative");

assert(
  isSmokeClassifiedIn("tests/regression/opl/smoke-test-v22-opl-dual-entry-contract.mjs"),
  "mvp_contract_suite_must_include_dual_entry_smoke",
);

assert(
  isSmokeClassifiedIn("tests/regression/opl/smoke-test-v22-opl-gateway-upstream-proxy-local.mjs"),
  "mvp_contract_suite_must_include_local_gateway_proxy_smoke",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_opl_dual_entry_contract",
  checkedFiles: Object.values(files),
}, null, 2));
