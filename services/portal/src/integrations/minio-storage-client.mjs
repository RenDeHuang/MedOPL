import { execFile } from "node:child_process";
import path from "node:path";
import { access, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseJsonLines(stdout) {
  return String(stdout || "").split(/\r?\n/).filter(Boolean);
}

export function createMinioStorageClient({
  repoRoot,
  portalWorkdir,
  mcBinary,
  minioApiUrl,
  formatDateTime,
  execFileAsync: runExecFile = execFileAsync,
}) {
  let availability = { checkedAt: 0, ok: false };
  const normalizedMinioApiUrl = String(minioApiUrl || "").replace(/\/$/, "");

  async function configureAlias(timeout = 15000) {
    await runExecFile(
      mcBinary,
      ["alias", "set", "localminio", normalizedMinioApiUrl, "minioadmin", "MinioAdmin123!"],
      { cwd: repoRoot, timeout },
    );
  }

  async function ensureWorkspaceBucket(timeout = 15000) {
    await runExecFile(
      mcBinary,
      ["mb", "--ignore-existing", "localminio/workspaces"],
      { cwd: repoRoot, timeout },
    );
  }

  function workspaceObjectTarget(userId, taskSlug, kind, relativePath = "") {
    const normalizedRelativePath = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalizedRelativePath.split("/").includes("..")) {
      throw new Error("minio_sync_invalid_relative_path");
    }
    return [
      "localminio/workspaces",
      encodeURIComponent(String(userId || "")),
      encodeURIComponent(String(taskSlug || "")),
      encodeURIComponent(String(kind || "")),
      ...normalizedRelativePath.split("/").filter(Boolean).map((item) => encodeURIComponent(item)),
    ].join("/");
  }

  return {
    async ensureWorkspaceSkeleton(userId, taskSlug, taskPath) {
      const keepFiles = [
        { kind: "inputs", filePath: path.join(taskPath, "inputs", ".keep") },
        { kind: "outputs", filePath: path.join(taskPath, "outputs", ".keep") },
      ];
      for (const item of keepFiles) {
        try {
          if (!(await fileExists(item.filePath))) {
            await writeFile(item.filePath, "", "utf8");
          }
          await this.syncWorkspaceFile(userId, taskSlug, item.kind, item.filePath, ".keep");
        } catch (error) {
          console.error("MinIO skeleton sync failed", error);
        }
      }
    },

    async fetchSummary() {
      if (!(await fileExists(mcBinary))) {
        return { available: false, mode: "status_only", note: "未找到 mc 工具" };
      }
      try {
        await configureAlias();
        const { stdout } = await runExecFile(
          mcBinary,
          ["ls", "--json", "--recursive", "localminio/workspaces"],
          { cwd: repoRoot, timeout: 30000, maxBuffer: 1024 * 1024 * 16 },
        );
        const lines = parseJsonLines(stdout);
        const users = new Set();
        const workspaces = new Set();
        let objectCount = 0;
        let latestWriteAt = "";
        for (const line of lines) {
          try {
            const item = JSON.parse(line);
            if (item.type !== "file" || !item.key) continue;
            objectCount += 1;
            const [userId, workspaceId] = String(item.key).split("/");
            if (userId) users.add(userId);
            if (userId && workspaceId) workspaces.add(`${userId}/${workspaceId}`);
            const ts = String(item.lastModified || "");
            if (ts && ts > latestWriteAt) latestWriteAt = ts;
          } catch {}
        }
        return {
          available: true,
          mode: "live",
          userCount: users.size,
          workspaceCount: workspaces.size,
          objectCount,
          latestWriteAt: latestWriteAt ? formatDateTime(latestWriteAt) : "暂无",
          note: "数据来自 MinIO 对象列表",
        };
      } catch (error) {
        return { available: false, mode: "status_only", note: `MinIO 摘要未接入：${String(error.message || error)}` };
      }
    },

    async fetchWorkspaceState(userId, taskSlug) {
      if (!(await fileExists(mcBinary))) {
        return { source: "minio_object_store", type: "status_only", available: false, synced: false, objects: 0, note: "未找到 mc 工具" };
      }
      try {
        await configureAlias();
        const target = `localminio/workspaces/${userId}/${taskSlug}`;
        const { stdout } = await runExecFile(
          mcBinary,
          ["ls", "--json", "--recursive", target],
          { cwd: repoRoot, timeout: 30000, maxBuffer: 1024 * 1024 * 8 },
        );
        const rows = parseJsonLines(stdout);
        let latestWriteAt = "";
        for (const line of rows) {
          try {
            const item = JSON.parse(line);
            const ts = String(item.lastModified || "");
            if (ts && ts > latestWriteAt) latestWriteAt = ts;
          } catch {}
        }
        return {
          source: "minio_object_store",
          type: "live",
          available: true,
          synced: rows.length > 0,
          objects: rows.length,
          latestWriteAt: latestWriteAt ? formatDateTime(latestWriteAt) : "",
          note: "数据来自 MinIO 对象列表",
        };
      } catch (error) {
        return { source: "minio_object_store", type: "status_only", available: false, synced: false, objects: 0, note: `MinIO 查询失败：${String(error.message || error)}` };
      }
    },

    async syncWorkspaceFile(userId, taskSlug, kind, filePath, relativePath = "") {
      const now = Date.now();
      if (now - availability.checkedAt > 10_000) {
        try {
          const probeResponse = await fetch(new URL("/minio/health/live", `${normalizedMinioApiUrl}/`), {
            signal: AbortSignal.timeout(1500),
          });
          availability = { checkedAt: now, ok: probeResponse.ok };
        } catch {
          availability = { checkedAt: now, ok: false };
        }
      }
      if (!availability.ok) return;
      try {
        await configureAlias();
        await ensureWorkspaceBucket();
        await runExecFile(
          mcBinary,
          ["cp", filePath, workspaceObjectTarget(userId, taskSlug, kind, relativePath)],
          { timeout: 120000, maxBuffer: 1024 * 1024, cwd: portalWorkdir },
        );
      } catch (error) {
        console.error("MinIO sync failed", error);
      }
    },
  };
}
