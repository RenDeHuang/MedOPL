import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  PRODUCTION_LAUNCH_BOOTSTRAP_COMMAND,
  buildProductionLaunchBootstrapContract,
  runProductionLaunchBootstrapContract,
} from "../../support/cloud-prework/production-launch-bootstrap-runner.js";
import {
  PRODUCTION_LAUNCH_OPERATION_COMMAND,
  buildProductionLaunchOperationContract,
  runProductionLaunchOperationContract,
} from "../../support/cloud-prework/production-launch-operation-runner.js";
import {
  PRODUCTION_LAUNCH_LEDGER_COMMAND,
  buildProductionLaunchLedgerContract,
  runProductionLaunchLedgerContract,
} from "../../support/cloud-prework/production-launch-ledger-runner.js";
import {
  PRODUCTION_LAUNCH_COMMERCIAL_LEDGER_COMMAND,
  buildProductionLaunchCommercialLedgerContract,
  runProductionLaunchCommercialLedgerContract,
} from "../../support/cloud-prework/production-launch-commercial-ledger-runner.js";

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
    "TENCENT_SECRET_ID",
    "TENCENT_SECRET_KEY",
    "SecretId",
    "SecretKey",
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

const operationEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-production-launch-operation-"));
try {
  const evidenceDir = path.join(operationEvidenceRoot, "evidence");
  const runId = "plo-20260617-001";
  const rawProviderKey = "gflabtoken-raw-provider-key-material-that-must-not-leak";
  const dbPassword = "postgres-password-that-must-not-leak";
  const bearerToken = "bearer-token-that-must-not-leak";
  const tencentSecretId = "TENCENT_SECRET_ID_that_must_not_leak";
  const tencentSecretKey = "TENCENT_SECRET_KEY_that_must_not_leak";

  assert.equal(
    PRODUCTION_LAUNCH_OPERATION_COMMAND,
    "node tests/support/cloud-prework/production-launch-operation-runner.js --mode contract-local-gate --run-id <runid> --authorized 1",
    "operation_runner_must_publish_single_repo_native_command",
  );

  await assert.rejects(
    () => buildProductionLaunchOperationContract({
      runId,
      evidenceDir,
      authorized: false,
    }),
    /production_launch_operation_not_authorized/,
    "operation_missing_authorization_must_fail_closed",
  );

  await assert.rejects(
    () => buildProductionLaunchOperationContract({
      runId: "",
      evidenceDir,
      authorized: true,
    }),
    /production_launch_operation_run_id_required/,
    "operation_missing_run_id_must_fail_closed",
  );

  const plan = await buildProductionLaunchOperationContract({
    runId,
    evidenceDir,
    authorized: true,
    operation: {
      tenantId: "tenant-production-alpha",
      accountId: "account-production-alpha",
      workspaceId: "workspace-production-alpha",
      resourceBindingId: "rb-production-alpha",
      billingAttributionId: "bill-production-alpha",
      serverPlanId: "starter_2c4g_10gb",
      providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
      idempotencyKey: "workspace-provision-alpha-once",
      rawProviderKey,
      runtime: {
        dbPassword,
      },
      tokens: {
        bearerToken,
      },
      tencent: {
        SecretId: tencentSecretId,
        SecretKey: tencentSecretKey,
      },
    },
  });

  assert.equal(plan.ok, true, "operation_plan_ok");
  assert.equal(plan.contract, "production_launch_gap_02_package_c_operation_contract_local_gate", "operation_contract_name");
  assert.equal(plan.mode, "contract-local-gate", "operation_mode");
  assert.equal(plan.boundary.contractOnly, true, "operation_contract_only_boundary");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "operation_package_c_live_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "operation_tencent_mutation_forbidden");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "operation_kubernetes_forbidden");
  assert.equal(plan.boundary.deployAllowed, false, "operation_deploy_forbidden");
  assert.equal(plan.boundary.externalAccessBlocked, true, "operation_external_access_blocked");
  assert.equal(plan.productionVsLocalDefaults.localDefaultsScope, "local-rc-only", "operation_local_defaults_scope");
  assert.equal(plan.productionVsLocalDefaults.productionOperationRequiresExplicitLedgerWrite, true, "operation_requires_future_ledger_write");

  assert.deepEqual(plan.portalActionTrace.map((entry) => entry.methodPath), [
    "POST /api/v22/production/package-c-operation/plan",
    "POST /api/v22/production/package-c-operation/commit",
  ], "portal_backend_operation_api_trace");
  assert.equal(plan.portalActionTrace.every((entry) => entry.status === "contract-only"), true, "operation_api_trace_contract_only");
  assert.equal(plan.goBackendOperationRequest.providerKeyRef, "gflab:workspace-production-alpha:refonly001122", "operation_provider_ref_only");
  assert.equal(plan.goBackendOperationRequest.idempotencyKey, "workspace-provision-alpha-once", "operation_idempotency_key");
  assert.deepEqual(Object.keys(plan.goBackendOperationRequest).sort(), [
    "accountId",
    "billingAttributionId",
    "idempotencyKey",
    "providerKeyRef",
    "resourceBindingId",
    "serverPlanId",
    "tenantId",
    "workspaceId",
  ], "operation_request_public_shape");
  assert.deepEqual(plan.resourceBindingStateContract.minimumStates, [
    "requested",
    "creating",
    "ready",
  ], "resource_binding_minimum_states");
  assert.equal(plan.resourceBindingStateContract.transitions[0].from, "portal_action", "resource_binding_requested_from_portal_action");
  assert.equal(plan.resourceBindingStateContract.transitions.at(-1).to, "ready", "resource_binding_ready_terminal_for_gap_02_contract");
  assert.equal(plan.packageCRunnerInvocationBoundary.runner, "tests/support/cloud-prework/v22-package-c-live-canary-live-runner.js", "operation_reuses_package_c_runner");
  assert.equal(plan.packageCRunnerInvocationBoundary.contractOnly, true, "operation_runner_contract_only");
  assert.equal(plan.packageCRunnerInvocationBoundary.liveExecutionAllowedNow, false, "operation_runner_no_live");
  assert.equal(plan.packageCRunnerInvocationBoundary.futureRunGate, "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1", "operation_future_package_c_run_gate");
  assert.deepEqual(plan.providerBoundary.publicFields, ["provider", "providerKeyRef", "boundStatus"], "operation_provider_public_fields");
  assert.equal(plan.providerBoundary.rawSecretAcceptedByRunner, false, "operation_raw_provider_key_rejected");
  assert.equal(plan.evidence.path, path.join(evidenceDir, runId, "operation-contract-redacted.json"), "operation_evidence_path");
  assert.equal(plan.externalAccess.status, "blocked_until_multi_tenant_minimum_launch_closure", "operation_external_access_status");
  assertNoSensitiveText(JSON.stringify(plan), "operation_plan");

  const summary = await runProductionLaunchOperationContract({
    runId,
    evidenceDir,
    authorized: true,
  });
  assert.equal(summary.ok, true, "operation_summary_ok");
  assert.equal(summary.evidencePath.endsWith(`${runId}/operation-contract-redacted.json`), true, "operation_summary_evidence_path");
  assert.equal(summary.realExecutionReady, false, "operation_real_execution_ready_false");
  assertNoSensitiveText(JSON.stringify(summary), "operation_summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "operation_evidence_ok");
  assert.equal(evidence.redactionAudit.rawSecretMaterialExposed, false, "operation_evidence_hides_raw_provider_key");
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "operation_evidence_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "operation_evidence_hides_token");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "operation_evidence_hides_tencent_secret");
  assert.equal(evidence.redactionAudit.browserStorageSecretWritePresent, false, "operation_evidence_blocks_browser_storage_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-03-resourcebinding-postgresql-ledger-live-write-read-contract", "next_gap_after_gap_02");
  assertNoSensitiveText(JSON.stringify(evidence), "operation_evidence");

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
    "--secret-file",
    "--env",
  ]) {
    await assert.rejects(
      () => buildProductionLaunchOperationContract({
        runId,
        evidenceDir,
        authorized: true,
        argv: [forbiddenArg, "1"],
      }),
      /production_launch_operation_forbidden_arg/,
      `operation_runner_must_reject:${forbiddenArg}`,
    );
  }
} finally {
  await rm(operationEvidenceRoot, { recursive: true, force: true });
}

const ledgerEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-production-launch-ledger-"));
try {
  const evidenceDir = path.join(ledgerEvidenceRoot, "evidence");
  const runId = "pll-20260617-001";
  const rawProviderKey = "gflabtoken-raw-provider-key-material-that-must-not-leak";
  const dbPassword = "postgres-password-that-must-not-leak";
  const bearerToken = "bearer-token-that-must-not-leak";
  const tencentSecretId = "TENCENT_SECRET_ID_that_must_not_leak";
  const tencentSecretKey = "TENCENT_SECRET_KEY_that_must_not_leak";

  assert.equal(
    PRODUCTION_LAUNCH_LEDGER_COMMAND,
    "node tests/support/cloud-prework/production-launch-ledger-runner.js --mode contract-local-gate --run-id <runid> --authorized 1",
    "ledger_runner_must_publish_single_repo_native_command",
  );

  await assert.rejects(
    () => buildProductionLaunchLedgerContract({
      runId,
      evidenceDir,
      authorized: false,
    }),
    /production_launch_ledger_not_authorized/,
    "ledger_missing_authorization_must_fail_closed",
  );

  await assert.rejects(
    () => buildProductionLaunchLedgerContract({
      runId: "",
      evidenceDir,
      authorized: true,
    }),
    /production_launch_ledger_run_id_required/,
    "ledger_missing_run_id_must_fail_closed",
  );

  const plan = await buildProductionLaunchLedgerContract({
    runId,
    evidenceDir,
    authorized: true,
    ledger: {
      tenantId: "tenant-production-alpha",
      accountId: "account-production-alpha",
      workspaceId: "workspace-production-alpha",
      resourceBindingId: "rb-production-alpha",
      billingAttributionId: "bill-production-alpha",
      serverPlanId: "starter_2c4g_10gb",
      workspaceStorageGb: 10,
      cloudProvider: "tencent",
      region: "ap-guangzhou",
      clusterId: "cls-fi097sy4",
      nodePoolId: "np-tenant-production-alpha",
      nodePoolName: "tenant-production-alpha-pool",
      providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
      idempotencyKey: "workspace-ledger-alpha-once",
      rawProviderKey,
      runtime: {
        dbPassword,
      },
      tokens: {
        bearerToken,
      },
      tencent: {
        SecretId: tencentSecretId,
        SecretKey: tencentSecretKey,
      },
    },
  });

  assert.equal(plan.ok, true, "ledger_plan_ok");
  assert.equal(plan.contract, "production_launch_gap_03_resourcebinding_postgresql_ledger_contract_local_gate", "ledger_contract_name");
  assert.equal(plan.mode, "contract-local-gate", "ledger_mode");
  assert.equal(plan.boundary.contractOnly, true, "ledger_contract_only_boundary");
  assert.equal(plan.boundary.productionPostgresConnectAllowedNow, false, "ledger_postgres_connect_forbidden");
  assert.equal(plan.boundary.productionPostgresWriteAllowedNow, false, "ledger_postgres_write_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "ledger_package_c_live_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "ledger_tencent_mutation_forbidden");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "ledger_kubernetes_forbidden");
  assert.equal(plan.boundary.deployAllowed, false, "ledger_deploy_forbidden");
  assert.equal(plan.boundary.externalAccessBlocked, true, "ledger_external_access_blocked");
  assert.equal(plan.productionVsLocalRepository.localRepositoryMode, "dry-run-memory-shape-only", "ledger_local_repository_mode");
  assert.equal(plan.productionVsLocalRepository.futureProductionRepository, "PostgreSQL resource_bindings/cloud_operations", "ledger_future_repository");
  assert.equal(plan.productionVsLocalRepository.productionRequiresExplicitPostgresAuthorization, true, "ledger_requires_future_postgres_authorization");

  assert.deepEqual(plan.portalLedgerApiTrace.map((entry) => entry.methodPath), [
    "POST /api/v22/production/ledger/plan",
    "POST /api/v22/production/ledger/commit",
  ], "portal_backend_ledger_api_trace");
  assert.equal(plan.portalLedgerApiTrace.every((entry) => entry.status === "contract-only"), true, "ledger_api_trace_contract_only");
  assert.equal(plan.providerBoundary.rawSecretAcceptedByRunner, false, "ledger_raw_provider_key_rejected");
  assert.deepEqual(plan.providerBoundary.publicFields, ["provider", "providerKeyRef", "boundStatus"], "ledger_provider_public_fields");

  assert.deepEqual(plan.statePersistenceBoundary.minimumStates, [
    "requested",
    "creating",
    "ready",
  ], "ledger_minimum_states");
  assert.equal(plan.statePersistenceBoundary.transitions[0].resourceBinding.status, "requested", "ledger_requested_state");
  assert.equal(plan.statePersistenceBoundary.transitions[1].resourceBinding.status, "creating", "ledger_creating_state");
  assert.equal(plan.statePersistenceBoundary.transitions[2].resourceBinding.status, "ready", "ledger_ready_state");
  assert.equal(plan.statePersistenceBoundary.transitions.every((entry) => entry.cloudOperation.status === entry.resourceBinding.status), true, "ledger_resource_and_operation_status_match");
  assert.equal(plan.statePersistenceBoundary.transitions.every((entry) => entry.persistedNow === false), true, "ledger_transitions_not_persisted_now");

  assert.deepEqual(plan.resourceBindingWriteReadShape.requiredWriteFields, [
    "tenant_id",
    "account_id",
    "workspace_id",
    "resource_binding_id",
    "billing_attribution_id",
    "server_plan_id",
    "workspace_storage_gb",
    "cloud_provider",
    "region",
    "cluster_id",
    "node_pool_id",
    "node_pool_name",
    "status",
    "operation_id",
    "canonical_ownership_source",
    "cloud_tag_support",
  ], "resource_binding_write_shape");
  assert.deepEqual(plan.cloudOperationWriteReadShape.requiredWriteFields, [
    "operation_id",
    "resource_binding_id",
    "tenant_id",
    "account_id",
    "workspace_id",
    "billing_attribution_id",
    "operation_type",
    "server_plan_id",
    "workspace_storage_gb",
    "status",
    "cloud_provider",
    "region",
    "cluster_id",
    "node_pool_id",
    "node_pool_name",
    "cloud_tag_support",
    "canonical_ownership_source",
  ], "cloud_operation_write_shape");
  assert.equal(plan.idempotency.operationId, "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once", "ledger_operation_id_shape");
  assert.equal(plan.idempotency.uniqueKeys.resourceBinding, "resource_binding_id", "ledger_resource_binding_unique_key");
  assert.equal(plan.idempotency.uniqueKeys.cloudOperation, "operation_id", "ledger_cloud_operation_unique_key");
  assert.equal(plan.canonicalOwnershipSource, "postgres_resource_binding_ledger", "ledger_canonical_ownership_source");
  assert.equal(plan.cloudTagSupport, "tke_nodepool_unsupported", "ledger_cloud_tag_not_truth");
  assert.equal(plan.evidence.path, path.join(evidenceDir, runId, "resourcebinding-ledger-contract-redacted.json"), "ledger_evidence_path");
  assert.equal(plan.externalAccess.status, "blocked_until_multi_tenant_minimum_launch_closure", "ledger_external_access_status");
  assertNoSensitiveText(JSON.stringify(plan), "ledger_plan");

  const summary = await runProductionLaunchLedgerContract({
    runId,
    evidenceDir,
    authorized: true,
  });
  assert.equal(summary.ok, true, "ledger_summary_ok");
  assert.equal(summary.evidencePath.endsWith(`${runId}/resourcebinding-ledger-contract-redacted.json`), true, "ledger_summary_evidence_path");
  assert.equal(summary.realExecutionReady, false, "ledger_real_execution_ready_false");
  assertNoSensitiveText(JSON.stringify(summary), "ledger_summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "ledger_evidence_ok");
  assert.equal(evidence.redactionAudit.rawSecretMaterialExposed, false, "ledger_evidence_hides_raw_provider_key");
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "ledger_evidence_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "ledger_evidence_hides_token");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "ledger_evidence_hides_tencent_secret");
  assert.equal(evidence.redactionAudit.browserStorageSecretWritePresent, false, "ledger_evidence_blocks_browser_storage_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-04-billing-audit-quota-ledger-contract", "next_gap_after_gap_03");
  assertNoSensitiveText(JSON.stringify(evidence), "ledger_evidence");

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
    "--postgres",
    "--db",
    "--ingress",
    "--load-balancer",
    "--secret-file",
    "--env",
  ]) {
    await assert.rejects(
      () => buildProductionLaunchLedgerContract({
        runId,
        evidenceDir,
        authorized: true,
        argv: [forbiddenArg, "1"],
      }),
      /production_launch_ledger_forbidden_arg/,
      `ledger_runner_must_reject:${forbiddenArg}`,
    );
  }
} finally {
  await rm(ledgerEvidenceRoot, { recursive: true, force: true });
}

