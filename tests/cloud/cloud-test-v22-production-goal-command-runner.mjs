import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const runner = "tests/support/cloud-prework/production-goal-command-runner.mjs";
const runnerSource = readFileSync(path.join(repoRoot, runner), "utf8");
const realTkeSupportSource = readFileSync(path.join(repoRoot, "tests/support/cloud-prework/lib/real-tke-runtime-node-lifecycle-support.js"), "utf8");

assert.equal(
  runnerSource.includes("DescribeClusterNodePools({ ClusterId: clusterId, NodePoolIds"),
  false,
  "runtime_tke_node_pool_probe_must_not_pass_unsupported_node_pool_ids",
);
assert.equal(
  runnerSource.includes("DescribeClusterNodePools({ ClusterId: clusterId })"),
  true,
  "runtime_tke_node_pool_probe_must_use_cluster_only_request_shape",
);
assert.equal(
  runnerSource.includes("normalizeDeploymentTarget(plan.deployment)")
    && runnerSource.includes("return \"deployment/medopl-control-plane\""),
  true,
  "deploy_runner_must_default_to_medopl_control_plane_deployment",
);
assert.equal(
  runnerSource.includes("rollout status deploy --timeout=180s"),
  false,
  "deploy_runner_must_not_use_invalid_rollout_status_deploy_target",
);
assert(
  runnerSource.includes("SELECT count(*)::int AS count FROM files WHERE workspace_id = $1"),
  "live_db_persistence_proof_must_read_typed_file_records",
);
assert(
  runnerSource.includes("SELECT count(*)::int AS count FROM runs WHERE workspace_id = $1"),
  "live_db_persistence_proof_must_read_typed_run_records",
);
assert(
  runnerSource.includes("SELECT count(*)::int AS count FROM artifacts WHERE workspace_id = $1"),
  "live_db_persistence_proof_must_read_typed_artifact_records",
);
assert(
  runnerSource.includes("SELECT count(*)::int AS count FROM control_plane_audit_events WHERE workspace_id = $1"),
  "live_db_persistence_proof_must_read_typed_audit_events",
);
assert(
  runnerSource.includes("SELECT count(*)::int AS count FROM billing_events WHERE workspace_id = $1"),
  "live_db_persistence_proof_must_read_typed_billing_events",
);
assert(
  runnerSource.includes("runRealTkeRuntimeNodeLifecycleCommand") &&
    realTkeSupportSource.includes("V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE"),
  "real_tke_runner_must_support_fake_sdk_module_for_local_proof_without_cloud_calls",
);
assert.equal(
  runnerSource.includes("control_plane_records WHERE kind = 'file'"),
  false,
  "live_db_persistence_proof_must_not_check_retired_generic_file_records",
);
const livePrepareIndex = runnerSource.indexOf('path: "/api/v22/users/prepare"');
const liveApproveIndex = runnerSource.indexOf('path: "/api/v22/users/approve"');
const livePaymentOrderIndex = runnerSource.indexOf('path: "/api/v22/billing/payment-orders"');
const livePaymentPaidIndex = runnerSource.indexOf('path: "/api/v22/billing/payment-paid"');
const liveProviderBindIndex = runnerSource.indexOf('path: "/api/v22/provider-key"');
const liveOpenRuntimeIndex = runnerSource.indexOf('path: "/api/v22/managed-environment/open"');
assert(
  livePrepareIndex !== -1
    && liveApproveIndex > livePrepareIndex
    && livePaymentOrderIndex > liveApproveIndex
    && livePaymentPaidIndex > liveApproveIndex
    && liveProviderBindIndex > liveApproveIndex
    && liveOpenRuntimeIndex > liveApproveIndex,
  "live_test_runner_must_approve_business_account_before_payment_provider_and_open_runtime",
);

