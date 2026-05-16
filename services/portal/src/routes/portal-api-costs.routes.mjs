export function createPortalApiCostsRoutes({
  fetchBillingSummary,
  fetchOplAdapterCosts,
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
      const adapterCost = (await fetchOplAdapterCosts({ userId: user.id, runId }))[0] || null;
      if (adapterCost) {
        sendJson(res, {
          source: "portal_opl_adapter",
          type: "live",
          note: adapterCost.status === "pending" ? "run 成本已记录为 pending，等待平台账本投影校准" : "run 成本来自 Portal OPL adapter",
          runId,
          cost: {
            cpuCost: adapterCost.cpuCost,
            gpuCost: adapterCost.gpuCost,
            storageCost: adapterCost.storageCost,
            totalCost: adapterCost.totalCost,
            pricingSource: adapterCost.pricingSource,
            status: adapterCost.status,
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
          runId,
          cost: null,
        });
        return true;
      }
      sendJson(res, {
        source: "portal_billing_ledger",
        type: "local_projection",
        note: "数据来自 run 维度 Portal 账本投影",
        runId,
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
