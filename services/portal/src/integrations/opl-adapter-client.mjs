export function createOplAdapterClient({
  adapterUrl,
  oplWebUrl,
  timeoutMs,
  formatDateTime,
}) {
  const normalizedAdapterUrl = String(adapterUrl || "").replace(/\/$/, "");
  const normalizedOplWebUrl = String(oplWebUrl || "").replace(/\/$/, "");
  const runtimeUrl = "https://github.com/gaofeng21cn/one-person-lab";

  function usableServerPlanId(...values) {
    for (const value of values) {
      const normalized = String(value || "").trim();
      if (normalized && normalized !== "default") return normalized;
    }
    return "";
  }

  function buildConfiguredOplWebUrl(launchToken, bootstrapUrl = "") {
    if (!normalizedOplWebUrl) return "";
    const url = new URL(normalizedOplWebUrl);
    return url.toString();
  }

  function normalizeLaunchPayload(payload, { requireRealOplWeb = false } = {}) {
    const oplWebLaunchUrl = payload.oplWebUrl || buildConfiguredOplWebUrl(payload.launchToken || "", payload.bootstrapUrl || "");
    if (requireRealOplWeb && !oplWebLaunchUrl) {
      throw new Error("OPL_WEB_URL 未配置：Portal 只能打开真实 OPL Web，不能回退到旧 workbench 路径");
    }
    return {
      ...payload,
      oplWebUrl: oplWebLaunchUrl,
      portalAdapterUrl: normalizedAdapterUrl,
      runtimeUrl: payload.runtimeUrl || runtimeUrl,
    };
  }

  function assertStableOplAdapterPath(path = "") {
    const pathname = new URL(path, `${normalizedAdapterUrl}/`).pathname;
    const allowed = pathname === "/api/opl/status" ||
      pathname === "/api/opl/bootstrap" ||
      pathname === "/api/opl/sessions/bind" ||
      pathname === "/api/opl/messages" ||
      /^\/api\/opl\/messages\/[^/]+\/status$/.test(pathname) ||
      pathname === "/api/opl/files" ||
      pathname === "/api/opl/runs" ||
      /^\/api\/opl\/runs\/[^/]+\/status$/.test(pathname) ||
      /^\/api\/opl\/runs\/[^/]+\/artifacts$/.test(pathname) ||
      /^\/api\/opl\/artifacts\/[^/]+$/.test(pathname);
    if (allowed) return pathname;
    throw new Error(`opl_adapter_api_path_not_allowed:${pathname}`);
  }

  async function fetchJson(pathname) {
    try {
      const response = await fetch(new URL(pathname, `${normalizedAdapterUrl}/`), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  return {
    adapterUrl: normalizedAdapterUrl,
    oplWebUrl: normalizedOplWebUrl,
    buildConfiguredOplWebUrl,
    normalizeLaunchPayload,
    fetchJson,

    async createLaunch({
      user,
      taskSpace,
      workspaceSession,
      requireRealOplWeb = false,
      providerConfig = null,
      providerConfigSecretRef = "",
      providerKeyPayload = null,
      sourceSurface = "portal-control-plane",
      storageEntitlement = null,
    }) {
      const selectedServerPlan = taskSpace.selectedServerPlan || taskSpace.selectedServerPlanSnapshot || taskSpace.serverPlanSnapshot || null;
      const response = await fetch(new URL("/api/opl-launch/tokens", `${normalizedAdapterUrl}/`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          portalUserId: user.id,
          portalUserEmail: user.email,
          portalUserName: user.name,
          tenantId: user.tenantId || user.id,
          ownerId: user.id,
          sessionOwnerId: user.id,
          traceOwnerId: user.id,
          artifactOwnerId: user.id,
          storageOwnerId: user.id,
          workspaceId: workspaceSession.workspaceId,
          workspaceTitle: taskSpace.title,
          workspacePath: taskSpace.path,
          workspaceSessionId: workspaceSession.id,
          sourceSurface,
          serverPlanId: usableServerPlanId(selectedServerPlan?.id),
          instanceType: selectedServerPlan?.instanceType || selectedServerPlan?.InstanceType || "",
          region: selectedServerPlan?.region || "",
          zone: selectedServerPlan?.zone || "",
          nodePool: selectedServerPlan?.nodePool || "",
          runtimeClass: selectedServerPlan?.runtimeClass || "",
          nodeSelector: selectedServerPlan?.nodeSelector || {},
          tolerations: selectedServerPlan?.tolerations || [],
          podNetworkingMode: selectedServerPlan?.podNetworkingMode || "",
          requiresEniPod: selectedServerPlan?.requiresEniPod === true,
          podAnnotations: selectedServerPlan?.podAnnotations || {},
          cpuRequest: selectedServerPlan?.cpuRequest || "",
          cpuLimit: selectedServerPlan?.cpuLimit || "",
          memoryRequest: selectedServerPlan?.memoryRequest || "",
          memoryLimit: selectedServerPlan?.memoryLimit || "",
          gpuCount: Number(selectedServerPlan?.gpuCount ?? selectedServerPlan?.gpu ?? 0),
          storageRequest: selectedServerPlan?.storageRequest || "",
          storageLimit: selectedServerPlan?.storageLimit || "",
          provisioningMode: selectedServerPlan?.provisioningMode || "schedule_to_node_pool",
          tkeClusterId: selectedServerPlan?.tkeClusterId || "",
          nodePoolId: selectedServerPlan?.nodePoolId || "",
          nodePoolCreatePayload: selectedServerPlan?.nodePoolCreatePayload || null,
          nodePoolScalePayload: selectedServerPlan?.nodePoolScalePayload || null,
          provisionerPayload: selectedServerPlan?.provisionerPayload || null,
          providerConfig,
          providerConfigSecretRef,
          providerKeyPayload: providerKeyPayload
            ? {
              provider: String(providerKeyPayload.provider || "").trim(),
              source: String(providerKeyPayload.source || "").trim(),
            }
            : null,
          storageEntitlement,
          selectedServerPlan,
          runtimeUrl,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.launchToken) {
        throw new Error(payload?.error || `opl_launch_failed:${response.status}`);
      }
      return normalizeLaunchPayload(payload, { requireRealOplWeb });
    },

    async requestAdapterApi({ path, method = "GET", launchToken = "", body = null }) {
      const pathname = assertStableOplAdapterPath(path);
      const response = await fetch(new URL(pathname, `${normalizedAdapterUrl}/`), {
        method,
        headers: {
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
          ...(launchToken ? { authorization: `Bearer ${launchToken}` } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.error || `opl_adapter_api_failed:${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    },

    async fetchRuns() {
      const payload = await fetchJson("/api/runs");
      return Array.isArray(payload?.items) ? payload.items : [];
    },

    async fetchTraceRows({ userId = "", workspaceId = "", runId = "", limit = 200 } = {}) {
      const payload = await fetchJson("/api/trace-links");
      const traces = Array.isArray(payload?.items) ? payload.items : [];
      const actions = Array.isArray(payload?.runActions) ? payload.runActions : [];
      const rows = traces
        .filter((item) => !userId || item.portalUserId === userId)
        .filter((item) => !workspaceId || item.workspaceId === workspaceId)
        .filter((item) => !runId || item.runId === runId)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, Number(limit || 200))
        .map((item) => ({
          traceId: item.traceId || "",
          traceName: item.traceName || "",
          userId: item.portalUserId || "",
          workspaceId: item.workspaceId || "",
          workspaceSessionId: item.workspaceSessionId || "",
          runtimeSessionId: item.runtimeSessionId || "",
          runId: item.runId || "",
          model: item.model || "",
          sessionId: item.runtimeSessionId || item.workspaceSessionId || "",
          tokenCount: Number(item.tokenCount || 0),
          artifactRefs: Array.isArray(item.artifactRefs) ? item.artifactRefs.map((ref) => String(ref || "").trim()).filter(Boolean) : [],
          userAgent: item.userAgent || "",
          latencyMs: Number(item.latencyMs || 0),
          inputPreview: "",
          startedAt: formatDateTime(item.createdAt || ""),
          status: item.status || "recorded",
          url: "",
          source: "portal_opl_adapter",
          runActions: actions.filter((action) => action.runId === item.runId),
        }));
      return {
        source: "portal_opl_adapter",
        type: rows.length ? "live" : "status_only",
        rows,
        note: rows.length ? "数据来自 Portal OPL adapter trace records" : "Portal OPL adapter 未返回匹配 trace",
      };
    },

    async fetchCosts({ userId = "", workspaceId = "", runId = "" } = {}) {
      const payload = await fetchJson("/api/cost-records");
      return (Array.isArray(payload?.items) ? payload.items : [])
        .filter((item) => !userId || item.portalUserId === userId)
        .filter((item) => !workspaceId || item.workspaceId === workspaceId)
        .filter((item) => !runId || item.runId === runId);
    },
  };
}
