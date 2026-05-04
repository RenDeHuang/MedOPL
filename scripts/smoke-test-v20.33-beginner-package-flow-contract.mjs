import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packagesView = await readFile("services/portal/frontend/src/views/packages/PackagesView.vue", "utf8");
const resourcesView = await readFile("services/portal/frontend/src/views/resources/ResourcesView.vue", "utf8");
const api = await readFile("services/portal/frontend/src/api/portal.ts", "utf8");
const publicRoutes = await readFile("services/portal/src/routes/resource-order-public.routes.mjs", "utf8");
const routeSupport = await readFile("services/portal/src/routes/resource-order-route-support.mjs", "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(packagesView, /CPU 2C4G \+ 10GB 存储 \+ OPL 实验室/, "packages_must_highlight_single_beginner_offer");
mustMatch(packagesView, /\brecommendedPackage\b/, "packages_must_select_one_recommended_package");
mustMatch(packagesView, /开通推荐套餐/, "packages_must_have_one_primary_beginner_action");
mustMatch(packagesView, /费用说明/, "packages_must_show_cost_explanation_before_create");
mustMatch(packagesView, /预扣金额/, "packages_must_show_preauth_amount_before_create");
mustMatch(packagesView, /删除停费/, "packages_must_show_delete_stop_billing_before_create");
mustMatch(packagesView, /\bactivateRecommendedPackage\b[\s\S]*\bactivateLabPackage\b[\s\S]*\bquoteResourceOrder\b[\s\S]*\bfreezeResourceOrder\b[\s\S]*\bprovisionResourceOrder\b/, "recommended_action_must_open_package_and_resource_order_loop");
mustNotMatch(packagesView, /v-for="item in visiblePackageItems"[\s\S]*btn btn-primary/, "packages_must_not_render_multiple_primary_package_buttons");
mustMatch(packagesView, /自定义套餐[\s\S]*btn btn-secondary/, "custom_package_must_remain_secondary");

mustMatch(resourcesView, /订单/, "resources_must_show_order");
mustMatch(resourcesView, /计算资源/, "resources_must_show_compute_resource_state");
mustMatch(resourcesView, /云主机数量/, "resources_must_show_cloud_host_count");
mustMatch(resourcesView, /存储/, "resources_must_show_storage_state");
mustMatch(resourcesView, /账单标签/, "resources_must_show_billing_tags");
mustMatch(resourcesView, /删除停费状态/, "resources_must_show_delete_billing_stop_state");
mustMatch(resourcesView, /\bdeleteResourceOrderNodePool\b[\s\S]*resourceOrderId[\s\S]*confirmDeleteNodePool[\s\S]*destroyCvmInstances/, "resources_delete_action_must_submit_order_id_and_confirmations");
mustNotMatch(resourcesView, /nodePoolId|节点池|CVM ID|TKE|CVM/, "resources_view_must_not_expose_internal_infra_terms");
mustNotMatch(resourcesView, /<input[\s\S]*(nodePool|cvm|instance|cloudResource)/i, "resources_delete_must_not_ask_for_cloud_resource_ids");

mustMatch(api, /deleteResourceOrderNodePool\(input: \{\s*resourceOrderId: string;\s*destroyCvmInstances: boolean;\s*confirmDeleteNodePool: boolean;\s*\}\)/, "api_delete_resource_order_must_only_accept_order_id_and_confirmations");
mustMatch(publicRoutes, /validateDeleteNodePoolPayload\(payload\)/, "delete_route_must_validate_no_client_cloud_resource_ids");
mustMatch(routeSupport, /delete_node_pool_client_resource_ids_forbidden/, "delete_payload_validator_must_reject_cloud_resource_ids");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_beginner_package_flow",
}, null, 2));
