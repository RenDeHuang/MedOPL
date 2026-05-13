import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const domainRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRootForDomain = path.resolve(domainRoot, "../../../");
const medWorkspaceRoot = path.join(repoRootForDomain, ".runtime", "med-autoscience", "workspaces");

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

function resourceBindingIdFrom(input = {}) {
  return text(input.resourceBindingId || input.resource_binding_id);
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

function workspacePathFor(userId = "", workspaceId = "") {
  return path.join(medWorkspaceRoot, text(userId), text(workspaceId || "default"));
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
      path: workspacePathFor(user.id, workspaceId),
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

function findOwnedBinding(db = {}, user = {}, workspaceId = "", resourceBindingId = "") {
  const bindingId = text(resourceBindingId);
  if (!bindingId) return { ok: false, status: 409, error: "resource_binding_required" };
  const binding = ensureArrayField(db, "workspaceResourceBindings")
    .find((item) => text(item.resourceBindingId || item.id) === bindingId) || null;
  if (!binding) return { ok: false, status: 404, error: "resource_binding_not_found" };
  if (!ownerMatches(binding, user) || !workspaceMatches(binding, workspaceId)) {
    return { ok: false, status: 403, error: "resource_binding_owner_mismatch" };
  }
  return { ok: true, binding };
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
  entitlement.retentionProtectionStatus = status === "retention_protected" ? "active" : text(entitlement.retentionProtectionStatus);
  entitlement.retentionCleanupAfterAt = status === "retention_protected"
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : text(entitlement.retentionCleanupAfterAt);
  entitlement.updatedAt = nowIso();
  binding.fileSpaceGb = capacityGb;
  binding.storageEntitlementId = entitlement.id;
  binding.storageStatus = status;
  if (status === "retention_protected") {
    binding.status = text(binding.computeAllocationId) ? "compute_released_storage_protected" : "storage_protected";
  } else {
    binding.status = text(binding.computeAllocationId) ? "active" : "storage_available";
  }
  binding.updatedAt = nowIso();
  return entitlement;
}

function upsertComputeAllocation(db = {}, user = {}, binding = {}, input = {}, status = "available", attribution = {}) {
  const allocations = ensureArrayField(db, "computeAllocations");
  let allocation = allocations.find((item) => text(item.resourceBindingId) === text(binding.resourceBindingId || binding.id)) || null;
  if (!allocation) {
    allocation = {
      id: `compute-${text(binding.resourceBindingId || binding.id)}`,
      tenantId: userTenantId(user),
      userId: text(user.id),
      workspaceId: text(binding.workspaceId),
      resourceBindingId: text(binding.resourceBindingId || binding.id),
      createdAt: nowIso(),
    };
    allocations.push(allocation);
  }
  allocation.planId = planIdFrom(input, binding.planId);
  allocation.computeUnits = positiveNumber(input.computeUnits ?? input.compute_units, positiveNumber(allocation.computeUnits, 1));
  allocation.status = status;
  allocation.nodePoolRef = text(attribution.nodePoolRef || allocation.nodePoolRef);
  allocation.updatedAt = nowIso();
  binding.computeAllocationId = allocation.id;
  binding.computeStatus = status;
  binding.status = status === "released"
    ? (text(binding.storageEntitlementId) ? "compute_released_storage_retained" : "compute_released")
    : "active";
  binding.updatedAt = nowIso();
  return allocation;
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

const PACKAGE_C_OPERATIONS = Object.freeze({
  create_storage: Object.freeze({
    operationType: "create_storage",
    runnerOperation: "storage-create",
    operationIdKind: "create-storage",
    createsBinding: true,
    resourceKind: "storage",
    successStatus: "available",
  }),
  create_compute: Object.freeze({
    operationType: "create_compute",
    runnerOperation: "compute-create",
    operationIdKind: "create-compute",
    resourceKind: "compute",
    successStatus: "available",
  }),
  expand_storage: Object.freeze({
    operationType: "expand_storage",
    runnerOperation: "storage-expand",
    operationIdKind: "expand-storage",
    resourceKind: "storage",
    successStatus: "available",
  }),
  expand_compute: Object.freeze({
    operationType: "expand_compute",
    runnerOperation: "compute-expand",
    operationIdKind: "expand-compute",
    resourceKind: "compute",
    successStatus: "available",
  }),
  release_compute: Object.freeze({
    operationType: "release_compute",
    runnerOperation: "compute-release",
    operationIdKind: "release-compute",
    resourceKind: "compute",
    successStatus: "released",
  }),
  delete_storage: Object.freeze({
    operationType: "delete_storage",
    runnerOperation: "storage-delete",
    operationIdKind: "delete-storage",
    resourceKind: "storage",
    successStatus: "retention_protected",
  }),
});

function targetDesiredCapacityFrom(input = {}) {
  const normalized = text(input.targetDesiredCapacity ?? input.target_desired_capacity);
  if (!/^[0-9]+$/.test(normalized)) return "";
  return normalized;
}

function baselineCapacityFrom(value = 2) {
  const normalized = text(value);
  if (!/^[0-9]+$/.test(normalized)) return 2;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) return 2;
  return parsed;
}

function providerTargetDesiredCapacityFrom(input = {}, options = {}) {
  const requested = targetDesiredCapacityFrom(input);
  if (requested === "") return "";
  const baseline = baselineCapacityFrom(options.computePoolBaselineCapacity ?? input.computePoolBaselineCapacity ?? 2);
  return String(Math.max(Number(requested), baseline));
}

function validateProductionOperationInput(input = {}, spec = {}) {
  if (!workspaceIdFrom(input)) return { ok: false, status: 422, error: "workspace_required" };
  if (!spec.createsBinding && !resourceBindingIdFrom(input)) return { ok: false, status: 409, error: "resource_binding_required" };
  if ((spec.operationType === "create_storage" || spec.operationType === "expand_storage") && positiveNumber(input.fileSpaceGb ?? input.file_space_gb, 0) <= 0) {
    return { ok: false, status: 422, error: "file_space_required" };
  }
  if (spec.resourceKind === "compute" && targetDesiredCapacityFrom(input) === "") {
    return { ok: false, status: 422, error: "target_desired_capacity_required" };
  }
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

function runPackageCOperation({ repoRoot, runnerScript, secretFile, operationId, workspaceId, runnerMode, spec, input = {} }) {
  if (!secretFile) {
    return { ok: false, status: 503, error: "cloud_operation_secret_file_required" };
  }
  const dryRun = runNodeJson({
    repoRoot,
    script: runnerScript,
    label: `package_c_${spec.runnerOperation}_dry_run`,
    args: [
      "--dry-run",
      "--secret-file",
      secretFile,
      "--operation",
      spec.runnerOperation,
      "--run-id",
      operationId,
    ],
  });
  if (!dryRun.ok) return dryRun;
  const executeArgs = [
    "--execute",
    "--sdk-mode",
    runnerMode,
    "--secret-file",
    secretFile,
    "--operation",
    spec.runnerOperation,
    "--run-id",
    operationId,
    "--accepted-dry-run-id",
    `${operationId}-${spec.runnerOperation}`,
    "--workspace-id",
    workspaceId,
  ];
  if (spec.resourceKind === "compute") {
    executeArgs.push("--target-desired-capacity", text(input.providerTargetDesiredCapacity || targetDesiredCapacityFrom(input)));
  }
  const execute = runNodeJson({
    repoRoot,
    script: runnerScript,
    label: `package_c_${spec.runnerOperation}_execute`,
    args: executeArgs,
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

function createOperationRecord(db = {}, user = {}, binding = {}, input = {}, operationId = "", spec = PACKAGE_C_OPERATIONS.create_storage, options = {}) {
  const id = operationId || operationIdFor(spec.operationIdKind);
  const operation = {
    id,
    operationId: id,
    tenantId: userTenantId(user),
    userId: text(user.id),
    workspaceId: text(binding.workspaceId),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    operationType: spec.operationType,
    status: "queued",
    testOnly: false,
    productionPortalConnected: true,
    runnerMode: "",
    realCloudCalls: false,
    acceptedDryRunId: id,
    dryRunReportRef: "",
    executionReportRef: "",
    requestedSpec: {
      fileSpaceGb: positiveNumber(input.fileSpaceGb ?? input.file_space_gb, positiveNumber(binding.fileSpaceGb, 0)),
      computeUnits: positiveNumber(input.computeUnits ?? input.compute_units, 0),
      targetDesiredCapacity: targetDesiredCapacityFrom(input),
      providerTargetDesiredCapacity: spec.resourceKind === "compute" ? providerTargetDesiredCapacityFrom(input, options) : "",
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
    queueMode: "independent_worker",
    status: "queued",
    runnerMode: "",
    realCloudCalls: false,
    dryRunReportRef: "",
    executionReportRef: "",
    leaseOwner: "",
    leaseAcquiredAt: "",
    failureReason: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  ensureArrayField(db, "cloudOperationJobs").push(job);
  return job;
}

function markOperationRunning(operation = {}, job = {}, runnerMode = "", workerId = "") {
  const now = nowIso();
  operation.status = "running";
  operation.runnerMode = runnerMode;
  operation.realCloudCalls = runnerMode === "tencent-official-sdk-live";
  operation.startedAt = now;
  operation.updatedAt = now;
  job.status = "running";
  job.runnerMode = runnerMode;
  job.realCloudCalls = operation.realCloudCalls;
  job.leaseOwner = text(workerId || job.leaseOwner);
  job.leaseAcquiredAt = now;
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

export function executePortalProductionCloudOperation(db = {}, user = {}, input = {}, options = {}) {
  const spec = PACKAGE_C_OPERATIONS[text(options.operationType || input.operationType || input.operation_type)];
  if (!spec) return { ok: false, status: 422, error: "unsupported_operation_type" };
  const validation = validateProductionOperationInput(input, spec);
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
  const operationId = operationIdFor(spec.operationIdKind);

  ensureWorkspace(db, user, workspaceId, planId);
  let binding = null;
  if (spec.createsBinding) {
    binding = createBinding(db, user, workspaceId, planId);
  } else {
    const found = findOwnedBinding(db, user, workspaceId, resourceBindingIdFrom(input));
    if (!found.ok) return found;
    binding = found.binding;
  }
  binding.planId = planId;
  binding.serverPlanId = planId;
  binding.packageId = planId;
  const operation = createOperationRecord(db, user, binding, input, operationId, spec, options);
  const job = createJobRecord(db, user, binding, operation);
  appendAuditEvent(db, user, binding, operation);

  return {
    ok: true,
    workerExecutedNow: false,
    productionPortalConnected: true,
    operation: operationPublicView(operation),
    resourceBindingId: text(binding.resourceBindingId || binding.id),
    publicProjection: publicProjectionForBinding(db, user, binding),
  };
}

export function executePortalProductionStorageCreate(db = {}, user = {}, input = {}, options = {}) {
  return executePortalProductionCloudOperation(db, user, input, {
    ...options,
    operationType: "create_storage",
  });
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
  return {
    ok: true,
    productionPortalConnected: true,
    ...publicProjectionForBinding(db, user, binding),
  };
}

function operationById(db = {}, operationId = "") {
  return ensureArrayField(db, "cloudOperations")
    .find((item) => text(item.operationId || item.id) === text(operationId)) || null;
}

function bindingById(db = {}, bindingId = "") {
  return ensureArrayField(db, "workspaceResourceBindings")
    .find((item) => text(item.resourceBindingId || item.id) === text(bindingId)) || null;
}

function userForOperation(operation = {}) {
  return {
    id: text(operation.userId),
    tenantId: text(operation.tenantId || operation.userId),
  };
}

function inputFromOperation(operation = {}) {
  return {
    workspaceId: text(operation.workspaceId),
    resourceBindingId: text(operation.resourceBindingId),
    ...(operation.requestedSpec || {}),
  };
}

function applyRunnerSuccess(db = {}, operation = {}, job = {}, runner = {}, attribution = {}) {
  const spec = PACKAGE_C_OPERATIONS[text(operation.operationType)];
  const binding = bindingById(db, operation.resourceBindingId);
  if (!spec || !binding) {
    markOperationFailed(operation, job, {
      error: spec ? "resource_binding_not_found" : "unsupported_operation_type",
      runnerMode: text(job.runnerMode || operation.runnerMode),
      realCloudCalls: Boolean(operation.realCloudCalls),
    });
    return { ok: false, error: operation.failureReason };
  }
  const user = userForOperation(operation);
  const input = inputFromOperation(operation);
  if (spec.resourceKind === "storage") {
    upsertFileSpaceEntitlement(db, user, binding, input, spec.successStatus);
  } else {
    const nodePoolRef = text(attribution.computeNodePoolRef);
    if (!nodePoolRef) {
      markOperationFailed(operation, job, {
        error: "compute_node_pool_ref_required",
        runnerMode: text(job.runnerMode || operation.runnerMode),
        realCloudCalls: Boolean(operation.realCloudCalls),
      });
      return { ok: false, error: "compute_node_pool_ref_required" };
    }
    upsertComputeAllocation(db, user, binding, input, spec.successStatus, {
      nodePoolRef,
    });
  }
  markOperationSucceeded(operation, job, runner);
  upsertFreeze(db, user, binding, operation);
  appendLedger(db, user, binding, operation);
  appendBillingReconciliation(db, user, binding, operation);
  appendAuditEvent(db, user, binding, operation);
  upsertProjection(db, user, binding, operation, runner);
  return { ok: true };
}

function processOneQueuedJob(db = {}, job = {}, options = {}) {
  const operation = operationById(db, job.operationId);
  if (!operation) {
    job.status = "failed";
    job.failureReason = "cloud_operation_not_found";
    job.updatedAt = nowIso();
    return { ok: false, error: "cloud_operation_not_found", jobId: text(job.id) };
  }
  const spec = PACKAGE_C_OPERATIONS[text(operation.operationType)];
  if (!spec) {
    markOperationFailed(operation, job, { error: "unsupported_operation_type" });
    return { ok: false, error: "unsupported_operation_type", operationId: text(operation.operationId || operation.id) };
  }
  if (spec.resourceKind === "compute" && !text(options.computeNodePoolRef)) {
    markOperationFailed(operation, job, {
      error: "compute_node_pool_ref_required",
      runnerMode: text(options.runnerMode || operation.runnerMode || job.runnerMode || "fake-live"),
      realCloudCalls: text(options.runnerMode || "") === "tencent-official-sdk-live",
    });
    return { ok: false, error: "compute_node_pool_ref_required", operationId: text(operation.operationId || operation.id) };
  }
  const runnerMode = text(options.runnerMode || "fake-live");
  markOperationRunning(operation, job, runnerMode, options.workerId || "portal-cloud-worker");
  const runner = runPackageCOperation({
    repoRoot: path.resolve(options.repoRoot || path.resolve(process.cwd())),
    runnerScript: text(options.runnerScript || "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs"),
    secretFile: text(options.secretFile),
    operationId: text(operation.operationId || operation.id),
    workspaceId: text(operation.workspaceId),
    runnerMode,
    spec,
    input: inputFromOperation(operation),
  });
  if (!runner.ok) {
    markOperationFailed(operation, job, { ...runner, runnerMode, realCloudCalls: runnerMode === "tencent-official-sdk-live" });
    return { ok: false, error: operation.failureReason, operationId: text(operation.operationId || operation.id) };
  }
  const applied = applyRunnerSuccess(db, operation, job, runner, {
    computeNodePoolRef: options.computeNodePoolRef,
  });
  if (!applied.ok) return { ...applied, operationId: text(operation.operationId || operation.id) };
  return {
    ok: true,
    operationId: text(operation.operationId || operation.id),
    operationType: text(operation.operationType),
  };
}

export function processQueuedPortalProductionCloudOperations(db = {}, options = {}) {
  const maxOperations = Math.max(1, Number(options.maxOperations || 1));
  const queuedJobs = ensureArrayField(db, "cloudOperationJobs")
    .filter((job) => text(job.status) === "queued")
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))
    .slice(0, maxOperations);
  const processed = [];
  for (const job of queuedJobs) {
    const result = processOneQueuedJob(db, job, options);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        processed,
        blockedOperationId: result.operationId || "",
      };
    }
    processed.push(result);
  }
  return {
    ok: true,
    processed,
  };
}
