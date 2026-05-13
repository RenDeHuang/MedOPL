function isRetiredResourceOrderPath(url) {
  const pathname = String(url?.pathname || "");
  return pathname.startsWith("/portal/api/resource-orders")
    || pathname === "/portal/api/my/resources"
    || pathname.startsWith("/portal/internal/resource-orders");
}

export function createResourceOrderRoutes({
  sendJson,
} = {}) {
  if (typeof sendJson !== "function") throw new Error("sendJson is required");

  return async function handleResourceOrderRoutes({ res, url }) {
    if (!isRetiredResourceOrderPath(url)) return false;
    sendJson(res, {
      ok: false,
      error: "resource_order_primary_path_retired",
      runtimeMode: "platform_provisioned",
      message: "resource-order primary path 已退场；请使用 managed environment / resource binding 托管资源路径。",
      replacement: {
        managedEnvironment: "/portal/api/platform-provisioned-resources",
        resourceBinding: "/portal/api/platform-provisioned-resources",
      },
    }, 410);
    return true;
  };
}