function run(args = [], env = {}) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function parseJson(result, label) {
  assert.equal(result.status, 0, `${label}_must_exit_zero:${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertNoSensitiveText(text = "", label = "output") {
  for (const forbidden of [
    "mutation-secret-key",
    "tcr-secret-test",
    "postgres://ledger.example.invalid",
    "rawResponse",
    "SecretId",
    "SecretKey",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

async function startCanaryServer(mode = "full") {
  const child = spawn(process.execPath, ["-e", `
const { createServer } = require("node:http");
const mode = process.argv[1];
const state = { preparedWorkspaceId: "", approvedWorkspaceId: "", sequence: [] };
async function readRequestJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const sendJson = (status, payload) => {
    response.writeHead(status, { "content-type": "application/json", connection: "close" });
    response.end(JSON.stringify(payload));
  };
  const requireIdentityScopeHeaders = (body) => {
    const expected = {
      "x-medopl-tenant-id": body.tenantId || body.tenant_id || "",
      "x-medopl-user-id": body.portalUserId || body.portal_user_id || body.userId || body.user_id || "",
      "x-medopl-workspace-id": body.workspaceId || body.workspace_id || "",
    };
    for (const [name, value] of Object.entries(expected)) {
      if (!request.headers[name] || (value && request.headers[name] !== value)) {
        sendJson(401, { ok: false, error: "unauthenticated", code: "authentication_required", missingScopeHeader: name });
        return false;
      }
    }
    return true;
  };
  const requireApprovedAccount = (body) => {
    if (state.approvedWorkspaceId !== body.workspaceId) {
      sendJson(428, { ok: false, error: "account_not_approved" });
      return false;
    }
    return true;
  };
  if (mode === "html-medopl" && (url.pathname === "/healthz" || url.pathname === "/readyz")) {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end("<!doctype html><title>wrong upstream</title>");
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(200, { "content-type": "text/html", connection: "close" });
    response.end("<!doctype html><title>MedOPL Portal</title><div id=\\"root\\">MedOPL Portal</div><script type=\\"module\\" src=\\"/assets/app.js\\"></script>");
    return;
  }
  if (url.pathname === "/healthz" || url.pathname === "/readyz") {
    sendJson(200, { service: "medopl-go-backend", status: "ok", mode: "production" });
    return;
  }
  if (url.pathname === "/api/v22/provider-key" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    state.sequence.push("bind_provider_key");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, providerKeyRef: "pkref_canary", boundStatus: "bound" });
    return;
  }
  if (url.pathname === "/api/v22/users/prepare" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    state.preparedWorkspaceId = body.workspaceId;
    state.approvedWorkspaceId = "";
    state.sequence.push("prepare_business_account");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "pending_approval", balance: 0, currency: "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/users/approve" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (state.preparedWorkspaceId !== body.workspaceId) {
      sendJson(428, { ok: false, error: "account_required" });
      return;
    }
    state.approvedWorkspaceId = body.workspaceId;
    state.sequence.push("approve_business_account");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "approved", status: "approved" });
    return;
  }
  if (url.pathname === "/api/v22/users/credit" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "active", balance: body.amount || 0, currency: body.currency || "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/billing/payment-orders" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    state.sequence.push("create_payment_order");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, orderId: "payorder_canary", status: "created", amount: body.amount || 0, currency: body.currency || "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/billing/payment-paid" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    if (request.headers["x-medopl-webhook-secret"] !== "webhook-secret-test") {
      sendJson(401, { ok: false, error: "webhook_signature_required" });
      return;
    }
    state.sequence.push("mark_payment_paid");
    sendJson(200, { ok: true, workspaceId: body.workspaceId, accountStatus: "active", balance: body.amount || 0, currency: body.currency || "CNY" });
    return;
  }
  if (url.pathname === "/api/v22/managed-environment/open" && request.method === "POST") {
    const body = await readRequestJson(request);
    if (!requireIdentityScopeHeaders(body)) return;
    if (!requireApprovedAccount(body)) return;
    state.sequence.push("open_runtime");
    sendJson(200, { launchId: "launch_canary", resourceBindingId: "rb_canary", workspaceId: body.workspaceId });
    return;
  }
  if (url.pathname === "/api/opl/runtime-gate" && request.method === "POST") {
    const body = await readRequestJson(request);
    sendJson(200, {
      ok: true,
      productOwner: "medopl",
      primaryConsumer: "opl-webui",
      workspaceId: body.workspaceId,
      medoplRuntimeRequired: true,
      providerKeyStatus: "bound",
      providerKeyRef: "pkref_canary",
      runtimeState: "ready",
      storageState: "ready",
      runtimeBindingId: "rb_canary",
      storageBindingId: "storage_canary",
      nodePoolProjection: { nodePoolRef: "nodepool_canary", state: "ready", customerVisible: false },
      consumerProjection: { uploadEnabled: true, runEnabled: true, artifactEnabled: true },
      commercialAdmission: {
        accountExists: true,
        accountApproved: true,
        workspaceExists: true,
        providerKeyRefExists: true,
        planSelected: true,
        balanceSufficient: true,
        quotaAvailable: true,
        emergencyPlatformStop: false,
        allowed: true,
        decision: "allowed",
        reason: "runtime_storage_ready",
      },
    });
    return;
  }
  if (url.pathname === "/api/opl/files" && request.method === "POST") {
    if (mode === "upload-diagnostic") {
      sendJson(400, {
        ok: false,
        error: "control_plane_operation_failed",
        errorCategory: "file_save_failed",
        correlationId: "corr-upload-canary",
        operationId: "upload-file-canary",
        launchIdPresent: true,
        launchLookupSucceeded: true,
        workspaceIdHash: "workspace_hash",
        resourceBindingIdHash: "resource_hash",
        storageBindingIdHash: "storage_hash",
        providerKeyRefPresent: true,
        runtimeState: "ready",
        storageState: "ready",
        fileNamePresent: true,
        relativePathHash: "relative_path_hash",
        fileRefHash: "file_hash",
        objectRefHash: "object_hash",
        saveFileStageSucceeded: false,
        saveAuditEventStageSucceeded: false,
        billingEventStageSucceeded: false,
        dbOperationStage: "save_file",
        handlerStage: "upload_file_handler",
        migrationState: "matched",
        duplicateCategory: "none",
        retryable: false,
      });
      return;
    }
    sendJson(200, { ok: true, fileRef: "file_canary", storageBindingId: "storage_canary" });
    return;
  }
  if (url.pathname === "/api/opl/runs" && request.method === "POST") {
    sendJson(200, { ok: true, runRef: "run_canary", artifactRef: "artifact_canary" });
    return;
  }
  if (url.pathname === "/api/opl/artifacts/artifact_canary" && request.method === "GET") {
    sendJson(200, { ok: true, artifactRef: "artifact_canary", fileRef: "artifact_file_canary" });
    return;
  }
  if (url.pathname === "/api/session/bootstrap" && request.method === "POST") {
    const body = await readRequestJson(request);
    response.setHeader("Set-Cookie", [
      "medopl_session=session-canary; Path=/; HttpOnly; Secure; SameSite=Strict",
      "medopl_csrf=csrf-canary; Path=/; Secure; SameSite=Strict",
    ]);
    sendJson(200, {
      ok: true,
      tenantId: body.tenantId,
      userId: body.userId,
      workspaceId: body.workspaceId,
      session: "issued",
    });
    return;
  }
  if (url.pathname === "/api/billing/summary" && request.method === "GET") {
    sendJson(200, { ok: true, runCount: 1, ledgerCount: 1 });
    return;
  }
  if (url.pathname === "/api/v22/managed-environment/release" && request.method === "POST") {
    if (mode === "release-diagnostic") {
      sendJson(400, {
        ok: false,
        error: "control_plane_operation_failed",
        errorCategory: "provider_release_failed",
        correlationId: "corr-release-canary",
        operationId: "runtime-release-canary",
        workspaceIdHash: "workspace_hash",
        runtimeBindingIdHash: "runtime_hash",
        runtimeState: "ready",
        expectedReleaseTransition: "ready_to_released",
        resourceBindingPresent: true,
        billingAttributionPresent: true,
        billingStopped: false,
        stopBillingState: "pending",
        idempotencyKeyPresent: true,
        alreadyReleased: false,
        auditEventWritten: false,
        providerRefPresent: true,
        providerReleaseCategory: "adapter_error",
        dbOperationStage: "release_runtime",
        handlerStage: "release_runtime_handler",
        migrationState: "matched",
        workspaceBindingMatch: "matched",
        authSessionMatch: "matched",
        retryable: false,
      });
      return;
    }
    sendJson(200, { ok: true, billingStopped: true, auditEventId: "audit_release_canary", runtimeState: "released" });
    return;
  }
  if (url.pathname === "/api/v22/storage/destroy" && request.method === "POST") {
    if (mode === "destroy-diagnostic") {
      sendJson(400, {
        ok: false,
        error: "control_plane_operation_failed",
        errorCategory: "db_constraint_failed",
        correlationId: "corr-destroy-canary",
        operationId: "storage-destroy-canary",
        workspaceIdHash: "workspace_hash",
        runtimeBindingIdHash: "runtime_hash",
        storageBindingIdHash: "storage_hash",
        currentStorageState: "ready",
        releaseState: "released",
        billingStopped: true,
        destroyIntentState: "requested",
        auditEventWritten: false,
        providerRefPresent: true,
        dbOperationStage: "save_billing_event",
        handlerStage: "storage_destroy_handler",
        retryable: false,
      });
      return;
    }
    sendJson(200, { ok: true, storageDestroyed: true, storageState: "destroyed", auditEventId: "audit_destroy_canary" });
    return;
  }
  sendJson(404, { ok: false, error: "not_found", path: url.pathname });
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write("READY " + address.port + "\\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`, mode], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("canary_server_start_timeout")), 5000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const match = buffer.match(/READY (\d+)/u);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`canary_server_exited:${code}`));
    });
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    }),
  };
}

