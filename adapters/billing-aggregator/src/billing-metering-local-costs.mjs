export function createBillingLocalCostEstimator({
  deps = {},
  rates = {},
} = {}) {
  const {
    completionTimestamp,
    exists,
    isCompletedRun,
    path,
    readFile,
    readRuns,
    readdir,
    stat,
  } = deps;
  const {
    CPU_CORE_HOUR_RATE = 0,
    GPU_HOUR_RATE = 0,
    STORAGE_GB_DAY_RATE = 0,
    DEFAULT_CPU_CORES = 0,
    DEFAULT_GPU_COUNT = 0,
    medWorkspacesRoot = "",
  } = rates;

  async function collectWorkspaceBytes(dir) {
    if (!(await exists(dir))) return 0;
    const entries = await readdir(dir, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await collectWorkspaceBytes(full);
        continue;
      }
      if (entry.isFile()) {
        total += (await stat(full)).size;
      }
    }
    return total;
  }

  function runDurationHours(run) {
    const createdAt = new Date(run.createdAt || Date.now());
    const completedAt = new Date(completionTimestamp(run) || Date.now());
    return Math.max(0.001, (completedAt.getTime() - createdAt.getTime()) / 3_600_000);
  }

  async function workspaceStorageGbDays(run, durationHours) {
    const workspaceRoot = path.join(medWorkspacesRoot, run.customerId || run.userId || "", run.workspaceId || "");
    const storageBytes = await collectWorkspaceBytes(workspaceRoot);
    return {
      storageBytes,
      storageGbDays: Math.max(0, storageBytes / (1024 ** 3)) * (durationHours / 24),
    };
  }

  function meteredRunCost(run, { cpuCores, durationHours, gpuCount, pricingSource, storageBytes, storageGbDays }) {
    const cpuCost = cpuCores * durationHours * CPU_CORE_HOUR_RATE;
    const gpuCost = gpuCount * durationHours * GPU_HOUR_RATE;
    const pvCost = storageGbDays * STORAGE_GB_DAY_RATE;
    const totalCost = cpuCost + gpuCost + pvCost;

    return {
      runId: run.runId,
      workspaceId: run.workspaceId || "unknown-workspace",
      customerId: run.customerId || run.userId || null,
      start: run.createdAt || null,
      end: completionTimestamp(run),
      cpuCost,
      gpuCost,
      pvCost,
      totalCost,
      pricingSource,
      breakdown: {
        durationHours,
        cpuCores,
        gpuCount,
        storageBytes,
      },
    };
  }

  async function estimateRunCosts(customerId) {
    const runs = await readRuns();
    const estimated = [];
    for (const run of runs) {
      if (!isCompletedRun(run)) continue;
      if (customerId && run.customerId !== customerId && run.userId !== customerId) continue;

      const durationHours = runDurationHours(run);
      const storage = await workspaceStorageGbDays(run, durationHours);

      estimated.push(meteredRunCost(run, {
        cpuCores: DEFAULT_CPU_CORES,
        durationHours,
        gpuCount: DEFAULT_GPU_COUNT,
        pricingSource: "estimated",
        ...storage,
      }));
    }
    return estimated;
  }

  function parseCpuCores(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    if (raw.endsWith("m")) return Number(raw.slice(0, -1)) / 1000;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseGpuCount(manifest = "") {
    const match = String(manifest).match(/nvidia\.com\/gpu:\s*["']?([0-9.]+)["']?/i);
    if (!match) return 0;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function readRunManifest(run = {}) {
    if (!run.manifestPath) {
      throw new Error(`run_manifest_path_required:${run.runId || "unknown_run"}`);
    }
    if (!(await exists(run.manifestPath))) {
      throw new Error(`run_manifest_missing:${run.runId || "unknown_run"}:${run.manifestPath}`);
    }
    try {
      return await readFile(run.manifestPath, "utf8");
    } catch (error) {
      throw new Error(`run_manifest_read_failed:${run.runId || "unknown_run"}:${run.manifestPath}:${String(error.message || error)}`);
    }
  }

  async function pendingRequestedRunCosts(customerId = "", workspaceId = "") {
    const runs = await readRuns();
    const pending = [];

    for (const run of runs) {
      if (!isCompletedRun(run)) continue;
      if (customerId && run.customerId !== customerId && run.userId !== customerId) continue;
      if (workspaceId && run.workspaceId !== workspaceId) continue;

      const manifest = await readRunManifest(run);
      const cpuRequestMatch = manifest.match(/requests:\s*[\r\n]+\s*cpu:\s*["']?([^"'\r\n]+)["']?/i);
      const cpuCores = parseCpuCores(cpuRequestMatch?.[1] || "");
      const gpuCount = parseGpuCount(manifest);
      if (cpuCores <= 0 && gpuCount <= 0) continue;

      const durationHours = runDurationHours(run);
      const storage = await workspaceStorageGbDays(run, durationHours);

      pending.push(meteredRunCost(run, {
        cpuCores,
        durationHours,
        gpuCount,
        pricingSource: "platform_provisioned_local_metering",
        ...storage,
      }));
    }

    return pending;
  }

  return {
    collectWorkspaceBytes,
    estimateRunCosts,
    pendingRequestedRunCosts,
  };
}
