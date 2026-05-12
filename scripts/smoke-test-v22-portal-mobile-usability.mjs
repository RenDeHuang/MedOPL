import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

async function source(path) {
  return readFile(path, "utf8");
}

function assertIncludes(sourceText, expected, label) {
  assert(sourceText.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(sourceText, forbidden, label) {
  assert.equal(sourceText.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const layoutSource = await source("services/portal/frontend/src/layouts/AppLayout.vue");
const headerSource = await source("services/portal/frontend/src/layouts/AppHeader.vue");
const sidebarSource = await source("services/portal/frontend/src/layouts/AppSidebar.vue");
const styleSource = await source("services/portal/frontend/src/style.css");
const workspaceSource = await source("services/portal/frontend/src/views/workspace/WorkspaceView.vue");
const traceSource = await source("services/portal/frontend/src/views/trace/TraceView.vue");
const billingSource = await source("services/portal/frontend/src/views/billing/BillingView.vue");
async function componentSources(dir) {
  const entries = await readdir(dir);
  const sources = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".vue"))
      .map((entry) => source(`${dir}/${entry}`)),
  );
  return sources.join("\n");
}
const workspaceVueSurfaceSource = `${workspaceSource}\n${await componentSources("services/portal/frontend/src/components/workspace")}`;
const traceVueSurfaceSource = `${traceSource}\n${await componentSources("services/portal/frontend/src/components/trace")}`;
const billingVueSurfaceSource = `${billingSource}\n${await componentSources("services/portal/frontend/src/components/billing")}`;
const workspaceComposableSource = await source("services/portal/frontend/src/composables/useWorkspaceSurface.ts");
const billingComposableSource = await source("services/portal/frontend/src/composables/useBillingSurface.ts");

assertIncludes(layoutSource, "mobileNavOpen", "layout_must_own_mobile_nav_state");
assertIncludes(headerSource, "打开导航", "header_must_expose_mobile_menu_button");
assertIncludes(headerSource, "defineEmits", "header_must_emit_mobile_menu_toggle");
assertIncludes(headerSource, "truncate", "header_title_must_protect_mobile_readability");
assertIncludes(headerSource, "shrink-0", "header_actions_must_not_crush_title");
assertIncludes(sidebarSource, "mobileOpen", "sidebar_must_accept_mobile_open_state");
assertIncludes(sidebarSource, "关闭导航", "sidebar_must_expose_close_action");
assertIncludes(sidebarSource, "@click=\"closeMobileNav\"", "sidebar_links_must_close_mobile_drawer");
assertIncludes(sidebarSource, "lg:hidden", "sidebar_must_have_mobile_drawer_surface");

assertIncludes(styleSource, "mobile-card-list", "style_must_define_mobile_card_list");
assertIncludes(styleSource, "mobile-only-card", "style_must_define_mobile_only_cards");
assertIncludes(styleSource, "desktop-table-shell", "style_must_define_desktop_table_shell");
assertIncludes(styleSource, "danger-action-group", "style_must_define_danger_action_group");

assertIncludes(workspaceVueSurfaceSource, "mobile-card-list", "workspace_must_render_mobile_task_cards");
assertIncludes(workspaceVueSurfaceSource, "desktop-table-shell", "workspace_table_must_be_desktop_only");
assertIncludes(workspaceVueSurfaceSource, "danger-action-group", "workspace_must_group_danger_file_actions");
assertIncludes(workspaceVueSurfaceSource, "需二次确认", "workspace_danger_actions_must_label_confirmation");
assertIncludes(workspaceComposableSource, "ordinaryDeleteRequiresConfirmation", "workspace_must_keep_delete_policy_copy");
assertIncludes(workspaceComposableSource, "fileSpaceRetentionDays", "workspace_must_use_one_retention_copy_source");
assertExcludes(workspaceVueSurfaceSource, "普通删除后进入 {{ ordinaryDeleteRequiresConfirmation ? 0", "workspace_must_not_show_conflicting_retention_days");

assertIncludes(traceVueSurfaceSource, "mobile-card-list", "trace_must_render_mobile_session_cards");
assertIncludes(traceVueSurfaceSource, "desktop-table-shell", "trace_table_must_be_desktop_only");
assertIncludes(traceVueSurfaceSource, "运行轨迹信息", "trace_copy_must_use_user_language");
assertExcludes(traceVueSurfaceSource, "技术 trace 信息", "trace_copy_must_not_use_technical_trace_copy");
assertExcludes(traceVueSurfaceSource, "密钥字段", "trace_copy_must_not_show_secret_term");

assertIncludes(billingComposableSource, "function microMoney", "billing_must_keep_money_formatter");
assertIncludes(billingComposableSource, "toFixed(2)", "billing_amounts_must_use_two_decimals");
assertExcludes(billingComposableSource, "toFixed(5)", "billing_amounts_must_not_use_five_decimals");

for (const [label, sourceText] of [
  ["workspace", workspaceVueSurfaceSource],
  ["trace", traceVueSurfaceSource],
  ["billing", billingVueSurfaceSource],
]) {
  assertExcludes(sourceText, ">active<", `${label}_must_not_show_raw_active_text`);
  assertExcludes(sourceText, "{{ item.status || 'active' }}", `${label}_must_not_show_raw_active_fallback`);
  assertExcludes(sourceText, "{{ item.status || \"active\" }}", `${label}_must_not_show_raw_active_fallback`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_mobile_usability",
  covered: [
    "mobile_nav_drawer",
    "header_title_readability",
    "workspace_trace_mobile_cards",
    "billing_two_decimal_money",
    "trace_user_language",
    "file_space_danger_action_group",
  ],
}, null, 2));
