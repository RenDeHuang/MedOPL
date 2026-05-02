import http from "node:http";
import { mkdir } from "node:fs/promises";
import {
  BUILD_SHA,
  BUILD_TIME,
  PORT,
  PROVISIONING_ENABLED,
  TENCENT_CLOUD_REGION,
  TENCENT_TKE_CLUSTER_ID,
  TENCENT_TKE_ENDPOINT,
  TENCENT_TKE_MAX_NODES,
  TENCENT_TKE_NODE_IMAGE_ID,
  TENCENT_TKE_NODE_IMAGE_SOURCE,
  TENCENT_TKE_ZONE,
  runtimeRoot,
  tencentCloudConfigured,
} from "./config.mjs";
import { cloudResources } from "./inventory.mjs";
import { readBody, sendJson } from "./http-utils.mjs";
import { deleteNodePool, ensureCapacity, scaleNodePool, scaleToZero } from "./provisioner.mjs";
import {
  observeProvisionResourceMappingResources,
  readOrders,
  updateProvisionResourceMappingCleanup,
  writeOrders,
} from "./store.mjs";

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      build: { sha: BUILD_SHA, time: BUILD_TIME },
      tencent: {
        configured: tencentCloudConfigured(),
        region: TENCENT_CLOUD_REGION,
        zone: TENCENT_TKE_ZONE,
        tkeEndpoint: TENCENT_TKE_ENDPOINT,
        provisioningEnabled: PROVISIONING_ENABLED,
        clusterConfigured: Boolean(TENCENT_TKE_CLUSTER_ID),
        clusterId: TENCENT_TKE_CLUSTER_ID,
        maxNodes: TENCENT_TKE_MAX_NODES,
        imageId: TENCENT_TKE_NODE_IMAGE_ID,
        imageSource: TENCENT_TKE_NODE_IMAGE_SOURCE,
      },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/cloud/resources") {
    sendJson(res, 200, await cloudResources());
    return;
  }

  if (req.method === "GET" && url.pathname === "/cloud/node-pools") {
    const resources = await cloudResources();
    sendJson(res, 200, { ok: Boolean(resources.ok), items: resources.nodePools || [], resources });
    return;
  }

  if (req.method === "GET" && url.pathname === "/cloud/instances") {
    const resources = await cloudResources();
    sendJson(res, 200, { ok: Boolean(resources.ok), items: resources.instances || [], resources });
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-orders/ensure-capacity") {
    try {
      const result = await ensureCapacity(await readBody(req));
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(res, error.status || 500, { ok: false, error: String(error.message || error), code: error.code || "" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-orders/provision-async") {
    try {
      const result = await ensureCapacity(await readBody(req));
      sendJson(res, 202, { ok: true, accepted: true, ...result });
    } catch (error) {
      sendJson(res, error.status || 500, { ok: false, accepted: false, error: String(error.message || error), code: error.code || "" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-orders/scale-to-zero") {
    try {
      sendJson(res, 200, await scaleToZero(await readBody(req)));
    } catch (error) {
      sendJson(res, error.status || 500, { ok: false, error: String(error.message || error), code: error.code || "" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-orders/scale-node-pool") {
    try {
      sendJson(res, 200, await scaleNodePool(await readBody(req)));
    } catch (error) {
      sendJson(res, error.status || 500, { ok: false, error: String(error.message || error), code: error.code || "" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-orders/delete-node-pool") {
    try {
      sendJson(res, 200, await deleteNodePool(await readBody(req)));
    } catch (error) {
      sendJson(res, error.status || 500, { ok: false, error: String(error.message || error), code: error.code || "" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/resource-orders") {
    const state = await readOrders();
    sendJson(res, 200, { ok: true, items: state.orders.slice(0, 100) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/resource-mappings") {
    const state = await readOrders();
    const filters = {
      tenantId: String(url.searchParams.get("tenantId") || "").trim(),
      workspaceId: String(url.searchParams.get("workspaceId") || "").trim(),
      resourceOrderId: String(url.searchParams.get("resourceOrderId") || "").trim(),
      runId: String(url.searchParams.get("runId") || "").trim(),
      nodePoolId: String(url.searchParams.get("nodePoolId") || "").trim(),
      cleanupStatus: String(url.searchParams.get("cleanupStatus") || "").trim(),
    };
    const items = (state.resourceMappings || [])
      .filter((item) => !filters.tenantId || item.tenantId === filters.tenantId)
      .filter((item) => !filters.workspaceId || item.workspaceId === filters.workspaceId)
      .filter((item) => !filters.resourceOrderId || item.resourceOrderId === filters.resourceOrderId)
      .filter((item) => !filters.runId || item.runId === filters.runId)
      .filter((item) => !filters.nodePoolId || item.nodePoolId === filters.nodePoolId)
      .filter((item) => !filters.cleanupStatus || item.cleanupStatus === filters.cleanupStatus)
      .slice(0, 100);
    sendJson(res, 200, { ok: true, items, filters });
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-mappings/mark-cleanup") {
    const state = await readOrders();
    const mapping = updateProvisionResourceMappingCleanup(state, await readBody(req));
    if (!mapping) {
      sendJson(res, 404, { ok: false, error: "resource_mapping_not_found" });
      return;
    }
    await writeOrders(state);
    sendJson(res, 200, { ok: true, mapping });
    return;
  }

  if (req.method === "POST" && url.pathname === "/resource-mappings/observe-resources") {
    const state = await readOrders();
    const mapping = observeProvisionResourceMappingResources(state, await readBody(req));
    if (!mapping) {
      sendJson(res, 404, { ok: false, error: "resource_mapping_not_found" });
      return;
    }
    await writeOrders(state);
    sendJson(res, 200, { ok: true, mapping });
    return;
  }

  sendJson(res, 404, { ok: false, error: "not_found" });
}

await mkdir(runtimeRoot, { recursive: true });
http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { ok: false, error: String(error.message || error) });
  });
}).listen(PORT, () => {
  console.log(`resource-provisioner listening on :${PORT}`);
});
