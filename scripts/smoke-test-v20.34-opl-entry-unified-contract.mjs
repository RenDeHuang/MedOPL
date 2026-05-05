import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlInjection = await readFile("services/opl-web-gateway/src/html-injection.mjs", "utf8");
const launchClient = await readFile("services/opl-web-gateway/src/launch-client-script.mjs", "utf8");
const oplRoutes = await readFile("services/portal/src/routes/opl.routes.mjs", "utf8");
const launchService = await readFile("services/portal/src/services/opl-launch.service.mjs", "utf8");
const authHandler = await readFile("services/portal/src/app/portal-auth-runtime-handler.mjs", "utf8");

assert.match(htmlInjection, /返回 Portal|Portal 统一入口/, "direct_opl_entry_must_send_users_to_portal_entry");
assert.doesNotMatch(htmlInjection, /在当前登录框输入 Portal 邮箱、密码和 gflabtoken API key/, "direct_opl_entry_must_not_teach_api_key_login");

assert.match(launchClient, /providerConfiguredFromBootstrap/, "launch_client_must_use_bootstrap_provider_state");
assert.match(launchClient, /OPL 连接凭证|已连接|未连接/, "launch_client_provider_copy_must_be_connection_state");
assert.doesNotMatch(launchClient, /请输入来源于 gflabtoken\.cn 的 API key 后进入 OPL。/, "portal_launch_must_not_expose_provider_jargon_as_main_copy");
assert.doesNotMatch(launchClient, /data-opl-provider-key|PROVIDER_KEY_SESSION_KEY|installNativeLoginFetchBridge|appendProviderKeyToLoginRequest/, "opl_web_gateway_must_not_collect_provider_key_in_browser");
assert.doesNotMatch(launchClient, /apiKey: providerKey|providerApiKey|experimentalBearerToken/, "opl_web_gateway_must_not_bridge_provider_key_from_browser");
assert.match(launchClient, /provider_connection_required|Portal 统一入口/, "opl_web_gateway_must_block_missing_provider_with_portal_entry_state");

assert.match(oplRoutes, /sourceSurface: launchSourceSurface\(providerKeyPayload\)/, "portal_opl_route_must_use_single_launch_service");
assert.match(authHandler, /oplLaunchService\.prepareLaunch/, "direct_login_must_reuse_portal_launch_service");
assert.match(launchService, /provider_key_bound/, "launch_service_must_report_provider_connection_stage");
assert.match(launchService, /userVisibleState: "正在绑定 OPL 访问凭证"/, "launch_status_must_use_user_visible_provider_copy");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.34_opl_entry_unified_contract",
}, null, 2));
