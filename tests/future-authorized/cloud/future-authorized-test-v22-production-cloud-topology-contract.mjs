import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PRODUCTION_LAUNCH_BOOTSTRAP_COMMAND,
  buildProductionLaunchBootstrapContract,
  runProductionLaunchBootstrapContract,
} from "../../support/cloud-prework/production-launch-bootstrap-runner.js";

const contractPath = "docs/specs/README.md";
const manifestPath = "tests/fixtures/v22/agent-verify-manifest.json";
const readmePath = "docs/specs/README.md";
const selfFile = "tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs";

function commandFiles(commands = []) {
  return commands
    .map((command) => String(command).match(/^node\s+(tests\/.+\.mjs)(?:\s|$)/u)?.[1] || "")
    .filter(Boolean)
    .sort();
}

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

function assertNoSensitiveText(text = "", label = "text") {
  for (const forbidden of [
    "gflabtoken-raw-provider-key-material-that-must-not-leak",
    "postgres-password-that-must-not-leak",
    "portal-admin-password-that-must-not-leak",
    "bearer-token-that-must-not-leak",
    "rawProviderKey",
    "\"rawProviderKey\":",
    "\"providerApiKey\":",
    "\"providerSecret\":",
    "PORTAL_POSTGRES_PASSWORD",
    "PORTAL_ADMIN_PASSWORD",
    "DATABASE_URL",
    "launchToken",
    "runtimeToken",
    "bearerToken",
    "localStorage.setItem",
    "sessionStorage.setItem",
    "kubectl",
    "docker build",
    "docker push",
    "CreateNodePool",
    "medopl-tenant-",
    "\"kind\":\"Ingress\"",
    "\"type\":\"LoadBalancer\"",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const [contract, manifest, readme, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(readmePath, "utf8"),
  Promise.resolve(""),
]);
const futureAuthorizedFiles = commandFiles(manifest.suites.find((entry) => entry.id === "cloud-future-authorized")?.commands || []);

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
  "COS",
  "workspace file space object storage",
  "文件空间事实源",
  "CBS",
  "TKE 节点盘/必要持久卷",
  "不作为普通用户文件空间主叙事",
  "NAT",
  "TKE 私网出公网、拉镜像、访问模型/API/云 API",
  "PostgreSQL",
  "Portal canonical store、账本、资源绑定、审计、文件索引",
  "platform service node pool",
  "tenant node pool",
], "production_cloud_topology_resource_roles");

assertIncludesAll(contract, [
  "普通用户产品语言不展示",
  "CLB/TKE/COS/CBS/NAT/PostgreSQL",
  "工作台资源",
  "托管运行环境",
  "文件空间",
  "预计费用",
  "释放策略",
  "审计状态",
], "production_cloud_topology_user_language");

assertIncludesAll(contract, [
  "Namespace",
  "RBAC",
  "ResourceQuota",
  "LimitRange",
  "NetworkPolicy",
  "Pod Security",
  "taint",
  "label",
  "nodeSelector",
  "toleration",
  "tenant node pool",
  "用户 workload 不得调度到 platform service node pool",
  "平台服务不得调度到 tenant node pool",
], "production_cloud_topology_kubernetes_multitenancy_controls");

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
  "\"tenantNodePoolRequiredPerWorkspace\": true",
  "\"sharedUserComputePoolSupported\": false",
], "production_cloud_topology_contract_data");

assertNotIncludesAny(contract, [
  "\"contractOnly\": false",
  "\"deployed\": true",
  "\"connected\": true",
  "\"verified\": true",
  "\"callsRealCloud\": true",
  "\"readsSecret\": true",
  "\"createsOrDeletesResources\": true",
  "\"sharedUserComputePoolSupported\": true",
], "production_cloud_topology_forbidden_contract_data");

assertIncludesAll(readme, [
  "spec:v22-production-cloud-topology-boundary",
  "production cloud topology",
  "CLB / TKE / COS / CBS / NAT / PostgreSQL",
  "当前只是合同",
], "contracts_readme_production_cloud_topology");