const commercialLedgerEvidenceRoot = await mkdtemp(path.join(os.tmpdir(), "v22-production-launch-commercial-ledger-"));
try {
  const evidenceDir = path.join(commercialLedgerEvidenceRoot, "evidence");
  const runId = "plc-20260617-001";
  const rawProviderKey = "gflabtoken-raw-provider-key-material-that-must-not-leak";
  const dbPassword = "postgres-password-that-must-not-leak";
  const bearerToken = "bearer-token-that-must-not-leak";
  const tencentSecretId = "TENCENT_SECRET_ID_that_must_not_leak";
  const tencentSecretKey = "TENCENT_SECRET_KEY_that_must_not_leak";

  assert.equal(
    PRODUCTION_LAUNCH_COMMERCIAL_LEDGER_COMMAND,
    "node tests/support/cloud-prework/production-launch-commercial-ledger-runner.js --mode contract-local-gate --run-id <runid> --authorized 1",
    "commercial_ledger_runner_must_publish_single_repo_native_command",
  );

  await assert.rejects(
    () => buildProductionLaunchCommercialLedgerContract({
      runId,
      evidenceDir,
      authorized: false,
    }),
    /production_launch_commercial_ledger_not_authorized/,
    "commercial_ledger_missing_authorization_must_fail_closed",
  );

  await assert.rejects(
    () => buildProductionLaunchCommercialLedgerContract({
      runId: "",
      evidenceDir,
      authorized: true,
    }),
    /production_launch_commercial_ledger_run_id_required/,
    "commercial_ledger_missing_run_id_must_fail_closed",
  );

  const plan = await buildProductionLaunchCommercialLedgerContract({
    runId,
    evidenceDir,
    authorized: true,
    ledger: {
      tenantId: "tenant-production-alpha",
      accountId: "account-production-alpha",
      workspaceId: "workspace-production-alpha",
      resourceBindingId: "rb-production-alpha",
      cloudOperationId: "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once",
      billingAttributionId: "bill-production-alpha",
      serverPlanId: "starter_2c4g_10gb",
      workspaceStorageGb: 10,
      quota: {
        storageGb: 10,
        cpuCores: 2,
        memoryGb: 4,
        maxConcurrentRuns: 1,
      },
      providerKeyRef: "gflab:workspace-production-alpha:refonly001122",
      idempotencyKey: "workspace-commercial-ledger-alpha-once",
      rawProviderKey,
      runtime: {
        dbPassword,
      },
      tokens: {
        bearerToken,
      },
      tencent: {
        SecretId: tencentSecretId,
        SecretKey: tencentSecretKey,
      },
    },
  });

  assert.equal(plan.ok, true, "commercial_ledger_plan_ok");
  assert.equal(plan.contract, "production_launch_gap_04_billing_audit_quota_ledger_contract_local_gate", "commercial_ledger_contract_name");
  assert.equal(plan.mode, "contract-local-gate", "commercial_ledger_mode");
  assert.equal(plan.boundary.contractOnly, true, "commercial_ledger_contract_only_boundary");
  assert.equal(plan.boundary.productionPostgresConnectAllowedNow, false, "commercial_ledger_postgres_connect_forbidden");
  assert.equal(plan.boundary.productionPostgresWriteAllowedNow, false, "commercial_ledger_postgres_write_forbidden");
  assert.equal(plan.boundary.packageCLiveAllowed, false, "commercial_ledger_package_c_live_forbidden");
  assert.equal(plan.boundary.tencentMutationAllowed, false, "commercial_ledger_tencent_mutation_forbidden");
  assert.equal(plan.boundary.kubernetesAccessAllowed, false, "commercial_ledger_kubernetes_forbidden");
  assert.equal(plan.boundary.deployAllowed, false, "commercial_ledger_deploy_forbidden");
  assert.equal(plan.boundary.externalAccessBlocked, true, "commercial_ledger_external_access_blocked");
  assert.equal(plan.productionVsLocalRepository.localRepositoryMode, "dry-run-memory-shape-only", "commercial_ledger_local_repository_mode");
  assert.equal(plan.productionVsLocalRepository.futureProductionRepository, "PostgreSQL billing_events/audit_events/quota_ledger", "commercial_ledger_future_repository");
  assert.equal(plan.productionVsLocalRepository.productionRequiresExplicitPostgresAuthorization, true, "commercial_ledger_requires_future_postgres_authorization");

  assert.deepEqual(plan.portalCommercialLedgerApiTrace.map((entry) => entry.methodPath), [
    "POST /api/v22/production/commercial-ledger/plan",
    "POST /api/v22/production/commercial-ledger/commit",
  ], "portal_backend_commercial_ledger_api_trace");
  assert.equal(plan.portalCommercialLedgerApiTrace.every((entry) => entry.status === "contract-only"), true, "commercial_ledger_api_trace_contract_only");
  assert.equal(plan.providerBoundary.rawSecretAcceptedByRunner, false, "commercial_ledger_raw_provider_key_rejected");
  assert.deepEqual(plan.providerBoundary.publicFields, ["provider", "providerKeyRef", "boundStatus"], "commercial_ledger_provider_public_fields");

  assert.deepEqual(plan.billingLedgerShape.requiredWriteFields, [
    "billing_event_id",
    "tenant_id",
    "account_id",
    "workspace_id",
    "resource_binding_id",
    "cloud_operation_id",
    "billing_attribution_id",
    "server_plan_id",
    "event_type",
    "status",
    "amount",
    "currency",
    "usage_quantity",
    "usage_unit",
    "cost_attribution_scope",
    "idempotency_key",
  ], "billing_ledger_write_shape");
  assert.deepEqual(plan.auditLedgerShape.requiredWriteFields, [
    "audit_event_id",
    "tenant_id",
    "account_id",
    "workspace_id",
    "resource_binding_id",
    "cloud_operation_id",
    "billing_attribution_id",
    "actor_type",
    "action",
    "status",
    "idempotency_key",
    "redaction_status",
  ], "audit_ledger_write_shape");
  assert.deepEqual(plan.quotaLedgerShape.requiredWriteFields, [
    "quota_event_id",
    "tenant_id",
    "account_id",
    "workspace_id",
    "resource_binding_id",
    "cloud_operation_id",
    "server_plan_id",
    "quota_type",
    "limit_value",
    "usage_value",
    "enforcement_decision",
    "idempotency_key",
  ], "quota_ledger_write_shape");
  assert.equal(plan.linkage.resourceBindingId, "rb-production-alpha", "commercial_ledger_resource_binding_link");
  assert.equal(plan.linkage.cloudOperationId, "op:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-ledger-alpha-once", "commercial_ledger_cloud_operation_link");
  assert.equal(plan.workspaceCostAttribution.costAttributionScope, "tenant/account/workspace/resourceBinding/cloudOperation/billingAttribution/serverPlan", "commercial_ledger_cost_attribution_scope");
  assert.equal(plan.quotaEnforcementBoundary.productionEnforcementNow, false, "quota_enforcement_not_live_now");
  assert.equal(plan.quotaEnforcementBoundary.futureDecisionValues.includes("deny"), true, "quota_enforcement_has_deny_boundary");
  assert.equal(plan.idempotency.operationId, "commercial:tenant-production-alpha:workspace-production-alpha:rb-production-alpha:workspace-commercial-ledger-alpha-once", "commercial_ledger_operation_id_shape");
  assert.equal(plan.evidence.path, path.join(evidenceDir, runId, "commercial-ledger-contract-redacted.json"), "commercial_ledger_evidence_path");
  assert.equal(plan.externalAccess.status, "blocked_until_multi_tenant_minimum_launch_closure", "commercial_ledger_external_access_status");
  assertNoSensitiveText(JSON.stringify(plan), "commercial_ledger_plan");

  const summary = await runProductionLaunchCommercialLedgerContract({
    runId,
    evidenceDir,
    authorized: true,
  });
  assert.equal(summary.ok, true, "commercial_ledger_summary_ok");
  assert.equal(summary.evidencePath.endsWith(`${runId}/commercial-ledger-contract-redacted.json`), true, "commercial_ledger_summary_evidence_path");
  assert.equal(summary.realExecutionReady, false, "commercial_ledger_real_execution_ready_false");
  assertNoSensitiveText(JSON.stringify(summary), "commercial_ledger_summary");

  const evidence = JSON.parse(await readFile(summary.evidencePath, "utf8"));
  assert.equal(evidence.ok, true, "commercial_ledger_evidence_ok");
  assert.equal(evidence.redactionAudit.rawSecretMaterialExposed, false, "commercial_ledger_evidence_hides_raw_provider_key");
  assert.equal(evidence.redactionAudit.dbPasswordExposed, false, "commercial_ledger_evidence_hides_db_password");
  assert.equal(evidence.redactionAudit.tokenExposed, false, "commercial_ledger_evidence_hides_token");
  assert.equal(evidence.redactionAudit.tencentSecretExposed, false, "commercial_ledger_evidence_hides_tencent_secret");
  assert.equal(evidence.redactionAudit.browserStorageSecretWritePresent, false, "commercial_ledger_evidence_blocks_browser_storage_secret");
  assert.equal(evidence.nextGap.id, "production-launch-gap-05-workspace-lifecycle-contract", "next_gap_after_gap_04");
  assertNoSensitiveText(JSON.stringify(evidence), "commercial_ledger_evidence");

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
    "--postgres",
    "--db",
    "--ingress",
    "--load-balancer",
    "--secret-file",
    "--env",
  ]) {
    await assert.rejects(
      () => buildProductionLaunchCommercialLedgerContract({
        runId,
        evidenceDir,
        authorized: true,
        argv: [forbiddenArg, "1"],
      }),
      /production_launch_commercial_ledger_forbidden_arg/,
      `commercial_ledger_runner_must_reject:${forbiddenArg}`,
    );
  }
} finally {
  await rm(commercialLedgerEvidenceRoot, { recursive: true, force: true });
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
    "production_launch_gap_02_package_c_operation_contract_local_gate",
    "production_launch_gap_03_resourcebinding_postgresql_ledger_contract_local_gate",
    "production_launch_gap_04_billing_audit_quota_ledger_contract_local_gate",
  ],
}, null, 2));
