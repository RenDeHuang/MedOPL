import http from "node:http";

export function renderBillingHtml(summary, windowValue) {
  const rows = summary.runs
    .map((item) => {
      return `<tr>
<td>${item.runId}</td>
<td>${item.workspaceId}</td>
<td>${item.cpuCost.toFixed(4)}</td>
<td>${item.gpuCost.toFixed(4)}</td>
<td>${item.pvCost.toFixed(4)}</td>
<td>${item.totalCost.toFixed(4)}</td>
</tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Billing</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #111; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0 24px; }
      .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; background: #fff; }
      .label { font-size: 12px; color: #666; margin-bottom: 8px; }
      .value { font-size: 24px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>资源开支</h1>
    <p>时间窗口：${windowValue}</p>
    <div class="grid">
      <div class="card"><div class="label">CPU</div><div class="value">${summary.totals.cpuCost.toFixed(4)}</div></div>
      <div class="card"><div class="label">GPU</div><div class="value">${summary.totals.gpuCost.toFixed(4)}</div></div>
      <div class="card"><div class="label">PVC / 存储</div><div class="value">${summary.totals.pvCost.toFixed(4)}</div></div>
      <div class="card"><div class="label">总计</div><div class="value">${summary.totals.totalCost.toFixed(4)}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Run</th>
          <th>任务空间</th>
          <th>CPU</th>
          <th>GPU</th>
          <th>PVC</th>
      <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;
}

export function createBillingWebServer({
  handleBillingHttpRoute,
  fetchExactSummary,
  buildUnavailableSummary,
  fetchPendingSummary,
  buildBillingEnvelope,
  buildUnattributedSummary,
  sendJson,
} = {}) {
  if (typeof handleBillingHttpRoute !== "function") throw new Error("handleBillingHttpRoute is required");
  if (typeof fetchExactSummary !== "function") throw new Error("fetchExactSummary is required");
  if (typeof buildUnavailableSummary !== "function") throw new Error("buildUnavailableSummary is required");
  if (typeof fetchPendingSummary !== "function") throw new Error("fetchPendingSummary is required");
  if (typeof buildBillingEnvelope !== "function") throw new Error("buildBillingEnvelope is required");
  if (typeof buildUnattributedSummary !== "function") throw new Error("buildUnattributedSummary is required");
  if (typeof sendJson !== "function") throw new Error("sendJson is required");

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://local");
    if (await handleBillingHttpRoute(req, res)) {
      return;
    }

    if (url.pathname !== "/" && url.pathname !== "/billing") {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    try {
      const windowValue = url.searchParams.get("window") || "7d";
      const customerId = url.searchParams.get("customer_id") || "";
      const workspaceId = url.searchParams.get("workspace_id") || "";
      const exactSummary = await fetchExactSummary(customerId, workspaceId, windowValue);
      let pendingSummary = buildUnavailableSummary(customerId, workspaceId, "pending_unavailable", "local_metering_unmatched");
      try {
        pendingSummary = await fetchPendingSummary(customerId, workspaceId, windowValue);
      } catch {}
      const summary = buildBillingEnvelope({
        customerId,
        workspaceId,
        exactSummary,
        pendingSummary,
        unattributedSummary: exactSummary.unattributed || buildUnattributedSummary([], customerId, workspaceId),
      });

      if ((req.headers.accept || "").includes("application/json")) {
        sendJson(res, 200, summary);
        return;
      }

      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderBillingHtml(summary, windowValue));
    } catch (error) {
      sendJson(res, 502, { error: String(error) });
    }
  });
}
