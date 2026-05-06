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
      error: "retired_in_v21",
      runtimeMode: "platform_provisioned",
      message: "v21 已移除旧资源订单入口，请使用平台托管运行环境接口。",
      use: "/portal/api/platform-provisioned-resources",
      legacyUse: "/portal/api/user-owned-resources",
    }, 410);
    return true;
  };
}