const canaryServers = [];
const tempDir = mkdtempSync(path.join(tmpdir(), "v22-production-command-runner-"));
try {
  const mutationSecretFile = path.join(tempDir, "mutation.env");
  const runtimePlan = path.join(tempDir, "runtime-plan.json");
  const storagePlan = path.join(tempDir, "storage-plan.json");
  const realTkeDerivedPlan = path.join(tempDir, "real-tke-derived-plan.json");
  const realTkeFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs.mjs");
  const realTkeEvidenceRef = `.runtime/v22-cloud-authorization/test-${Date.now()}/real_tke_runtime_node_lifecycle.json`;
  const receiptFile = path.join(tempDir, "receipt.json");
  const deployPlan = path.join(tempDir, "deploy-plan.json");
  const shortDeployPlan = path.join(tempDir, "deploy-plan-short-name.json");
  const manifestDir = path.join(tempDir, "manifests");
  const buildContext = path.join(tempDir, "build-context");
  const binDir = path.join(tempDir, "bin");
  const kubectlLog = path.join(tempDir, "kubectl.log");
  mkdirSync(manifestDir);
  mkdirSync(buildContext);
  mkdirSync(binDir);
  writeFileSync(path.join(manifestDir, "deployment.yaml"), "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: medopl-test\n");
  writeFileSync(path.join(buildContext, "Dockerfile"), "FROM scratch\n");
  writeFileSync(path.join(binDir, "kubectl"), [
    "#!/usr/bin/env bash",
    "printf '%s\\n' \"$*\" >> \"$TEST_KUBECTL_LOG\"",
    "exit 0",
    "",
  ].join("\n"));
  chmodSync(path.join(binDir, "kubectl"), 0o755);
  writeFileSync(mutationSecretFile, [
    "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
    "TENCENT_MUTATION_SECRET_ID=mutation-secret-id",
    "TENCENT_MUTATION_SECRET_KEY=mutation-secret-key",
    "TENCENT_MUTATION_ACCOUNT_ID=123456789012",
    "TENCENT_MUTATION_REGIONS=na-siliconvalley",
    "TENCENT_MUTATION_TKE_CLUSTER_ID=cls-test",
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID=np-test",
    "TENCENT_MUTATION_COS_BUCKET=cos-bucket-test",
    "TENCENT_MUTATION_COS_REGION=na-siliconvalley",
    "TENCENT_MUTATION_WORKSPACE_PREFIX_ROOT=medopl-v22/workspaces/",
    "",
  ].join("\n"));
  writeFileSync(runtimePlan, JSON.stringify({ runtime_plan: "starter", workspace_id: "workspace-test" }));
  writeFileSync(realTkeDerivedPlan, JSON.stringify({
    clusterId: "cls-test",
    region: "na-siliconvalley",
    requireNodeTotal: 1,
    requireReadyNodeCount: 1,
    createObserveAttempts: 1,
    upgradeObserveAttempts: 1,
    deleteObserveAttempts: 1,
    tiers: [
      { id: "starter_2c4g_10gb", cpuCores: 2, memoryGb: 4, storageGb: 10 },
      { id: "pro_8c16g_100gb", cpuCores: 8, memoryGb: 16, storageGb: 100 },
    ],
    deriveFromPlatformNodePool: {
      enabled: true,
      nodePoolId: "np-platform",
    },
  }));
  writeFileSync(realTkeFakeSdk, `
const calls = [];
const pools = new Map();
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DescribeClusterNodePoolDetail(request) {
    calls.push({ api: "DescribeClusterNodePoolDetail", request });
    await persist();
    return { NodePool: {
      AutoscalingGroupId: "asg-platform",
      LaunchConfigurationId: "lc-platform",
      RuntimeConfig: { RuntimeType: "containerd", RuntimeVersion: "1.6.0" },
      NodePoolOs: "tlinux3.1x86_64",
      Labels: [{ Name: "medopl-owner", Value: "platform" }],
      Taints: [],
      Annotations: [],
    } };
  }
  async CreateClusterNodePool(request) {
    calls.push({ api: "CreateClusterNodePool", request });
    const nodePoolId = request.Name.includes("pro") ? "np-pro-created" : "np-starter-created";
    const launch = JSON.parse(request.LaunchConfigurePara);
    pools.set(nodePoolId, {
      NodePoolId: nodePoolId,
      LifeState: "normal",
      DesiredNodesNum: 1,
      MinNodesNum: 1,
      MaxNodesNum: 1,
      InstanceTypes: launch.InstanceTypes || [launch.InstanceType].filter(Boolean),
      NodeCountSummary: { AutoscalingAdded: { Total: 1, Normal: 1 }, ManuallyAdded: { Total: 0, Normal: 0 } },
    });
    await persist();
    return { NodePoolId: nodePoolId };
  }
  async ModifyNodePoolInstanceTypes(request) {
    calls.push({ api: "ModifyNodePoolInstanceTypes", request });
    const pool = pools.get(request.NodePoolId);
    if (pool) pool.InstanceTypes = request.InstanceTypes;
    await persist();
    return { RequestId: "modify-instance-types" };
  }
  async ModifyClusterNodePool(request) {
    calls.push({ api: "ModifyClusterNodePool", request });
    await persist();
    return { RequestId: "modify-node-pool" };
  }
  async DescribeClusterNodePools(request) {
    calls.push({ api: "DescribeClusterNodePools", request });
    await persist();
    return { NodePoolSet: Array.from(pools.values()) };
  }
  async DeleteClusterNodePool(request) {
    calls.push({ api: "DeleteClusterNodePool", request });
    for (const id of request.NodePoolIds || []) pools.delete(id);
    await persist();
    return { RequestId: "delete-node-pool" };
  }
}
class AsClient {
  async DescribeAutoScalingGroups(request) {
    calls.push({ api: "DescribeAutoScalingGroups", request });
    await persist();
    return { AutoScalingGroupSet: [{
      AutoScalingGroupId: "asg-platform",
      VpcId: "vpc-test",
      SubnetIdSet: ["subnet-test"],
      ZoneSet: ["na-siliconvalley-1"],
      ProjectId: 0,
      DefaultCooldown: 300,
    }] };
  }
  async DescribeLaunchConfigurations(request) {
    calls.push({ api: "DescribeLaunchConfigurations", request });
    await persist();
    return { LaunchConfigurationSet: [{
      LaunchConfigurationId: "lc-platform",
      ImageId: "img-test",
      SystemDisk: { DiskType: "CLOUD_PREMIUM", DiskSize: 50 },
      SecurityGroupIds: ["sg-test"],
      InternetAccessible: { InternetChargeType: "TRAFFIC_POSTPAID_BY_HOUR", InternetMaxBandwidthOut: 1 },
      EnhancedService: { SecurityService: { Enabled: true }, MonitorService: { Enabled: true } },
      InstanceChargeType: "POSTPAID_BY_HOUR",
    }] };
  }
}
class CvmClient {
  async DescribeInstanceTypeConfigs(request) {
    calls.push({ api: "DescribeInstanceTypeConfigs", request });
    await persist();
    return { InstanceTypeConfigSet: [
      { Zone: "na-siliconvalley-1", InstanceType: "S5.MEDIUM4", CPU: 2, Memory: 4 },
      { Zone: "na-siliconvalley-1", InstanceType: "S5.2XLARGE16", CPU: 8, Memory: 16 },
    ] };
  }
}
export default {
  tke: { v20180525: { Client: TkeClient } },
  as: { v20180419: { Client: AsClient } },
  cvm: { v20170312: { Client: CvmClient } },
};
`);
  writeFileSync(storagePlan, JSON.stringify({ storage_plan: "workspace", workspace_id: "workspace-test" }));
  writeFileSync(receiptFile, JSON.stringify({ events: ["runtime_owner_receipt_accepted"] }));
  writeFileSync(deployPlan, JSON.stringify({ namespace: "np-6l4nkdto-2cdtm", deployments: ["medopl"] }));
  writeFileSync(shortDeployPlan, JSON.stringify({ namespace: "medopl", deployment: "medopl-control-plane" }));

  const baseEnv = {
    V22_TENCENT_MUTATION_SECRET_FILE: mutationSecretFile,
    V22_TENCENT_RUNTIME_PLAN_FILE: runtimePlan,
    V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: realTkeDerivedPlan,
    V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: realTkeFakeSdk,
    V22_TENCENT_STORAGE_PLAN_FILE: storagePlan,
    V22_MEDOPL_BILLING_AUDIT_RECEIPT_FILE: receiptFile,
    V22_MEDOPL_DEPLOY_PLAN_FILE: deployPlan,
    V22_KUBERNETES_MANIFEST_DIR: manifestDir,
    V22_CONTAINER_BUILD_CONTEXT: buildContext,
    V22_CONTAINER_DOCKERFILE: path.join(buildContext, "Dockerfile"),
    V22_CONTAINER_IMAGE_REF: "registry.example.test/medopl/app:test",
    TCR_ID: "tcr-id-test",
    TCR_SECRET: "tcr-secret-test",
    DATABASE_URL: "postgres://ledger.example.invalid/db",
    MEDOPL_SESSION_BOOTSTRAP_SECRET_SHA256: "a".repeat(64),
    MEDOPL_WEBHOOK_SECRET: "webhook-secret-test",
    TENCENT_DEPLOY_KUBECONFIG_REF: "kubeconfig-ref-test",
    TEST_KUBECTL_LOG: kubectlLog,
    TEST_REAL_TKE_FAKE_SDK_LOG: path.join(tempDir, "real-tke-fake-sdk.log"),
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: "https://opl.medopl.cn",
    V22_MEDOPL_PUBLIC_BASE_URL: "https://portal.medopl.cn",
    V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF: "",
    V22_GOAL_EVIDENCE_REF: realTkeEvidenceRef,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
  };

  const missingExecute = run(["--operation", "storage_lifecycle"], baseEnv);
  assert.notEqual(missingExecute.status, 0, "command_runner_must_require_execute");
  assert(missingExecute.stderr.includes("production_goal_command_execute_required"), "missing_execute_reason");
  assertNoSensitiveText(missingExecute.stdout + missingExecute.stderr, "missing_execute");

  const missingAuthorization = run(["--operation", "storage_lifecycle", "--execute"], baseEnv);
  assert.notEqual(missingAuthorization.status, 0, "command_runner_must_require_authorization_confirmation");
  assert(missingAuthorization.stderr.includes("production_goal_command_authorization_required"), "missing_authorization_reason");
  assertNoSensitiveText(missingAuthorization.stdout + missingAuthorization.stderr, "missing_authorization");

  const unsupported = run(["--operation", "unknown", "--check-config"], baseEnv);
  assert.notEqual(unsupported.status, 0, "command_runner_must_reject_unknown_operation");
  assert(unsupported.stderr.includes("production_goal_command_operation_unsupported"), "unsupported_reason");

  const checkConfig = parseJson(run(["--operation", "storage_lifecycle", "--check-config"], baseEnv), "storage_check_config");
  assert.equal(checkConfig.ok, true, "check_config_ok");
  assert.equal(checkConfig.summary.operationClass, "storage_lifecycle", "check_config_operation");
  assert.equal(checkConfig.summary.executesCloudCommands, false, "check_config_must_not_execute_cloud");
  assert.deepEqual(checkConfig.summary.requiredEnvMissing, [], "check_config_required_env");
  assertNoSensitiveText(JSON.stringify(checkConfig), "check_config");

  const billingCheck = parseJson(run(["--operation", "billing_audit_writeback", "--check-config"], baseEnv), "billing_check_config");
  assert.equal(billingCheck.summary.requiredEnvMissing.length, 0, "billing_required_env");
  assert.equal(billingCheck.summary.requiredPathMissing.length, 0, "billing_required_paths");

  const realTkeCheck = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--check-config"], baseEnv), "real_tke_check_config");
  assert.equal(realTkeCheck.summary.requiredEnvMissing.length, 0, "real_tke_required_env");
  assert.equal(realTkeCheck.summary.requiredPathMissing.length, 0, "real_tke_required_paths");

  const realTkeExecute = parseJson(run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], baseEnv), "real_tke_execute");
  assert.equal(realTkeExecute.summary.realProviderMutationExecuted, true, "real_tke_must_execute_provider_mutation");
  assert.deepEqual(realTkeExecute.summary.tierCoverage, ["starter_2c4g_10gb", "pro_8c16g_100gb"], "real_tke_must_cover_starter_and_pro");
  assert.equal(realTkeExecute.summary.upgradeVerified, true, "real_tke_must_verify_upgrade");
  assert.equal(realTkeExecute.summary.cleanupVerified, true, "real_tke_must_verify_cleanup");
  assert.equal(realTkeExecute.summary.nodePoolDestroyed, true, "real_tke_must_destroy_created_node_pools");
  assertNoSensitiveText(JSON.stringify(realTkeExecute), "real_tke_execute");
  const realTkeCalls = JSON.parse(readFileSync(baseEnv.TEST_REAL_TKE_FAKE_SDK_LOG, "utf8"));
  assert.deepEqual(realTkeCalls.map((call) => call.api).filter((api) => api !== "DescribeClusterNodePools"), [
    "DescribeClusterNodePoolDetail",
    "DescribeAutoScalingGroups",
    "DescribeLaunchConfigurations",
    "DescribeInstanceTypeConfigs",
    "CreateClusterNodePool",
    "ModifyNodePoolInstanceTypes",
    "CreateClusterNodePool",
    "DeleteClusterNodePool",
    "DeleteClusterNodePool",
  ], "real_tke_must_derive_create_upgrade_and_destroy");
  const createdRequests = realTkeCalls.filter((call) => call.api === "CreateClusterNodePool").map((call) => call.request);
  assert.equal(createdRequests.length, 2, "real_tke_must_create_two_node_pools");
  for (const request of createdRequests) {
    for (const tag of request.Tags || []) {
      assert.equal(String(tag.Key || "").includes("/"), false, "real_tke_cloud_tags_must_use_tencent_safe_keys");
    }
  }
  assert.equal(JSON.parse(createdRequests[0].LaunchConfigurePara).InstanceTypes[0], "S5.MEDIUM4", "starter_tier_instance_type");
  assert.equal(JSON.parse(createdRequests[1].LaunchConfigurePara).InstanceTypes[0], "S5.2XLARGE16", "pro_tier_instance_type");
  const upgradeCall = realTkeCalls.find((call) => call.api === "ModifyNodePoolInstanceTypes");
  assert.deepEqual(upgradeCall.request.InstanceTypes, ["S5.2XLARGE16"], "starter_upgrade_must_target_pro_instance_type");
  assert.deepEqual(realTkeCalls.filter((call) => call.api === "DeleteClusterNodePool").map((call) => call.request.NodePoolIds), [
    ["np-pro-created"],
    ["np-starter-created"],
  ], "real_tke_cleanup_must_delete_all_created_node_pools");

  const missingSourcePlan = path.join(tempDir, "real-tke-missing-source-plan.json");
  const missingSourceFakeSdk = path.join(tempDir, "fake-tencentcloud-sdk-nodejs-missing-source.mjs");
  const missingSourceLog = path.join(tempDir, "real-tke-missing-source-fake-sdk.log");
  writeFileSync(missingSourcePlan, JSON.stringify({
    clusterId: "cls-test",
    region: "na-siliconvalley",
    requireNodeTotal: 1,
    requireReadyNodeCount: 1,
    tiers: [
      { id: "starter_2c4g_10gb", cpuCores: 2, memoryGb: 4, storageGb: 10 },
      { id: "pro_8c16g_100gb", cpuCores: 8, memoryGb: 16, storageGb: 100 },
    ],
    deriveFromPlatformNodePool: {
      enabled: true,
      nodePoolId: "np-missing",
    },
  }));
  writeFileSync(missingSourceFakeSdk, `
const calls = [];
async function persist() {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(process.env.TEST_REAL_TKE_MISSING_SOURCE_FAKE_SDK_LOG, JSON.stringify(calls, null, 2));
}
class TkeClient {
  async DescribeClusterNodePoolDetail(request) {
    calls.push({ api: "DescribeClusterNodePoolDetail", request });
    await persist();
    const error = new Error("related node pool query err(get nodepool 'np-missing' failed: [E501001 DBRecordNotFound] record not found)");
    error.code = "DBRecordNotFound";
    throw error;
  }
  async DescribeClusterNodePools(request) {
    calls.push({ api: "DescribeClusterNodePools", request });
    await persist();
    return { NodePoolSet: [{
      NodePoolId: "np-platform-candidate",
      Name: "medopl-platform-service",
      LifeState: "normal",
      NodeCountSummary: { AutoscalingAdded: { Total: 1, Normal: 1 }, ManuallyAdded: { Total: 0, Normal: 0 } },
      Labels: [{ Name: "medopl.io/pool", Value: "platform" }],
      TagSpecification: { Tags: [{ Key: "medopl.io/pool", Value: "platform" }] },
    }] };
  }
  async CreateClusterNodePool(request) {
    calls.push({ api: "CreateClusterNodePool", request });
    await persist();
    return { NodePoolId: "np-should-not-create" };
  }
}
class AsClient {}
class CvmClient {}
export default {
  tke: { v20180525: { Client: TkeClient } },
  as: { v20180419: { Client: AsClient } },
  cvm: { v20170312: { Client: CvmClient } },
};
`);
  const missingSource = run(["--operation", "real_tke_runtime_node_lifecycle", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_FILE: missingSourcePlan,
    V22_TENCENT_REAL_TKE_NODE_LIFECYCLE_SDK_MODULE: missingSourceFakeSdk,
    TEST_REAL_TKE_MISSING_SOURCE_FAKE_SDK_LOG: missingSourceLog,
  });
  assert.notEqual(missingSource.status, 0, "real_tke_missing_source_pool_must_fail_closed");
  const missingSourcePayload = JSON.parse(missingSource.stdout);
  assert.equal(
    missingSourcePayload.summary.blocker,
    "production_goal_real_tke_platform_node_pool_not_found",
    "real_tke_missing_source_pool_blocker",
  );
  assert.equal(
    missingSourcePayload.summary.sourceNodePoolRef,
    "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
    "real_tke_missing_source_pool_ref",
  );
  assert.deepEqual(
    missingSourcePayload.summary.candidateNodePools.map((item) => item.nodePoolRef),
    ["np-platform-candidate"],
    "real_tke_missing_source_pool_candidates",
  );
  assertNoSensitiveText(missingSource.stdout + missingSource.stderr, "real_tke_missing_source");
  const missingSourceCalls = JSON.parse(readFileSync(missingSourceLog, "utf8"));
  assert.deepEqual(
    missingSourceCalls.map((call) => call.api),
    ["DescribeClusterNodePoolDetail", "DescribeClusterNodePools"],
    "real_tke_missing_source_must_not_create_before_valid_source_pool",
  );

  const buildCheck = parseJson(run(["--operation", "build_push", "--check-config"], baseEnv), "build_check_config");
  assert.equal(buildCheck.summary.requiredEnvMissing.length, 0, "build_required_env");
  assert.equal(buildCheck.summary.requiredPathMissing.length, 0, "build_required_paths");

  const liveCheck = parseJson(run(["--operation", "live_test", "--check-config"], baseEnv), "live_check_config");
  assert.deepEqual(liveCheck.summary.urls, ["https://opl.medopl.cn", "https://portal.medopl.cn"], "live_urls");
  assert.equal(
    runnerSource.includes("MEDOPL_SESSION_SIGNING_SECRET_SHA256"),
    false,
    "live_test_runner_must_not_forge_session_with_signing_secret",
  );
  assert(
    runnerSource.includes("/api/session/bootstrap"),
    "live_test_runner_must_use_session_bootstrap_route",
  );

  const badCanary = await startCanaryServer("html-medopl");
  canaryServers.push(badCanary);
  const htmlMedopl = run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: badCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: badCanary.baseUrl,
  });
  assert.notEqual(htmlMedopl.status, 0, "live_test_must_fail_when_medopl_health_is_static_html");
  assert(
    (htmlMedopl.stdout + htmlMedopl.stderr).includes("production_goal_live_test_medopl_healthz_failed"),
    "live_test_html_health_blocker",
  );
  assertNoSensitiveText(htmlMedopl.stdout + htmlMedopl.stderr, "live_test_html_health");

  const goodCanary = await startCanaryServer("full");
  canaryServers.push(goodCanary);
  const liveExecute = parseJson(run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: goodCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: goodCanary.baseUrl,
  }), "live_test_execute_full_product_api_canary");
  assert.equal(liveExecute.summary.flowCompleteness, "medopl_public_api_product_e2e", "live_test_must_execute_product_api_canary");
  assert.deepEqual(liveExecute.summary.steps, [
    "opl_webui_public_entry",
    "medopl_portal_public_entry",
    "medopl_healthz",
    "medopl_readyz",
    "session_bootstrap",
    "prepare_business_account",
    "approve_business_account",
    "create_payment_order",
    "mark_payment_paid",
    "bind_provider_key",
    "open_runtime",
    "runtime_gate",
    "upload_file",
    "run_task",
    "fetch_artifact",
    "billing_summary",
    "release_runtime",
    "destroy_storage",
  ], "live_test_product_api_steps");
  assert.equal(liveExecute.summary.productionComplete, false, "live_test_must_not_claim_production_complete");
  assertNoSensitiveText(JSON.stringify(liveExecute), "live_test_execute");

  const destroyDiagnosticCanary = await startCanaryServer("destroy-diagnostic");
  canaryServers.push(destroyDiagnosticCanary);
  const destroyDiagnostic = run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: destroyDiagnosticCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: destroyDiagnosticCanary.baseUrl,
  });
  assert.notEqual(destroyDiagnostic.status, 0, "live_test_must_fail_when_destroy_storage_returns_diagnostic_error");
  const destroyDiagnosticPayload = JSON.parse(destroyDiagnostic.stdout);
  assert.equal(destroyDiagnosticPayload.summary.blocker, "production_goal_live_test_destroy_storage_failed", "destroy_diagnostic_blocker");
  assert.equal(destroyDiagnosticPayload.summary.diagnosticReceipt.errorCategory, "db_constraint_failed", "destroy_diagnostic_category");
  assert.equal(destroyDiagnosticPayload.summary.diagnosticReceipt.correlationId, "corr-destroy-canary", "destroy_diagnostic_correlation");
  assert.equal(destroyDiagnosticPayload.summary.diagnosticReceipt.dbOperationStage, "save_billing_event", "destroy_diagnostic_db_stage");
  assert.equal(destroyDiagnosticPayload.summary.diagnosticReceipt.workspaceIdHash, "workspace_hash", "destroy_diagnostic_workspace_hash");
  assertNoSensitiveText(destroyDiagnostic.stdout + destroyDiagnostic.stderr, "live_test_destroy_diagnostic");

  const releaseDiagnosticCanary = await startCanaryServer("release-diagnostic");
  canaryServers.push(releaseDiagnosticCanary);
  const releaseDiagnostic = run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: releaseDiagnosticCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: releaseDiagnosticCanary.baseUrl,
  });
  assert.notEqual(releaseDiagnostic.status, 0, "live_test_must_fail_when_release_runtime_returns_diagnostic_error");
  const releaseDiagnosticPayload = JSON.parse(releaseDiagnostic.stdout);
  assert.equal(releaseDiagnosticPayload.summary.blocker, "production_goal_live_test_release_runtime_failed", "release_diagnostic_blocker");
  assert.equal(releaseDiagnosticPayload.summary.diagnosticReceipt.errorCategory, "provider_release_failed", "release_diagnostic_category");
  assert.equal(releaseDiagnosticPayload.summary.diagnosticReceipt.correlationId, "corr-release-canary", "release_diagnostic_correlation");
  assert.equal(releaseDiagnosticPayload.summary.diagnosticReceipt.runtimeState, "ready", "release_diagnostic_runtime_state");
  assert.equal(releaseDiagnosticPayload.summary.diagnosticReceipt.stopBillingState, "pending", "release_diagnostic_stop_billing_state");
  assert.equal(releaseDiagnosticPayload.summary.diagnosticReceipt.billingAttributionPresent, true, "release_diagnostic_billing_attribution");
  assert.equal(releaseDiagnosticPayload.summary.diagnosticReceipt.providerReleaseCategory, "adapter_error", "release_diagnostic_provider_category");
  assertNoSensitiveText(releaseDiagnostic.stdout + releaseDiagnostic.stderr, "live_test_release_diagnostic");

  const uploadDiagnosticCanary = await startCanaryServer("upload-diagnostic");
  canaryServers.push(uploadDiagnosticCanary);
  const uploadDiagnostic = run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: uploadDiagnosticCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: uploadDiagnosticCanary.baseUrl,
  });
  assert.notEqual(uploadDiagnostic.status, 0, "live_test_must_fail_when_upload_file_returns_diagnostic_error");
  const uploadDiagnosticPayload = JSON.parse(uploadDiagnostic.stdout);
  assert.equal(uploadDiagnosticPayload.summary.blocker, "production_goal_live_test_upload_file_failed", "upload_diagnostic_blocker");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.errorCategory, "file_save_failed", "upload_diagnostic_category");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.correlationId, "corr-upload-canary", "upload_diagnostic_correlation");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.launchIdPresent, true, "upload_diagnostic_launch_id_present");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.launchLookupSucceeded, true, "upload_diagnostic_launch_lookup");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.resourceBindingIdHash, "resource_hash", "upload_diagnostic_resource_hash");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.storageBindingIdHash, "storage_hash", "upload_diagnostic_storage_hash");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.fileNamePresent, true, "upload_diagnostic_file_name");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.relativePathHash, "relative_path_hash", "upload_diagnostic_relative_path_hash");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.objectRefHash, "object_hash", "upload_diagnostic_object_hash");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.saveFileStageSucceeded, false, "upload_diagnostic_save_file_stage");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.dbOperationStage, "save_file", "upload_diagnostic_db_stage");
  assert.equal(uploadDiagnosticPayload.summary.diagnosticReceipt.handlerStage, "upload_file_handler", "upload_diagnostic_handler_stage");
  assertNoSensitiveText(uploadDiagnostic.stdout + uploadDiagnostic.stderr, "live_test_upload_diagnostic");

  const dbProofMissing = run(["--operation", "live_test", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_OPL_WEBUI_CONSUMER_CANARY_URL: goodCanary.baseUrl,
    V22_MEDOPL_PUBLIC_BASE_URL: goodCanary.baseUrl,
    V22_MEDOPL_LIVE_DB_PERSISTENCE_PROOF: "1",
    DATABASE_URL: "",
  });
  assert.notEqual(dbProofMissing.status, 0, "live_db_persistence_proof_must_fail_closed_without_database_url");
  assert(
    (dbProofMissing.stdout + dbProofMissing.stderr).includes("production_goal_live_db_persistence_database_url_missing"),
    "live_db_persistence_missing_database_url_reason",
  );
  assertNoSensitiveText(dbProofMissing.stdout + dbProofMissing.stderr, "live_db_persistence_missing_database_url");

  const emptyBuildDir = path.join(tempDir, "empty-build");
  const emptyManifestDir = path.join(tempDir, "empty-manifest");
  mkdirSync(emptyBuildDir);
  mkdirSync(emptyManifestDir);
  const emptyBuild = run(["--operation", "build_push", "--check-config"], {
    ...baseEnv,
    V22_CONTAINER_DOCKERFILE: path.join(emptyBuildDir, "Dockerfile"),
  });
  assert.notEqual(emptyBuild.status, 0, "build_check_config_must_reject_empty_context");
  const emptyBuildPayload = JSON.parse(emptyBuild.stdout);
  assert.equal(emptyBuildPayload.ok, false, "empty_build_payload");
  assert.deepEqual(emptyBuildPayload.summary.requiredPathMissing, ["V22_CONTAINER_DOCKERFILE"], "empty_build_reason");

  const emptyManifest = run(["--operation", "kubectl", "--check-config"], {
    ...baseEnv,
    V22_KUBERNETES_MANIFEST_DIR: emptyManifestDir,
  });
  assert.notEqual(emptyManifest.status, 0, "kubectl_check_config_must_reject_empty_manifest_dir");
  const emptyManifestPayload = JSON.parse(emptyManifest.stdout);
  assert.equal(emptyManifestPayload.ok, false, "empty_manifest_payload");
  assert.deepEqual(emptyManifestPayload.summary.requiredContentMissing, ["V22_KUBERNETES_MANIFEST_DIR:manifest"], "empty_manifest_reason");

  const deployShortName = parseJson(run(["--operation", "deploy", "--execute", "--confirm-current-session-authorization"], {
    ...baseEnv,
    V22_MEDOPL_DEPLOY_PLAN_FILE: shortDeployPlan,
  }), "deploy_short_name");
  assert.equal(deployShortName.summary.deployment, "deployment/medopl-control-plane", "deploy_runner_must_normalize_short_deployment_name");
  const kubectlArgs = readFileSync(kubectlLog, "utf8");
  assert(
    kubectlArgs.includes("rollout status deployment/medopl-control-plane --timeout=180s"),
    `deploy_runner_must_call_rollout_status_with_resource_kind:${kubectlArgs}`,
  );
} finally {
  for (const server of canaryServers.reverse()) {
    await server.close();
  }
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_production_goal_command_runner",
}, null, 2));
