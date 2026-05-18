import { createHash } from "node:crypto";

function publicTaskRef(...values) {
  const source = values.map((value) => String(value ?? "").trim()).find(Boolean);
  if (!source) return "";
  return `task_${createHash("sha256").update(source).digest("hex").slice(0, 16)}`;
}

export function createPortalApiCostsRoutes({
  fetchBillingSummary,
  fetchRuntimeBridgeCosts,
  sendJson,
}) {
  return async function handlePortalApiCostsRoutes({ req, res, url, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname === "/portal/api/costs/summary") {
      const summary = await fetchBillingSummary(user.id, "", String(url.searchParams.get("window") || "168h"));
      sendJson(res, {
        source: "portal_billing_ledger",
        type: "local_projection",
        note: "数据来自 Portal monolith 账本投影",
        totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: summary?.items || [],
      });
      return true;
    }
    if (url.pathname === "/portal/api/costs/workspace") {
      const workspaceId = String(url.searchParams.get("workspaceId") || url.searchParams.get("task") || "").trim();
      const summary = await fetchBillingSummary(user.id, workspaceId, String(url.searchParams.get("window") || "168h"));
      sendJson(res, {
        source: "portal_billing_ledger",
        type: "local_projection",
        note: "数据来自 workspace 维度 Portal 账本投影",
        workspaceId,
        totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: summary?.items || [],
      });
      return true;
    }
    if (url.pathname === "/portal/api/costs/run") {
      const runId = String(url.searchParams.get("runId") || "").trim();
      const summary = await fetchBillingSummary(user.id, "", String(url.searchParams.get("window") || "168h"));
      const runtimeBridgeCost = (await fetchRuntimeBridgeCosts({ userId: user.id, runId }))[0] || null;
      if (runtimeBridgeCost) {
        sendJson(res, {
          source: "runtime_bridge",
          type: "live",
          note: runtimeBridgeCost.status === "pending" ? "run 成本已记录为 pending，等待平台账本投影校准" : "run 成本来自 Runtime Bridge",
          taskRef: publicTaskRef(runtimeBridgeCost.traceId, runtimeBridgeCost.sessionId, runtimeBridgeCost.runtimeSessionId, runId),
          cost: {
            cpuCost: runtimeBridgeCost.cpuCost,
            gpuCost: runtimeBridgeCost.gpuCost,
            storageCost: runtimeBridgeCost.storageCost,
            totalCost: runtimeBridgeCost.totalCost,
            pricingSource: runtimeBridgeCost.pricingSource,
            status: runtimeBridgeCost.status,
          },
        });
        return true;
      }
      const runCost = (summary?.items || []).find((item) => {
        const props = item?.properties || {};
        return props["label:run_id"] === runId || props.run_id === runId || item?.name === runId;
      }) || null;
      if (!runCost) {
        sendJson(res, {
          source: "portal_billing_ledger",
          type: "status_only",
          note: "未找到对应 run 成本记录",
          taskRef: publicTaskRef(runId),
          cost: null,
        });
        return true;
      }
      sendJson(res, {
        source: "portal_billing_ledger",
        type: "local_projection",
        note: "数据来自 run 维度 Portal 账本投影",
        taskRef: publicTaskRef(runId),
        cost: {
          cpuCost: Number(runCost.cpuCost || 0),
          gpuCost: Number(runCost.gpuCost || 0),
          storageCost: Number(runCost.pvCost || runCost.storageCost || 0),
          totalCost: Number(runCost.totalCost || 0),
          pricingSource: runCost?.properties?.pricing_source || runCost?.properties?.["label:pricing_source"] || "aggregated",
        },
      });
      return true;
    }
    return false;
  };
}
