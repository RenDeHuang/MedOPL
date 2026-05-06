export function createResourceOrderPublicDeleteRoutes({
  sendJson,
} = {}) {
  if (typeof sendJson !== "function") throw new Error("sendJson is required");

  async function handleRetiredResourceOrderDelete({ req, res, url }) {
    if (req.method !== "POST" || url.pathname !== "/portal/api/resource-orders/delete-resource") return false;
    sendJson(res, {
      ok: false,
      error: "retired_in_v21",
      message: "v21 删除或解绑运行环境请使用平台托管资源接口，不再通过旧资源订单删除平台算力。",
      use: "/portal/api/platform-provisioned-resources/unbind",
      legacyUse: "/portal/api/user-owned-resources/unbind",
    }, 410);
    return true;
  }

  return async function handleResourceOrderPublicDeleteRoutes(context) {
    if (await handleRetiredResourceOrderDelete(context)) return true;
    return false;
  };
}
