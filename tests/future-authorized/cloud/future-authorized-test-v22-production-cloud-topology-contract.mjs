import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { TEST_LANE_SUITES } from "../../../scripts/v22-test-classification.mjs";

const contractPath = "docs/specs/README.md";
const readmePath = "docs/specs/README.md";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs";

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const [contract, readme, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(readmePath, "utf8"),
  Promise.resolve(""),
]);

assertIncludesAll(contract, [
  "v22 Production Cloud Topology Boundary",
  "production cloud topology contract",
  "当前只是合同",
  "不代表已部署",
  "不代表已接入",
  "不代表已验证",
], "production_cloud_topology_scope");

assertIncludesAll(contract, [
  "CLB",
  "portal/opl/gateway 入口",
  "TKE",
  "Portal/Gateway/Runtime/worker 承载层",
  "CBS",
  "TKE 节点盘/必要持久卷",
  "不作为普通用户文件空间主叙事",
  "NAT",
  "TKE 私网出公网、拉镜像、访问模型/API/云 API",
  "Redis",
  "session/queue/lock/cache",
  "PostgreSQL",
  "Portal canonical store、账本、资源绑定、审计、文件索引",
], "production_cloud_topology_resource_roles");

assertIncludesAll(contract, [
  "普通用户产品语言不展示",
  "CLB/TKE/CBS/NAT/Redis/PostgreSQL",
  "工作台资源",
  "托管运行环境",
  "文件空间",
  "预计费用",
  "释放策略",
  "审计状态",
], "production_cloud_topology_user_language");

assertIncludesAll(contract, [
  "region",
  "VPC",
  "subnet",
  "security group",
  "resource tag",
  "cost allocation",
  "readonly inventory",
  "deploy plan",
], "production_cloud_topology_future_inventory_deploy_plan");

assertIncludesAll(contract, [
  "不改 deploy",
  "不 kubectl",
  "不 build/push",
  "不调用真实云",
  "不读取 secret",
  "不创建/删除资源",
], "production_cloud_topology_non_goals");

assertIncludesAll(contract, [
  "\"contractOnly\": true",
  "\"deployed\": false",
  "\"connected\": false",
  "\"verified\": false",
  "\"callsRealCloud\": false",
  "\"readsSecret\": false",
  "\"createsOrDeletesResources\": false",
  "\"changesDeploy\": false",
  "\"usesKubectl\": false",
  "\"runsBuildPush\": false",
], "production_cloud_topology_contract_data");

assertNotIncludesAny(contract, [
  "\"contractOnly\": false",
  "\"deployed\": true",
  "\"connected\": true",
  "\"verified\": true",
  "\"callsRealCloud\": true",
  "\"readsSecret\": true",
  "\"createsOrDeletesResources\": true",
], "production_cloud_topology_forbidden_contract_data");

assertIncludesAll(readme, [
  "spec:v22-production-cloud-topology-boundary",
  "production cloud topology",
  "CLB / TKE / CBS / NAT / Redis / PostgreSQL",
  "当前只是合同",
], "contracts_readme_production_cloud_topology");

assert.equal(suite, "", "production_topology_must_not_read_legacy_suite_source");
assert(TEST_LANE_SUITES["cloud-future-authorized"].includes(selfFile), "future_authorized_suite_must_include_production_cloud_topology_contract");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_cloud_topology_boundary",
  checked: [
    "contract_only_not_deployed_connected_or_verified",
    "resource_roles_for_clb_tke_cbs_nat_redis_postgresql",
    "user_product_language_hides_cloud_control_plane_terms",
    "future_readonly_inventory_and_deploy_plan_dimensions",
    "no_real_cloud_secret_deploy_kubectl_build_push_or_resource_mutation",
  ],
}, null, 2));
