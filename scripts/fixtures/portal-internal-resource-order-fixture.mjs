import http from "node:http";

const PORT = Number(process.env.PORTAL_INTERNAL_FIXTURE_PORT || process.env.PORT || 18935);

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

const routes = new Map([
  ["GET /healthz", async (_req, res) => {
    sendJson(res, 200, { ok: true, service: "portal-internal-resource-order-fixture" });
  }],
  ["POST /portal/internal/resource-orders/prepare-run", async (req, res) => {
    const body = await readJson(req);
    const resourceOrderId = `ro-${body.runId || "adapter-smoke"}`;
    sendJson(res, 200, {
      ok: true,
      resourceOrderId,
      order: {
        resourceOrderId,
        status: "preauthorized",
        idempotencyKey: body.idempotencyKey || "",
      },
    });
  }],
]);

async function notFound(_req, res, url) {
  sendJson(res, 404, { ok: false, error: "not_found", path: url.pathname });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const handler = routes.get(`${req.method} ${url.pathname}`) || notFound;
  await handler(req, res, url);
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    ok: true,
    service: "portal-internal-resource-order-fixture",
    port: PORT,
    baseUrl: `http://127.0.0.1:${PORT}`,
  }, null, 2));
});
