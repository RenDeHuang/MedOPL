import {
  createPayloadTimingRecorder,
  paginateRows,
} from "./portal-page-payload-primitives.mjs";
import {
  buildWorkspaceTaskCards,
  sumFileSizes,
  summarizeRunStatus,
} from "./portal-page-payload-helpers.mjs";
import {
  billingItemsForRun,
  publicBalanceLink,
  publicCostEstimate,
  publicResourceUsage,
} from "../domain/cost-balance-trace-linkage.mjs";
import {
  findManagedResourceBinding,
  managedResourceBindingPlanView,
} from "../domain/managed-resource-binding-plan-view.mjs";
import { buildPortalFileSpacePayload } from "../domain/portal-file-space-management.mjs";

function text(value = "") {
  return String(value ?? "").trim();
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function isVisibleWorkspaceFile(file = {}) {
  return text(file.status || "active").toLowerCase() !== "deleted";
}

function runtimeBridgeOutputFilesForWorkspace(db = {}, user = {}, workspaceId = "") {
  const tenantId = userTenantId(user);
  return (Array.isArray(db.workspaceFiles) ? db.workspaceFiles : [])
    .filter((item) => text(item.userId || item.user_id) === text(user.id))
    .filter((item) => !tenantId || text(item.tenantId || item.tenant_id) === tenantId)
    .filter((item) => text(item.workspaceId || item.workspace_id) === text(workspaceId))
    .filter((item) => text(item.kind) === "outputs")
    .filter(isVisibleWorkspaceFile)
    .sort((left, right) => String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || "")))
    .map((item) => {
      const fileRef = text(item.id || item.fileRef || item.file_ref);
      return {
        name: text(item.name || item.fileName || item.file_name),
        fullPath: text(item.relativePath || item.relative_path || item.name),
        artifactRef: fileRef,
        fileRef,
        runId: text(item.runId || item.run_id),
        sessionId: text(item.sessionId || item.session_id || item.oplSessionId || item.opl_session_id || item.runId || item.run_id),
        workspaceId: text(item.workspaceId || item.workspace_id),
        kind: "outputs",
        sizeBytes: Number(item.sizeBytes || item.size_bytes || 0),
        contentType: text(item.contentType || item.content_type),
        status: text(item.status || "active"),
        source: text(item.source || "runtime_bridge_artifact_reference").startsWith("runtime_bridge_artifact_reference")
          ? "runtime_bridge_artifact_reference"
          : text(item.source || "runtime_bridge_artifact_reference"),
        createdAt: text(item.createdAt || item.created_at),
        updatedAt: text(item.updatedAt || item.updated_at),
      };
    });
}

function mergeOutputRows(filesystemOutputs = [], artifactOutputs = []) {
  const rows = [...artifactOutputs];
  const seen = new Set(rows.map((item) => item.artifactRef || `${item.name}:${item.fullPath}`).filter(Boolean));
  for (const item of filesystemOutputs) {
    const key = item.artifactRef || `${item.name}:${item.fullPath}`;
    if (key && seen.has(key)) continue;
    rows.push(item);
    if (key) seen.add(key);
  }
  return rows;
}

function runCostSummary(billing = {}, run = {}, workspaceId = "") {
  const relatedCosts = billingItemsForRun(billing?.items || [], { runId: run.runId, workspaceId });
  const costEstimate = publicCostEstimate(billing || {}, relatedCosts);
  return {
    resourceUsage: publicResourceUsage({
      run,
      relatedCosts,
    }),
    costEstimate,
    balanceLink: publicBalanceLink(costEstimate),
  };
}

function outputCostSummary(billing = {}, output = {}, workspaceId = "") {
  const relatedCosts = billingItemsForRun(billing?.items || [], { runId: output.runId, workspaceId });
  const costEstimate = publicCostEstimate(billing || {}, relatedCosts);
  return {
    ...output,
    resourceUsage: workspaceResourceUsageView(publicResourceUsage({
      row: {
        runId: output.runId,
        sessionId: output.sessionId,
        workspaceId: output.workspaceId || workspaceId,
        status: output.status || "active",
      },
      outputFiles: [output],
      relatedCosts,
    })),
    costEstimate,
    balanceLink: publicBalanceLink(costEstimate),
  };
}

