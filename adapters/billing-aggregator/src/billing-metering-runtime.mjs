export function createBillingMeteringRuntime({
  paths = {},
  rates = {},
  deps = {},
} = {}) {
  const {
    codexRuntimeEventsFile = "",
    medRunsRoot = "",
    medWorkspacesRoot = "",
  } = paths;
  const {
    CPU_CORE_HOUR_RATE = 0,
    GPU_HOUR_RATE = 0,
    STORAGE_GB_DAY_RATE = 0,
    DEFAULT_CPU_CORES = 0,
    DEFAULT_GPU_COUNT = 0,
  } = rates;
  const {
    exists,
    isCompletedRun,
    path,
    randomUUID,
    readFile,
    readdir,
    stat,
  } = deps;

  if (typeof exists !== "function") throw new Error("exists is required");
  if (typeof isCompletedRun !== "function") throw new Error("isCompletedRun is required");
  if (!path || typeof path.join !== "function") throw new Error("path is required");
  if (typeof randomUUID !== "function") throw new Error("randomUUID is required");
  if (typeof readFile !== "function") throw new Error("readFile is required");
  if (typeof readdir !== "function") throw new Error("readdir is required");
  if (typeof stat !== "function") throw new Error("stat is required");

  async function readRuns() {
    const runs = [];

    if (await exists(medRunsRoot)) {
      const files = await readdir(medRunsRoot);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          runs.push(JSON.parse(await readFile(path.join(medRunsRoot, file), "utf8")));
        } catch {}
      }
    }

    if (await exists(codexRuntimeEventsFile)) {
      try {
        const raw = await readFile(codexRuntimeEventsFile, "utf8");
        const lines = raw.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type !== "codex_runtime_run") continue;
            runs.push({
              runId: event.runId,
              customerId: event.portalUserId,
              userId: event.portalUserId,
              workspaceId: event.workspaceId,
              createdAt: event.occurredAt,
              updatedAt: event.occurredAt,
              status: Number(event.exitCode || 0) === 0 ? "completed" : "failed",
              source: "codex_runtime",
              exitCode: Number(event.exitCode || 0),
            });
          } catch {}
        }
      } catch {}
    }

    const deduped = new Map();
    for (const run of runs) {
      const key = run.runId || randomUUID();
      const existing = deduped.get(key);
      if (!existing || String(run.createdAt || "") > String(existing.createdAt || "")) {
        deduped.set(key, run);
      }
    }
    return [...deduped.values()];
  }

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

  function completionTimestamp(run) {
    const condition = run?.k8sStatus?.conditions?.find?.((item) => item.type === "Complete" && item.status === "True");
    return condition?.lastTransitionTime || condition?.lastProbeTime || run?.updatedAt || run?.createdAt || null;
  }

  async function estimateRunCosts(customerId) {
    const runs = await readRuns();
    const estimated = [];
    for (const run of runs) {
      if (!isCompletedRun(run)) continue;
      if (customerId && run.customerId !== customerId && run.userId !== customerId) continue;

      const createdAt = new Date(run.createdAt || Date.now());
      const completedAt = new Date(completionTimestamp(run) || Date.now());
      const durationHours = Math.max(0.001, (completedAt.getTime() - createdAt.getTime()) / 3_600_000);
      const workspaceRoot = path.join(medWorkspacesRoot, run.customerId || run.userId || "", run.workspaceId || "");
      const storageBytes = await collectWorkspaceBytes(workspaceRoot);
      const storageGbDays = Math.max(0, storageBytes / (1024 ** 3)) * (durationHours / 24);

      const cpuCost = DEFAULT_CPU_CORES * durationHours * CPU_CORE_HOUR_RATE;
      const gpuCost = DEFAULT_GPU_COUNT * durationHours * GPU_HOUR_RATE;
      const pvCost = storageGbDays * STORAGE_GB_DAY_RATE;
      const totalCost = cpuCost + gpuCost + pvCost;

      estimated.push({
        runId: run.runId,
        workspaceId: run.workspaceId || "unknown-workspace",
        customerId: run.customerId || run.userId || null,
        start: run.createdAt || null,
        end: completionTimestamp(run),
        cpuCost,
        gpuCost,
        pvCost,
        totalCost,
        pricingSource: "estimated",
        breakdown: {
          durationHours,
          cpuCores: DEFAULT_CPU_CORES,
          gpuCount: DEFAULT_GPU_COUNT,
          storageBytes,
        },
      });
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

  async function pendingRequestedRunCosts(customerId = "", workspaceId = "") {
    const runs = await readRuns();
    const pending = [];

    for (const run of runs) {
      if (!isCompletedRun(run)) continue;
      if (customerId && run.customerId !== customerId && run.userId !== customerId) continue;
      if (workspaceId && run.workspaceId !== workspaceId) continue;
      if (!run.manifestPath || !(await exists(run.manifestPath))) continue;

      let manifest = "";
      try {
        manifest = await readFile(run.manifestPath, "utf8");
      } catch {
        continue;
      }

      const cpuRequestMatch = manifest.match(/requests:\s*[\r\n]+\s*cpu:\s*["']?([^"'\r\n]+)["']?/i);
      const cpuCores = parseCpuCores(cpuRequestMatch?.[1] || "");
      const gpuCount = parseGpuCount(manifest);
      if (cpuCores <= 0 && gpuCount <= 0) continue;

      const createdAt = new Date(run.createdAt || Date.now());
      const completedAt = new Date(completionTimestamp(run) || Date.now());
      const durationHours = Math.max(0.001, (completedAt.getTime() - createdAt.getTime()) / 3_600_000);
      const workspaceRoot = path.join(medWorkspacesRoot, run.customerId || run.userId || "", run.workspaceId || "");
      const storageBytes = await collectWorkspaceBytes(workspaceRoot);
      const storageGbDays = Math.max(0, storageBytes / (1024 ** 3)) * (durationHours / 24);

      const cpuCost = cpuCores * durationHours * CPU_CORE_HOUR_RATE;
      const gpuCost = gpuCount * durationHours * GPU_HOUR_RATE;
      const pvCost = storageGbDays * STORAGE_GB_DAY_RATE;
      const totalCost = cpuCost + gpuCost + pvCost;

      pending.push({
        runId: run.runId,
        workspaceId: run.workspaceId || "unknown-workspace",
        customerId: run.customerId || run.userId || null,
        start: run.createdAt || null,
        end: completionTimestamp(run),
        cpuCost,
        gpuCost,
        pvCost,
        totalCost,
        pricingSource: "k8s_requested_resources_pending",
        breakdown: {
          durationHours,
          cpuCores,
          gpuCount,
          storageBytes,
        },
      });
    }

    return pending;
  }

  function asEntries(data) {
    if (!data) return [];

    if (Array.isArray(data)) {
      return data.flatMap((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          return Object.values(item);
        }
        return [];
      });
    }

    if (typeof data === "object") {
      return Object.values(data);
    }

    return [];
  }

  function labelKeyAliases(key = "") {
    const text = String(key || "").trim();
    const compact = text.replace(/_/g, "");
    const dashed = text.replace(/_/g, "-");
    if (!text) return [];
    return [...new Set([text, compact, dashed])];
  }

  function labelValue(entry, key) {
    const props = entry?.properties || {};
    const labels = props.labels || {};
    for (const alias of labelKeyAliases(key)) {
      const value = (
        labels[alias] ||
        props[`label:${alias}`] ||
        props[alias] ||
        props[`gaofenglab/${alias}`] ||
        labels[`gaofenglab/${alias}`] ||
        null
      );
      if (value) return value;
    }
    return null;
  }

  function filterEntries(entries, customerId, workspaceId = "") {
    return entries.filter((entry) => {
      const customerOk = !customerId || labelValue(entry, "customer_id") === customerId || labelValue(entry, "tenant_id") === customerId || entry?.name?.includes(customerId);
      const workspaceOk = !workspaceId || labelValue(entry, "workspace_id") === workspaceId || entry?.name?.includes(workspaceId);
      return customerOk && workspaceOk;
    });
  }

  function explainRuns(entries) {
    const grouped = new Map();

    for (const entry of entries) {
      const runId = labelValue(entry, "run_id") || entry?.name || "unknown-run";
      const workspaceId = labelValue(entry, "workspace_id") || "unknown-workspace";
      const customerId = labelValue(entry, "customer_id") || labelValue(entry, "tenant_id") || null;
      const current = grouped.get(runId) || {
        runId,
        workspaceId,
        customerId,
        start: entry?.start || null,
        end: entry?.end || null,
        cpuCost: 0,
        gpuCost: 0,
        pvCost: 0,
        totalCost: 0,
        sources: [],
      };

      current.cpuCost += Number(entry?.cpuCost || 0);
      current.gpuCost += Number(entry?.gpuCost || 0);
      current.pvCost += Number(entry?.pvCost || 0);
      current.totalCost += Number(entry?.totalCost || 0);
      current.sources.push(entry?.name || "allocation");
      grouped.set(runId, current);
    }

    return [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
  }

  function summarize(entries, customerId, workspaceId = "") {
    const filtered = filterEntries(entries, customerId, workspaceId);
    const filteredRuns = explainRuns(filtered);

    const totals = filtered.reduce(
      (acc, entry) => {
        acc.cpuCost += Number(entry?.cpuCost || 0);
        acc.gpuCost += Number(entry?.gpuCost || 0);
        acc.pvCost += Number(entry?.pvCost || 0);
        acc.totalCost += Number(entry?.totalCost || 0);
        return acc;
      },
      { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
    );

    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      itemCount: filtered.length,
      totals,
      runs: filteredRuns,
      items: filtered.map((entry) => ({
        name: entry?.name || null,
        start: entry?.start || null,
        end: entry?.end || null,
        cpuCost: Number(entry?.cpuCost || 0),
        gpuCost: Number(entry?.gpuCost || 0),
        pvCost: Number(entry?.pvCost || 0),
        totalCost: Number(entry?.totalCost || 0),
        properties: entry?.properties || {},
      })),
    };
  }

  function summaryFromPendingRuns(runs, customerId) {
    const totals = runs.reduce(
      (acc, item) => {
        acc.cpuCost += Number(item.cpuCost || 0);
        acc.gpuCost += Number(item.gpuCost || 0);
        acc.pvCost += Number(item.pvCost || 0);
        acc.totalCost += Number(item.totalCost || 0);
        return acc;
      },
      { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
    );

    return {
      customerId: customerId || null,
      source: "metering_pending",
      cloudSource: "local_metering",
      itemCount: runs.length,
      totals,
      runs,
      items: runs.map((item) => ({
        name: item.runId,
        start: item.start,
        end: item.end,
        cpuCost: item.cpuCost,
        gpuCost: item.gpuCost,
        pvCost: item.pvCost,
        totalCost: item.totalCost,
        properties: {
          customer_id: item.customerId,
          workspace_id: item.workspaceId,
          run_id: item.runId,
          pricing_source: item.pricingSource,
          duration_hours: item.breakdown.durationHours,
          cpu_cores: item.breakdown.cpuCores,
          gpu_count: item.breakdown.gpuCount,
          storage_bytes: item.breakdown.storageBytes,
        },
      })),
    };
  }

  function summaryFromRawAllocations(entries, customerId = "", workspaceId = "") {
    const grouped = new Map();

    for (const entry of entries) {
      const runId = labelValue(entry, "run_id");
      const entryCustomerId = labelValue(entry, "customer_id") || labelValue(entry, "tenant_id");
      const entryWorkspaceId = labelValue(entry, "workspace_id");

      if (!runId || !entryCustomerId || !entryWorkspaceId) continue;
      if (customerId && entryCustomerId !== customerId) continue;
      if (workspaceId && entryWorkspaceId !== workspaceId) continue;

      const current = grouped.get(runId) || {
        runId,
        workspaceId: entryWorkspaceId,
        customerId: entryCustomerId,
        start: entry?.start || null,
        end: entry?.end || null,
        cpuCost: 0,
        gpuCost: 0,
        pvCost: 0,
        totalCost: 0,
        sources: [],
      };

      current.cpuCost += Number(entry?.cpuCost || 0);
      current.gpuCost += Number(entry?.gpuCost || 0);
      current.pvCost += Number(entry?.pvCost || 0);
      current.totalCost += Number(entry?.totalCost || 0);
      current.sources.push(entry?.name || "allocation");

      if (!current.start || String(entry?.start || "") < String(current.start)) current.start = entry?.start || current.start;
      if (!current.end || String(entry?.end || "") > String(current.end)) current.end = entry?.end || current.end;

      grouped.set(runId, current);
    }

    const runs = [...grouped.values()].sort((a, b) => Number(b.totalCost || 0) - Number(a.totalCost || 0));
    const totals = runs.reduce((acc, item) => {
      acc.cpuCost += Number(item.cpuCost || 0);
      acc.gpuCost += Number(item.gpuCost || 0);
      acc.pvCost += Number(item.pvCost || 0);
      acc.totalCost += Number(item.totalCost || 0);
      return acc;
    }, { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 });

    return {
      customerId: customerId || null,
      workspaceId: workspaceId || null,
      itemCount: runs.length,
      totals,
      runs,
      items: runs.map((item) => ({
        name: item.runId,
        start: item.start,
        end: item.end,
        cpuCost: item.cpuCost,
        gpuCost: item.gpuCost,
        pvCost: item.pvCost,
        totalCost: item.totalCost,
        properties: {
          customer_id: item.customerId,
          tenantid: item.customerId,
          workspace_id: item.workspaceId,
          workspaceid: item.workspaceId,
          run_id: item.runId,
          runid: item.runId,
          pricing_source: "OpenCost raw allocation",
        },
      })),
    };
  }

  return {
    asEntries,
    collectWorkspaceBytes,
    completionTimestamp,
    estimateRunCosts,
    pendingRequestedRunCosts,
    readRuns,
    summaryFromPendingRuns,
    summaryFromRawAllocations,
    summarize,
  };
}
