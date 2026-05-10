import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

function text(value) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function ensureArrayField(db, key) {
  db[key] = Array.isArray(db[key]) ? db[key] : [];
  return db[key];
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function ownerMatches(item = {}, user = {}) {
  return text(item.tenantId || item.ownerTenantId) === userTenantId(user)
    && text(item.userId || item.ownerUserId) === text(user.id);
}

function workspaceMatches(item = {}, workspaceId = "") {
  return text(item.workspaceId) === text(workspaceId);
}

function workspaceIdFrom(input = {}) {
  return text(input.workspaceId || input.workspace_id);
}

function planIdFrom(input = {}, fallback = "starter_2c4g_10gb") {
  return text(input.planId || input.plan_id || fallback) || fallback;
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function safeIdPart(value = "") {
  return text(value).replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function operationIdFor(kind = "storage-create") {
  return `op-${randomUUID()}-${safeIdPart(kind)}`;
}

function bindingAuditTag(user = {}, workspaceId = "") {
  return `tenant:${userTenantId(user)}/user:${text(user.id)}/workspace:${workspaceId}`;
}

function bindingCostTag(user = {}, workspaceId = "") {
  return `medopl:v22:${userTenantId(user)}:${workspaceId}`;
}

function ensureWorkspace(db = {}, user = {}, workspaceId = "", planId = "starter_2c4g_10gb") {
  const workspaces = ensureArrayField(db, "taskSpaces");
  let workspace = workspaces.find((item) => ownerMatches(item, user) && text(item.slug || item.workspaceId || item.id) === workspaceId);
  if (!workspace) {
    workspace = {
      id: workspaceId,
      slug: workspaceId,
      workspaceId,
      tenantId: userTenantId(user),
      userId: text(user.id),
      ownerTenantId: userTenantId(user),
      ownerUserId: text(user.id),
      title: workspaceId,
      status: "active",
      serverPlanId: planId,
      createdAt: nowIso(),
    };
    workspaces.push(workspace);
  }
  workspace.serverPlanId = planId;
  workspace.updatedAt = nowIso();
  return workspace;
}

function createBinding(db = {}, user = {}, workspaceId = "", planId = "starter_2c4g_10gb") {
  const id = `rb-${randomUUID()}`;
  const binding = {
    id,
    resourceBindingId: id,
    tenantId: userTenantId(user),
    userId: text(user.id),
    ownerTenantId: userTenantId(user),
    ownerUserId: text(user.id),
    workspaceId,
    planId,
    packageId: planId,
    serverPlanId: planId,
    status: "provisioning",
    billingAccountId: userTenantId(user),
    auditTag: bindingAuditTag(user, workspaceId),
    costAllocationTag: bindingCostTag(user, workspaceId),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "workspaceResourceBindings").push(binding);
  return binding;
}

function latestForBinding(rows = [], binding = {}) {
  const bindingId = text(binding?.resourceBindingId || binding?.id);
  return rows
    .filter((item) => text(item.resourceBindingId) === bindingId)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
}

function upsertFileSpaceEntitlement(db = {}, user = {}, binding = {}, input = {}, status = "available") {
  const entitlements = ensureArrayField(db, "fileSpaceEntitlements");
  const capacityGb = positiveNumber(input.fileSpaceGb ?? input.file_space_gb, positiveNumber(binding.fileSpaceGb, 10));
  let entitlement = entitlements.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!entitlement) {
    entitlement = {
      id: `fs-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      createdAt: nowIso(),
    };
    entitlements.push(entitlement);
  }
  entitlement.capacityGb = capacityGb;
  entitlement.planId = planIdFrom(input, binding.planId);
  entitlement.status = status;
  entitlement.retentionProtectionStatus = text(entitlement.retentionProtectionStatus);
  entitlement.retentionCleanupAfterAt = text(entitlement.retentionCleanupAfterAt);
  entitlement.updatedAt = nowIso();
  binding.fileSpaceGb = capacityGb;
  binding.storageEntitlementId = entitlement.id;
  binding.storageStatus = status;
  binding.status = "storage_available";
  binding.updatedAt = nowIso();
  return entitlement;
}

function upsertFreeze(db = {}, user = {}, binding = {}, operation = {}) {
  const freezes = ensureArrayField(db, "weeklyProtectionFreezes");
  let freeze = freezes.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!freeze) {
    freeze = {
      id: `freeze-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      status: "active",
      preauthStatus: "estimated",
      frozenAmountCents: 0,
      operationId: text(operation.operationId || operation.id),
      createdAt: nowIso(),
    };
    freezes.push(freeze);
  }
  freeze.updatedAt = nowIso();
  return freeze;
}

function appendLedger(db = {}, user = {}, binding = {}, operation = {}) {
  ensureArrayField(db, "ledger").push({
    id: `ledger-${randomUUID()}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    sourceType: "cloud_operation",
    sourceId: text(operation.operationId || operation.id),
    type: "cloud_operation_freeze",
    amount: 0,
    amountCents: 0,
    currency: "CNY",
    status: "estimated",
    reason: text(operation.operationType),
    createdAt: nowIso(),
  });
}

function appendBillingReconciliation(db = {}, user = {}, binding = {}, operation = {}) {
  ensureArrayField(db, "billingReconciliations").push({
    id: `recon-${operation.operationId || operation.id}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationId: text(operation.operationId || operation.id),
    status: "reconciling",
    statusLabel: "对账中",
    source: "portal_production_cloud_operation",
    billingReadRef: "",
    auditQueueRef: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function appendAuditEvent(db = {}, user = {}, binding = {}, operation = {}) {
  ensureArrayField(db, "auditEvents").push({
    id: `audit-${operation.operationId || operation.id}`,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationId: text(operation.operationId || operation.id),
    action: `portal_cloud_operation_${text(operation.operationType)}`,
    type: `portal_cloud_operation_${text(operation.operationType)}`,
    status: text(operation.status || "recorded"),
    decision: "accepted",
    reason: "user_requested_portal_cloud_operation",
    createdAt: nowIso(),
  });
}

function upsertProjection(db = {}, user = {}, binding = {}, operation = {}, runner = {}) {
  const projections = ensureArrayField(db, "cloudResourceProjections");
  let projection = projections.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!projection) {
    projection = {
      id: `projection-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      createdAt: nowIso(),
    };
    projections.push(projection);
  }
  projection.status = "updated";
  projection.productionPortalConnected = true;
  projection.runnerMode = text(runner.runnerMode || operation.runnerMode);
  projection.realCloudCalls = Boolean(runner.realCloudCalls || operation.realCloudCalls);
  projection.lastOperationId = text(operation.operationId || operation.id);
  projection.visibleSummary = {
    resources: publicProjectionForBinding(db, user, binding).resources,
    billing: publicProjectionForBinding(db, user, binding).billing,
  };
  projection.updatedAt = nowIso();
  return projection;
}

function fileSpaceStatusLabel(status = "") {
  if (status === "retention_protected") return "文件保护期";
  if (status === "expanding") return "扩容中";
  if (status === "available") return "可用";
  return "未开通";
}

function computeStatusLabel(status = "") {
  if (status === "released") return "已释放";
  if (status === "scaling") return "扩容中";
  if (status === "available") return "可用";
  return "未开通";
}

function publicProjectionForBinding(db = {}, user = {}, binding = null) {
  const fileSpace = latestForBinding(ensureArrayField(db, "fileSpaceEntitlements"), binding);
  const compute = latestForBinding(ensureArrayField(db, "computeAllocations"), binding);
  const reconciliation = latestForBinding(ensureArrayField(db, "billingReconciliations"), binding);
  const computeStatus = text(compute?.status || "none");
  const fileSpaceStatus = text(fileSpace?.status || "none");
  return {
    workspaceId: text(binding?.workspaceId),
    resourceBindingId: text(binding?.resourceBindingId || binding?.id),
    visibleConcepts: ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"],
    resources: {
      workbench: {
        statusLabel: binding ? "可用" : "未开通",
      },
      compute: {
        statusLabel: computeStatusLabel(computeStatus),
        computeUnits: Number(compute?.computeUnits || 0),
        planId: text(compute?.planId || binding?.planId),
      },
      fileSpace: {
        statusLabel: fileSpaceStatusLabel(fileSpaceStatus),
        capacityGb: Number(fileSpace?.capacityGb || binding?.fileSpaceGb || 0),
      },
    },
    billing: {
      reconciliationStatusLabel: text(reconciliation?.statusLabel || "对账中"),
    },
    userNarrative: {
      statusLabel: fileSpaceStatus === "retention_protected" ? "文件保护期" : "可用",
      visibleConcepts: ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"],
    },
  };
}

function operationPublicView(operation = {}) {
  return {
    id: text(operation.id || operation.operationId),
    operationId: text(operation.operationId || operation.id),
    operationType: text(operation.operationType),
    status: text(operation.status),
    dryRunReportRef: text(operation.dryRunReportRef),
    executionReportRef: text(operation.executionReportRef),
  };
}

function validateStorageCreate(input = {}) {
  if (!workspaceIdFrom(input)) return { ok: false, status: 422, error: "workspace_required" };
  if (positiveNumber(input.fileSpaceGb ?? input.file_space_gb, 0) <= 0) return { ok: false, status: 422, error: "file_space_required" };
  return { ok: true };
}

function parseJsonOutput(result = {}, label = "") {
  if (result.status !== 0) {
    return {
      ok: false,
      status: 502,
      error: `${label}_failed`,
      runnerStatus: result.status,
    };
  }
  try {
    return JSON.parse(String(result.stdout || "").trim());
  } catch {
    return {
      ok: false,
      status: 502,
      error: `${label}_invalid_json`,
    };
  }
}

function assertRunnerOutputSafe(value = "", label = "") {
  if (/SecretId|SecretKey|token|kubeconfig|objectKey|storageKey|cosPrefix|signedUrl|raw response|rawResponse|providerRawResponse|authorization|header/i.test(String(value || ""))) {
    throw new Error(`portal_cloud_operation_runner_output_not_sanitized:${label}`);
  }
}

function runNodeJson({ repoRoot, script, args, label }) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assertRunnerOutputSafe(result.stdout, `${label}:stdout`);
  assertRunnerOutputSafe(result.stderr, `${label}:stderr`);
  return parseJsonOutput(result, label);
}

function runPackageCStorageCreate({ repoRoot, runnerScript, secretFile, operationId, workspaceId, runnerMode }) {
  if (!secretFile) {
    return { ok: false, status: 503, error: "cloud_operation_secret_file_required" };
  }
  const dryRun = runNodeJson({
    repoRoot,
    script: runnerScript,
    label: "package_c_storage_create_dry_run",
    args: [
      "--dry-run",
      "--secret-file",
      secretFile,
      "--operation",
      "storage-create",
      "--run-id",
      operationId,
    ],
  });
  if (!dryRun.ok) return dryRun;
  const execute = runNodeJson({
    repoRoot,
    script: runnerScript,
    label: "package_c_storage_create_execute",
    args: [
      "--execute",
      "--sdk-mode",
      runnerMode,
      "--secret-file",
      secretFile,
      "--operation",
      "storage-create",
      "--run-id",
      operationId,
      "--accepted-dry-run-id",
      `${operationId}-storage-create`,
      "--workspace-id",
      workspaceId,
    ],
  });
  if (!execute.ok) return execute;
  return {
    ok: true,
    runnerMode,
    realCloudCalls: runnerMode === "tencent-official-sdk-live",
    dryRunReportRef: text(dryRun.reportPath),
    executionReportRef: text(execute.reportPath),
    dryRun,
    execute,
  };
}

function createOperationRecord(db = {}, user = {}, binding = {}, input = {}, operationId = "") {
  const id = operationId || operationIdFor("storage-create");
  const operation = {
    id,
    operationId: id,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationType: "create_storage",
    status: "queued",
    testOnly: false,
    productionPortalConnected: true,
    runnerMode: "",
    realCloudCalls: false,
    acceptedDryRunId: id,
    dryRunReportRef: "",
    executionReportRef: "",
    requestedSpec: {
      fileSpaceGb: positiveNumber(input.fileSpaceGb ?? input.file_space_gb, 0),
      planId: planIdFrom(input),
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "cloudOperations").push(operation);
  return operation;
}

function createJobRecord(db = {}, user = {}, binding = {}, operation = {}) {
  const job = {
    id: `job-${text(operation.operationId || operation.id)}`,
    operationId: text(operation.operationId || operation.id),
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    queueMode: "inline_worker",
    status: "queued",
    runnerMode: "",
    realCloudCalls: false,
    dryRunReportRef: "",
    executionReportRef: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "cloudOperationJobs").push(job);
  return job;
}

function markOperationRunning(operation = {}, job = {}, runnerMode = "") {
  const now = nowIso();
  operation.status = "running";
  operation.runnerMode = runnerMode;
  operation.realCloudCalls = runnerMode === "tencent-official-sdk-live";
  operation.startedAt = now;
  operation.updatedAt = now;
  job.status = "running";
  job.runnerMode = runnerMode;
  job.realCloudCalls = operation.realCloudCalls;
  job.startedAt = now;
  job.updatedAt = now;
}

function markOperationFailed(operation = {}, job = {}, runner = {}) {
  const now = nowIso();
  operation.status = "failed";
  operation.runnerMode = text(runner.runnerMode || operation.runnerMode);
  operation.realCloudCalls = Boolean(runner.realCloudCalls || operation.realCloudCalls);
  operation.failureReason = text(runner.error || runner.blockedReason || "cloud_operation_runner_failed");
  operation.updatedAt = now;
  job.status = "failed";
  job.runnerMode = operation.runnerMode;
  job.realCloudCalls = operation.realCloudCalls;
  job.failureReason = operation.failureReason;
  job.updatedAt = now;
}

function markOperationSucceeded(operation = {}, job = {}, runner = {}) {
  const now = nowIso();
  operation.status = "succeeded";
  operation.runnerMode = text(runner.runnerMode);
  operation.realCloudCalls = Boolean(runner.realCloudCalls);
  operation.dryRunReportRef = text(runner.dryRunReportRef);
  operation.executionReportRef = text(runner.executionReportRef);
  operation.updatedAt = now;
  job.status = "succeeded";
  job.runnerMode = operation.runnerMode;
  job.realCloudCalls = operation.realCloudCalls;
  job.dryRunReportRef = operation.dryRunReportRef;
  job.executionReportRef = operation.executionReportRef;
  job.updatedAt = now;
}

export function executePortalProductionStorageCreate(db = {}, user = {}, input = {}, options = {}) {
  const validation = validateStorageCreate(input);
  if (!validation.ok) return validation;

  const runnerMode = text(options.runnerMode || "fake-live");
  if (!["fake-live", "tencent-official-sdk-live"].includes(runnerMode)) {
    return { ok: false, status: 503, error: "cloud_operation_runner_mode_invalid" };
  }

  const repoRoot = path.resolve(options.repoRoot || path.resolve(process.cwd(), "../.."));
  const runnerScript = text(options.runnerScript || "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs");
  const secretFile = text(options.secretFile);
  const workspaceId = workspaceIdFrom(input);
  const planId = planIdFrom(input);
  const operationId = operationIdFor("storage-create");

  ensureWorkspace(db, user, workspaceId, planId);
  const binding = createBinding(db, user, workspaceId, planId);
  const operation = createOperationRecord(db, user, binding, input, operationId);
  const job = createJobRecord(db, user, binding, operation);
  appendAuditEvent(db, user, binding, operation);
  markOperationRunning(operation, job, runnerMode);

  const runner = runPackageCStorageCreate({
    repoRoot,
    runnerScript,
    secretFile,
    operationId,
    workspaceId,
    runnerMode,
  });
  if (!runner.ok) {
    binding.status = "provision_failed";
    binding.updatedAt = nowIso();
    markOperationFailed(operation, job, { ...runner, runnerMode, realCloudCalls: runnerMode === "tencent-official-sdk-live" });
    appendAuditEvent(db, user, binding, operation);
    return {
      ...runner,
      persistDb: true,
      productionPortalConnected: true,
      operation: operationPublicView(operation),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
    };
  }

  upsertFileSpaceEntitlement(db, user, binding, input, "available");
  markOperationSucceeded(operation, job, runner);
  upsertFreeze(db, user, binding, operation);
  appendLedger(db, user, binding, operation);
  appendBillingReconciliation(db, user, binding, operation);
  appendAuditEvent(db, user, binding, operation);
  upsertProjection(db, user, binding, operation, runner);

  return {
    ok: true,
    productionPortalConnected: true,
    operation: operationPublicView(operation),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    publicProjection: publicProjectionForBinding(db, user, binding),
  };
}

export function buildPortalProductionCloudOperationProjection(db = {}, user = {}, { workspaceId = "" } = {}) {
  const targetWorkspaceId = text(workspaceId || user.currentTaskSlug || "");
  if (!targetWorkspaceId) return { ok: false, status: 422, error: "workspace_required" };
  const binding = ensureArrayField(db, "workspaceResourceBindings")
    .filter((item) => ownerMatches(item, user))
    .filter((item) => workspaceMatches(item, targetWorkspaceId))
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))[0] || null;
  if (!binding) {
    return {
      ok: true,
      productionPortalConnected: true,
      workspaceId: targetWorkspaceId,
      visibleConcepts: ["工作台资源", "计算资源", "文件空间", "套餐", "余额", "冻结金额"],
      resources: {
        workbench: { statusLabel: "未开通" },
        compute: { statusLabel: "未开通", computeUnits: 0, planId: "" },
        fileSpace: { statusLabel: "未开通", capacityGb: 0 },
      },
      billing: { reconciliationStatusLabel: "对账中" },
    };
  }
  const operation = latestForBinding(ensureArrayField(db, "cloudOperations"), binding);
  return {
    ok: true,
    productionPortalConnected: true,
    ...publicProjectionForBinding(db, user, binding),
  };
}
