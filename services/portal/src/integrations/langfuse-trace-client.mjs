import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_CLICKHOUSE_CONTAINERS = [
  "medagentdemo-langfuse-clickhouse-1",
  "dify_bundle-langfuse-clickhouse-1",
];

function escapeClickhouseString(value) {
  return String(value).replaceAll("'", "''");
}

export function createLangfuseTraceClient({
  repoRoot,
  langfuseUrl,
  formatDateTime,
  containers = DEFAULT_CLICKHOUSE_CONTAINERS,
}) {
  async function inspectContainer(container, timeout = 30000, maxBuffer = 1024 * 1024 * 8) {
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", container, "clickhouse-client", "--query", "SELECT count(), max(timestamp) FROM traces"],
      { cwd: repoRoot, timeout, maxBuffer },
    );
    const [countText, maxTimestamp] = String(stdout || "").trim().split(/\s+/);
    return {
      container,
      count: Number(countText || 0),
      latest: maxTimestamp || "",
    };
  }

  async function resolveTraceContainer() {
    const candidates = [];
    for (const container of containers) {
      try {
        candidates.push(await inspectContainer(container, 15000, 1024 * 1024));
      } catch {}
    }
    candidates.sort((a, b) => {
      if (Number(b.count || 0) !== Number(a.count || 0)) return Number(b.count || 0) - Number(a.count || 0);
      return String(b.latest || "").localeCompare(String(a.latest || ""));
    });
    return candidates[0]?.container || "";
  }

  async function queryClickhouseJsonRows(container, query) {
    if (!container) return [];
    try {
      const { stdout } = await execFileAsync("docker", [
        "exec",
        container,
        "clickhouse-client",
        "--query",
        `${query} FORMAT JSONEachRow`,
      ], {
        cwd: repoRoot,
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 8,
      });
      return String(stdout || "")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  return {
    async fetchSummary() {
      const candidates = [];
      for (const container of containers) {
        try {
          const item = await inspectContainer(container);
          if (!Number.isFinite(item.count)) continue;
          candidates.push({
            available: true,
            mode: "live",
            source: container,
            traceCount: item.count,
            latestTraceAt: item.latest && !item.latest.startsWith("1970-01-01")
              ? formatDateTime(item.latest.replace(" ", "T"))
              : "暂无",
            note: "数据来自 Langfuse ClickHouse",
            rawLatestTraceAt: item.latest,
          });
        } catch {}
      }
      if (candidates.length) {
        candidates.sort((a, b) => {
          if (Number(b.traceCount || 0) !== Number(a.traceCount || 0)) return Number(b.traceCount || 0) - Number(a.traceCount || 0);
          return String(b.rawLatestTraceAt || "").localeCompare(String(a.rawLatestTraceAt || ""));
        });
        const { rawLatestTraceAt, ...selected } = candidates[0];
        return selected;
      }
      return { available: false, mode: "status_only", note: "未接入 Langfuse 摘要查询" };
    },

    async fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 20 } = {}) {
      const container = await resolveTraceContainer();
      if (!container) {
        return { source: "langfuse_clickhouse", type: "status_only", rows: [], note: "Langfuse ClickHouse 不可用" };
      }
      const clauses = ["is_deleted = 0"];
      if (userId) clauses.push(`user_id = '${escapeClickhouseString(userId)}'`);
      if (workspaceId) clauses.push(`mapContains(metadata, 'workspaceId') AND metadata['workspaceId'] = '${escapeClickhouseString(workspaceId)}'`);
      if (runId) clauses.push(`mapContains(metadata, 'runId') AND metadata['runId'] = '${escapeClickhouseString(runId)}'`);
      const rows = await queryClickhouseJsonRows(
        container,
        `SELECT id,timestamp,name,user_id,metadata,session_id FROM traces WHERE ${clauses.join(" AND ")} ORDER BY timestamp DESC LIMIT ${Number(limit || 20)}`,
      );
      return {
        source: "langfuse_clickhouse",
        type: "live",
        rows: rows.map((item) => ({
          traceId: item.id || "",
          traceName: item.name || "",
          userId: item.user_id || "",
          workspaceId: item.metadata?.workspaceId || "",
          workspaceSessionId: item.metadata?.workspaceSessionId || "",
          runId: item.metadata?.runId || "",
          model: item.metadata?.model || "",
          sessionId: item.session_id || "",
          tokenCount: Number(
            item.metadata?.totalTokens ??
            item.metadata?.tokenCount ??
            item.metadata?.usage?.totalTokens ??
            0,
          ),
          userAgent: item.metadata?.userAgent || item.metadata?.user_agent || "",
          latencyMs: Number(
            item.metadata?.latencyMs ??
            item.metadata?.latency_ms ??
            item.metadata?.durationMs ??
            item.metadata?.duration_ms ??
            0,
          ),
          inputPreview: String(
            item.metadata?.inputText ??
            item.metadata?.input ??
            item.metadata?.prompt ??
            item.metadata?.question ??
            "",
          ),
          startedAt: item.timestamp ? formatDateTime(String(item.timestamp).replace(" ", "T")) : "",
          status: String(item.metadata?.status || "recorded"),
          url: langfuseUrl ? `${langfuseUrl}` : "",
        })),
        note: rows.length ? "数据来自 Langfuse traces" : "Langfuse 中未查询到匹配 trace",
      };
    },
  };
}
