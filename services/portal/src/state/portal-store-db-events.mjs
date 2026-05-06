export function createPortalStoreDbEvents({
  appendFile,
  ensurePgPool,
  eventsFile,
  exists,
  mkdir,
  pgTableName,
  randomUUID,
  readFile,
  runtimeRoot,
  storageMode,
}) {
  async function logPortalEvent(event) {
    const payload = { occurredAt: new Date().toISOString(), ...event };
    await mkdir(runtimeRoot, { recursive: true });
    await appendFile(eventsFile, `${JSON.stringify(payload)}\n`, "utf8");
    if (storageMode() === "postgres_redis") {
      const pool = await ensurePgPool();
      await pool.query(`INSERT INTO ${pgTableName("audit_events")} (id,type,user_id,operator_id,workspace_id,run_id,detail_json,occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
        randomUUID(),
        String(event.type || ""),
        String(event.userId || ""),
        String(event.operatorId || ""),
        String(event.workspaceId || ""),
        String(event.runId || ""),
        JSON.stringify(event),
        payload.occurredAt,
      ]);
    }
  }

  async function readPortalEvents(options = 120) {
    const request = typeof options === "number" ? { limit: options } : (options || {});
    const limit = Number.isInteger(Number(request.limit)) && Number(request.limit) > 0 ? Number(request.limit) : 120;
    const userId = String(request.userId || "").trim();
    const workspaceId = String(request.workspaceId || "").trim();
    const runId = String(request.runId || "").trim();
    const eventMatches = (event = {}) =>
      (!userId || event.userId === userId) &&
      (!workspaceId || !event.workspaceId || event.workspaceId === workspaceId) &&
      (!runId || !event.runId || event.runId === runId);
    if (storageMode() === "postgres_redis") {
      const pool = await ensurePgPool();
      const filters = [];
      const values = [];
      if (userId) {
        values.push(userId);
        filters.push(`user_id = $${values.length}`);
      }
      if (workspaceId) {
        values.push(workspaceId);
        filters.push(`(workspace_id IS NULL OR workspace_id = $${values.length})`);
      }
      if (runId) {
        values.push(runId);
        filters.push(`(run_id IS NULL OR run_id = $${values.length})`);
      }
      values.push(limit);
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const result = await pool.query(`SELECT * FROM ${pgTableName("audit_events")} ${where} ORDER BY occurred_at DESC LIMIT $${values.length}`, values);
      return result.rows.map((row) => ({
        occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
        type: row.type,
        userId: row.user_id,
        operatorId: row.operator_id,
        workspaceId: row.workspace_id,
        runId: row.run_id,
        ...row.detail_json,
      }));
    }
    if (!(await exists(eventsFile))) return [];
    const raw = await readFile(eventsFile, "utf8");
    return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse().map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean).filter(eventMatches).slice(0, limit);
  }

  return {
    logPortalEvent,
    readPortalEvents,
  };
}