function workspaceResourceUsageView(resourceUsage = {}) {
  return {
    source: text(resourceUsage.source),
    runId: text(resourceUsage.runId),
    sessionId: text(resourceUsage.sessionId),
    workspaceId: text(resourceUsage.workspaceId),
    status: text(resourceUsage.status),
    latencyMs: Number(resourceUsage.latencyMs || 0),
    inputFileCount: Number(resourceUsage.inputFileCount || 0),
    outputFileCount: Number(resourceUsage.outputFileCount || 0),
    outputBytes: Number(resourceUsage.outputBytes || 0),
    costItemCount: Number(resourceUsage.costItemCount || 0),
  };
}

function publicStorageEntitlementView(storageEntitlement = {}) {
  return {
    enabled: Boolean(storageEntitlement.enabled),
    status: text(storageEntitlement.status || (storageEntitlement.enabled ? "active" : "disabled")),
    freeQuotaGb: Number(storageEntitlement.freeQuotaGb || 0),
    minimumPurchaseGb: Number(storageEntitlement.minimumPurchaseGb || 10),
    retentionPolicy: text(storageEntitlement.retentionPolicy || "workspace_lifecycle"),
    resourceBindingId: text(storageEntitlement.resourceBindingId),
    billingAttributionId: text(storageEntitlement.billingAttributionId),
    accountId: text(storageEntitlement.accountId),
    legacyResourceOrderId: text(storageEntitlement.legacyResourceOrderId),
    storagePlanId: text(storageEntitlement.storagePlanId),
    serverPlanId: text(storageEntitlement.serverPlanId || storageEntitlement.storagePlanId),
    storageSizeGb: Number(storageEntitlement.storageSizeGb || storageEntitlement.capacityGb || 0),
    message: text(storageEntitlement.message || (storageEntitlement.enabled ? "active" : "storage_required")),
  };
}

