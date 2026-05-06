import {
  createPayloadTimingRecorder,
  paginateRows,
} from "./portal-page-payload-primitives.mjs";
import {
  buildWorkspaceTaskCards,
  sumFileSizes,
  summarizeRunStatus,
} from "./portal-page-payload-helpers.mjs";

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
    const outputs = await listFilesRecursive(outputDir);
    const userRuns = await collectRunsForUser(user.id, { workspaceId: current.slug, limit: 50 });
    const runs = userRuns;
    timing.mark("runs");
    const billing = await fetchBillingSummary(user.id, current.slug, "168h");
    timing.mark("billing");
    const totals = billing?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 };
    const events = await readPortalEvents({ limit: 200, userId: user.id, workspaceId: current.slug });
    timing.mark("events");
    const activeSession = latestActiveWorkspaceSession(db, user.id, current.slug);
    const storageEntitlement = workspaceStorageEntitlement(db, user, current.slug);
    const runPagination = paginateRows(runs, options.runsPage, 5);
    const filePagination = paginateRows(files, options.inputsPage, 5);
    const outputPagination = paginateRows(outputs, options.outputsPage, 5);
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
        storageEntitlement,
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
      storageEntitlement,
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
      })),
      eventTimeline: events.slice(0, 16).map((event) => ({
        type: event.type,
        occurredAt: event.occurredAt,
        workspaceId: event.workspaceId || current.slug,
      })),
      distribution: {
        inputBytes: await sumFileSizes(files, stat),
        outputBytes: await sumFileSizes(outputs, stat),
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
