function formatDate(formatDateTime, value) {
  return value ? formatDateTime(value) : "";
}

export function createHarborRegistryClient({
  harborApiUrl,
  username,
  password,
  formatDateTime,
  timeoutMs = 15000,
}) {
  const authHeader = () => `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  async function fetchProjectRepositories(projectName) {
    const response = await fetch(
      new URL(`/api/v2.0/projects/${encodeURIComponent(projectName)}/repositories?page_size=100`, harborApiUrl),
      {
        headers: { Authorization: authHeader() },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }

  async function fetchProjects() {
    if (!harborApiUrl) return { ok: false, status: "unconfigured", projects: [] };
    const response = await fetch(new URL("/api/v2.0/projects?page_size=100", harborApiUrl), {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, status: String(response.status), projects: [] };
    const payload = await response.json();
    return { ok: true, status: String(response.status), projects: Array.isArray(payload) ? payload : [] };
  }

  return {
    async fetchSummary() {
      if (!harborApiUrl) {
        return { available: false, mode: "status_only", note: "未配置 Harbor API URL" };
      }
      try {
        const projectResult = await fetchProjects();
        if (!projectResult.ok) {
          return { available: false, mode: "status_only", note: `Harbor API 未授权：${projectResult.status}` };
        }

        let repositoryCount = 0;
        let artifactCount = 0;
        let latestUpdate = "";
        for (const project of projectResult.projects) {
          repositoryCount += Number(project.repo_count || 0);
          const repos = await fetchProjectRepositories(project.name);
          for (const repo of repos) {
            artifactCount += Number(repo.artifact_count || 0);
            const updateTime = String(repo.update_time || repo.creation_time || "");
            if (updateTime && updateTime > latestUpdate) latestUpdate = updateTime;
          }
        }

        return {
          available: true,
          mode: "live",
          projectCount: projectResult.projects.length,
          repositoryCount,
          artifactCount,
          latestUpdateAt: latestUpdate ? formatDateTime(latestUpdate) : "暂无",
          note: "数据来自 Harbor API",
        };
      } catch (error) {
        return { available: false, mode: "status_only", note: `Harbor 摘要未接入：${String(error.message || error)}` };
      }
    },

    async fetchImageRows(limit = 50) {
      if (!harborApiUrl) {
        return { source: "harbor_api", type: "status_only", rows: [], note: "未配置 Harbor API URL" };
      }
      try {
        const projectResult = await fetchProjects();
        if (!projectResult.ok) {
          return { source: "harbor_api", type: "status_only", rows: [], note: `Harbor API 未授权：${projectResult.status}` };
        }

        const rows = [];
        for (const project of projectResult.projects) {
          const repos = await fetchProjectRepositories(project.name);
          for (const repo of repos) {
            rows.push({
              project: project.name,
              repository: repo.name || "",
              tag: "",
              size: Number(repo.pull_count || 0),
              pushedAt: formatDate(formatDateTime, repo.update_time || repo.creation_time || ""),
              status: "available",
            });
            if (rows.length >= limit) break;
          }
          if (rows.length >= limit) break;
        }
        return { source: "harbor_api", type: "live", rows, note: "数据来自 Harbor repository 列表" };
      } catch (error) {
        return { source: "harbor_api", type: "status_only", rows: [], note: `Harbor 查询失败：${String(error.message || error)}` };
      }
    },
  };
}