assertNotIncludesAny(contract, [
  "| Redis |",
  "Redis instance summary",
  "CLB/TKE/CBS/NAT/Redis/PostgreSQL",
  "CLB / TKE / CBS / NAT / Redis / PostgreSQL",
  "\"Redis\":",
  "\"shared user compute pool\":",
  "\"dedicated user compute pool\":",
  "shared_quota",
  "默认资源模型是共享用户计算池",
  "普通 CPU 任务可以共享通用 node pool class",
  "标准套餐使用共享用户计算池",
  "标准套餐不是一用户一个 node pool",
  "标准套餐不得解释成“一用户一个节点池”",
], "production_cloud_topology_must_not_require_redis");

assert.equal(suite, "", "production_topology_must_not_read_legacy_suite_source");
assert(futureAuthorizedFiles.includes(selfFile), "future_authorized_suite_must_include_production_cloud_topology_contract");

const bootstrapEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-production-launch-bootstrap-"));
try {
  const evidenceDir = path.join(bootstrapEvidenceRoot, "evidence");
  const runId = "plb-20260617-001";
  const rawProviderKey = "gflabtoken-raw-provider-key-material-that-must-not-leak";
  const dbPassword = "postgres-password-that-must-not-leak";
  const adminPassword = "portal-admin-password-that-must-not-leak";
  const bearerToken = "bearer-token-that-must-not-leak";

  assert.equal(
    PRODUCTION_LAUNCH_BOOTSTRAP_COMMAND,
    "node tests/support/cloud-prework/production-launch-bootstrap-runner.js --mode contract-local-gate --run-id <runid> --authorized 1",
    "runner_must_publish_single_repo_native_command",
  );

  await assert.rejects(
    () => buildProductionLaunchBootstrapContract({
      runId,
      evidenceDir,
      authorized: false,
    }),
    /production_launch_bootstrap_not_authorized/,
    "missing_authorization_must_fail_closed",
  );

  await assert.rejects(
    () => buildProductionLaunchBootstrapContract({
      runId: "",
      evidenceDir,
      authorized: true,
    }),
    /production_launch_bootstrap_run_id_required/,
    "missing_run_id_must_fail_closed",
  );

  const plan = await buildProductionLaunchBootstrapContract({
    runId,
    evidenceDir,
    authorized: true,
    seed: {
      firstAdmin: {
        email: "founder@example.invalid",
        displayName: "MedOPL Founder",
        role: "platform_owner",
        password: adminPassword,
        ["token"]: bearerToken,
      },
      tenant: {
        id: "tenant-production-seed",
        slug: "research-team-alpha",
        name: "Research Team Alpha",
        planId: "starter_2c4g_10gb",
      },
      workspace: {
        id: "workspace-production-seed",
        slug: "alpha-opl-workbench",
        title: "Alpha OPL Workbench",
        storageGb: 10,
        packageId: "starter_2c4g_10gb",
      },
      provider: {
        provider: "gflabtoken",
        providerKeyRef: "gflab:workspace-production-seed:refonly001122",
        rawProviderKey,
      },
      runtime: {
        dbPassword,
      },
    },
  });

  assert.equal(plan.ok, true, "bootstrap_plan_ok");
  assert.equal(plan.contract, "production_launch_gap_01_bootstrap_contract_local_gate", "bootstrap_contract_name");
  assert.equal(plan.mode, "contract-local-gate", "bootstrap_mode");
  assert.equal(plan.boundary.contractOnly, true, "bootstrap_contract_only_boundary");
  assert.equal(plan.boundary.localDevDefaultsAllowedInProduction, false, "local_defaults_not_production");
  assert.equal(plan.boundary.externalAccessBlocked, true, "external_access_must_remain_blocked");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "kubernetes_access_forbidden");
  assert.equal(plan.boundary.deployAllowed, false, "deploy_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "package_c_live_forbidden");
  assert.deepEqual(plan.productionVsLocalDefaults.localFallbackIds, [
    "tenant-local-rc",
    "user-local-rc",
    "workspace-local-rc",
  ], "local_defaults_must_be_named_as_non_production");
  assert.equal(plan.productionVsLocalDefaults.productionRequiresExplicitBootstrap, true, "production_requires_explicit_bootstrap");
  assert.deepEqual(Object.keys(plan.bootstrap.firstAdmin).sort(), [
    "displayName",
    "email",
    "identitySource",
    "role",
    "status",
  ], "first_admin_public_shape");
  assert.equal(plan.bootstrap.firstAdmin.role, "platform_owner", "first_admin_role");
  assert.equal(plan.bootstrap.firstAdmin.status, "bootstrap_required", "first_admin_status");
  assert.deepEqual(Object.keys(plan.bootstrap.tenant).sort(), [
    "id",
    "name",
    "planId",
    "slug",
    "status",
  ], "tenant_public_shape");
  assert.equal(plan.bootstrap.tenant.status, "bootstrap_required", "tenant_status");
  assert.deepEqual(Object.keys(plan.bootstrap.workspace).sort(), [
    "id",
    "packageId",
    "providerKeyRef",
    "slug",
    "status",
    "storageGb",
    "title",
  ], "workspace_public_shape");
  assert.equal(plan.bootstrap.workspace.providerKeyRef, "gflab:workspace-production-seed:refonly001122", "workspace_must_only_reference_provider_key_ref");
  assert.deepEqual(plan.providerBoundary.publicFields, ["provider", "providerKeyRef", "boundStatus"], "provider_public_fields");
  assert.equal(plan.providerBoundary.rawSecretAcceptedByRunner, false, "runner_must_not_accept_raw_provider_key");
  assert.equal(plan.providerBoundary.rawSecretBackendOnly, true, "raw_key_backend_only");
  assert.deepEqual(plan.portalToBackendApiTrace.map((entry) => entry.methodPath), [
    "POST /api/v22/production/bootstrap/plan",
    "POST /api/v22/production/bootstrap/commit",
  ], "portal_backend_bootstrap_api_trace");
  assert.equal(plan.portalToBackendApiTrace.every((entry) => entry.status === "contract-only"), true, "api_trace_contract_only");
  assert.equal(plan.externalAccess.status, "blocked_until_multi_tenant_minimum_launch_closure", "external_access_status");
  assertNoSensitiveText(JSON.stringify(plan), "bootstrap_plan");

  const summary = await runProductionLaunchBootstrapContract({
    runId,
    evidenceDir,
    authorized: true,
  });
  assert.equal(summary.ok, true, "bootstrap_summary_ok");
  assert.equal(summary.evidencePath.endsWith(`${runId}/bootstrap-contract-redacted.json`), true, "bootstrap_evidence_path");
  assert.equal(summary.realExecutionReady, false, "real_execution_ready_must_remain_false");
  assertNoSensitiveText(JSON.stringify(summary), "bootstrap_summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "bootstrap_evidence_ok");
  assert.equal(evidence.redactionAudit.rawSecretMaterialExposed, false, "evidence_hides_raw_provider_key");
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "evidence_hides_db_password");
  assert.equal(evidence.redactionAudit.portalAdminPasswordExposed, false, "evidence_hides_admin_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "evidence_hides_token");
  assert.equal(evidence.redactionAudit.browserStorageSecretWritePresent, false, "evidence_blocks_browser_storage_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-02-portal-backend-package-c-live-operation-contract", "next_gap_after_gap_01");
  assertNoSensitiveText(JSON.stringify(evidence), "bootstrap_evidence");

  for (const forbiddenArg of [
    "--kubeconfig",
    "--kubectl",
    "--deploy",
    "--rollout",
    "--rollback",
    "--build",
    "--push",
    "--tencent-mutation",
    "--package-c-live",
    "--ingress",
    "--load-balancer",
  ]) {
    await assert.rejects(
      () => buildProductionLaunchBootstrapContract({
        runId,
        evidenceDir,
        authorized: true,
        argv: [forbiddenArg, "1"],
      }),
      /production_launch_bootstrap_forbidden_arg/,
      `runner_must_reject:${forbiddenArg}`,
    );
  }
} finally {
  await rm(bootstrapEvidenceRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_cloud_topology_boundary",
  checked: [
    "contract_only_not_deployed_connected_or_verified",
    "resource_roles_for_clb_tke_cos_cbs_nat_postgresql",
    "kubernetes_multitenancy_controls_for_tenant_node_pools",
    "user_product_language_hides_cloud_control_plane_terms",
    "future_readonly_inventory_and_deploy_plan_dimensions",
    "no_real_cloud_secret_deploy_kubectl_build_push_or_resource_mutation",
    "production_launch_gap_01_bootstrap_contract_local_gate",
  ],
}, null, 2));
