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
        source: "billing_aggregator",
        type: summary ? "live" : "status_only",
        note: summary ? "数据来自账单聚合接口" : "账单聚合接口不可用",
        totals: summary?.totals || { cpuCost: 0, gpuCost: 0, pvCost: 0, totalCost: 0 },
        items: summary?.items || [],
      });
      return true;
    }
    if (url.pathname === "/portal/api/costs/workspace") {
      const workspaceId = String(url.searchParams.get("workspaceId") || url.searchParams.get("task") || "").trim();
      const summary = await fetchBillingSummary(user.id, workspaceId, String(url.searchParams.get("window") || "168h"));
      sendJson(res, {
        source: "billing_aggregator",
        type: summary ? "live" : "status_only",
        note: summary ? "数据来自 workspace 维度账单聚合接口" : "workspace 账单聚合接口不可用",
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
          note: adapterCost.status === "pending" ? "run 成本已记录为 pending，等待 OpenCost/云账单对账" : "run 成本来自 Portal OPL adapter",
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
          source: "billing_aggregator",
          type: "status_only",
          note: "未找到对应 run 成本记录",
          runId,
          cost: null,
        });
        return true;
      }
      sendJson(res, {
        source: "billing_aggregator",
        type: "live",
        note: "数据来自 run 维度账单聚合结果",
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