export function createWorkspacePayloadBuilder({
  collectRunsForUser,
  currentServerPlanSelection,
  defaultTaskTitle,
  ensureTaskSpace,
  fetchBillingSummary,
  findTaskSpace,
  formatDateTime,
  isRunTerminal,
  latestActiveWorkspaceSession,
  listFilesRecursive,
  listTaskSpacesForUser,
  mkdir,
  path,
  readPortalEvents,
  sanitizeTaskTitle,
  stat,
  workspaceStorageEntitlement,
}) {
  return async function buildWorkspacePayload(db, user, taskSlug, options = {}) {
    const timing = createPayloadTimingRecorder();
    const currentTask = findTaskSpace(db, user.id, taskSlug) || await ensureTaskSpace(db, user, taskSlug, defaultTaskTitle(taskSlug));
    const current = {
      ...currentTask,
      title: sanitizeTaskTitle(currentTask.slug || "default", currentTask.title || ""),
    };
    const allTasks = listTaskSpacesForUser(db, user.id);
    const inputDir = path.join(current.path, "inputs");
    const outputDir = path.join(current.path, "outputs");
    await mkdir(inputDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    const files = await listFilesRecursive(inputDir);
    const filesystemOutputs = await listFilesRecursive(outputDir);
    const artifactOutputs = runtimeBridgeOutputFilesForWorkspace(db, user, current.slug);
    const outputs = mergeOutputRows(filesystemOutputs, artifactOutputs);
    const userRuns = await collectRunsForUser(user.id, { workspaceId: current.slug, limit: 50 });
    const runs = userRuns;
    timing.mark("runs");
    const billing = await fetchBillingSummary(user.id, current.slug, "168h");
    timing.mark("billing");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    const managedBinding = findManagedResourceBinding(db, user, current.slug);
    const managedResourceBindingPlan = managedResourceBindingPlanView({
      binding: managedBinding,
      taskSpace: current,
      billing,
    });
    const events = await readPortalEvents({ limit: 200, userId: user.id, workspaceId: current.slug });
    timing.mark("events");
    const activeSession = latestActiveWorkspaceSession(db, user.id, current.slug);
    const storageEntitlement = workspaceStorageEntitlement(db, user, current.slug);
    const publicStorageEntitlement = publicStorageEntitlementView(storageEntitlement);
    const fileSpace = buildPortalFileSpacePayload({
      db,
      user,
      workspaceId: current.slug,
      storageEntitlement,
    });
    const runRows = runs.map((run) => ({
      ...run,
      ...runCostSummary(billing, run, current.slug),
    }));
    const outputRows = outputs.map((output) => outputCostSummary(billing, output, current.slug));
    const runPagination = paginateRows(runRows, options.runsPage, 5);
    const filePagination = paginateRows(files, options.inputsPage, 5);
    const outputPagination = paginateRows(outputRows, options.outputsPage, 5);
    const taskPagination = paginateRows(allTasks, options.tasksPage, 5);
    const billingAll = await fetchBillingSummary(user.id, "", "168h");
    const taskCards = await buildWorkspaceTaskCards({
      pagedTasks: taskPagination.rows,
      pathApi: path,
      listFilesRecursive,
      userRuns,
      billingItems: billingAll?.items || [],
      formatDateTime,
    });
    return {
      workspace: {
        slug: current.slug,
        title: current.title,
        status: current.status,
        serverPlan: currentServerPlanSelection(current),
        storageEntitlement: publicStorageEntitlement,
        createdAt: current.createdAt || null,
        archivedAt: current.archivedAt || null,
        deletedAt: current.deletedAt || null,
      },
      counts: {
        inputs: files.length,
        outputs: outputs.length,
        runs: runs.length,
        completedRuns: runs.filter((run) => isRunTerminal(run)).length,
      },
      costs: totals,
      storageEntitlement: publicStorageEntitlement,
      managedResourceBindingPlan,
      fileSpace,
      runStatus: summarizeRunStatus(runs, isRunTerminal),
      activeSession: activeSession ? {
        id: activeSession.id,
        createdAt: activeSession.createdAt || null,
        lastUsedAt: activeSession.lastUsedAt || null,
        expiresAt: activeSession.expiresAt || null,
      } : null,
      recentRuns: runPagination.rows.map((run) => ({
        runId: run.runId,
        status: isRunTerminal(run) ? "completed" : (run.status || "running"),
        createdAt: formatDateTime(run.createdAt || ""),
        resourceUsage: workspaceResourceUsageView(run.resourceUsage),
        costEstimate: run.costEstimate,
        balanceLink: run.balanceLink,
      })),
      eventTimeline: events.slice(0, 16).map((event) => ({
        type: event.type,
        occurredAt: event.occurredAt,
        workspaceId: event.workspaceId || current.slug,
      })),
      distribution: {
        inputBytes: await sumFileSizes(files, stat),
        outputBytes: (await sumFileSizes(filesystemOutputs, stat)) + artifactOutputs.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0),
      },
      tasks: taskCards,
      tasksPageRows: taskCards,
      tasksPagination: {
        page: taskPagination.page,
        pageSize: taskPagination.pageSize,
        total: taskPagination.total,
        totalPages: taskPagination.totalPages,
      },
      taskTreemap: taskCards.map((task) => ({
        name: task.title,
        value: Number((task.totalCost || 0) + task.inputs + task.outputs + task.runs) || 0.001,
        task,
      })),
      files: filePagination.rows,
      filesPagination: {
        page: filePagination.page,
        pageSize: filePagination.pageSize,
        total: filePagination.total,
        totalPages: filePagination.totalPages,
      },
      outputs: outputPagination.rows,
      outputsPagination: {
        page: outputPagination.page,
        pageSize: outputPagination.pageSize,
        total: outputPagination.total,
        totalPages: outputPagination.totalPages,
      },
      runsPagination: {
        page: runPagination.page,
        pageSize: runPagination.pageSize,
        total: runPagination.total,
        totalPages: runPagination.totalPages,
      },
      performance: timing.done(),
    };
  };
}
