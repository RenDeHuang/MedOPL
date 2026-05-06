export function createBillingRunReader({ paths = {}, deps = {} } = {}) {
  const {
    codexRuntimeEventsFile = "",
    medRunsRoot = "",
  } = paths;
  const {
    exists,
    path,
    randomUUID,
    readFile,
    readdir,
  } = deps;

  function invalidJsonError(filePath, error, detail = "") {
    const suffix = detail ? `:${detail}` : "";
    return new Error(`billing_run_reader_invalid_json:${filePath}${suffix}:${String(error?.message || error)}`);
  }

  async function readJsonFile(filePath) {
    const raw = await readFile(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw invalidJsonError(filePath, error);
    }
  }

  async function readRuns() {
    const runs = [];

    if (await exists(medRunsRoot)) {
      const files = await readdir(medRunsRoot);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        runs.push(await readJsonFile(path.join(medRunsRoot, file)));
      }
    }

    if (await exists(codexRuntimeEventsFile)) {
      const raw = await readFile(codexRuntimeEventsFile, "utf8");
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const [index, line] of lines.entries()) {
        let event;
        try {
          event = JSON.parse(line);
        } catch (error) {
          throw invalidJsonError(codexRuntimeEventsFile, error, `line_${index + 1}`);
        }

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
      }
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

  function completionTimestamp(run) {
    const condition = run?.k8sStatus?.conditions?.find?.((item) => item.type === "Complete" && item.status === "True");
    return condition?.lastTransitionTime || condition?.lastProbeTime || run?.updatedAt || run?.createdAt || null;
  }

  return {
    completionTimestamp,
    readRuns,
  };
}
