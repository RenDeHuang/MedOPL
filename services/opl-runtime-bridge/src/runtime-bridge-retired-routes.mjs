import { sendRetired } from "./runtime-bridge-routes-http.mjs";

export function createRetiredRouteHandlers() {
  async function handleWorkbenchRetired(_req, res) {
    sendRetired(res, "旧 /workbench dev projection 已退场；请打开 OPL_WEB_URL，并由 OPL Web 使用 launch token 拉 bootstrap。", "OPL_WEB_URL");
  }

  async function handleLegacyLaunchTokensRetired(_req, res) {
    sendRetired(res, "旧 /api/launch-tokens 已退场；Portal 现在通过 /api/opl-launch/tokens 签发 OPL Web launch。", "/api/opl-launch/tokens");
  }

  async function handleWorkbenchBootstrapRetired(_req, res) {
    sendRetired(res, "旧 /api/workbench/bootstrap 已退场；OPL Web 必须使用 /api/opl-launch/bootstrap。", "/api/opl-launch/bootstrap");
  }

  async function handleRuntimeSessionsRetired(_req, res) {
    sendRetired(res, "旧 /api/runtime-sessions 已退场；runtime/session 由 OPL Web 与 OPL runtime 管理，Portal 只通过 launch/bootstrap 绑定。", "/api/opl-launch/sessions/bind");
  }

  async function handleRuntimeSessionRunsRetired(_req, res) {
    sendRetired(res, "旧 /api/runtime-sessions/:id/runs 已退场；run 必须由 OPL Web 携带 launch token 调 /api/opl-launch/runs。", "/api/opl-launch/runs");
  }

  async function handleCostRecordsRetired(_req, res) {
    sendRetired(res, "旧 /api/cost-records 已退场；billing ledger owner 是 Portal/Go control plane，不由 Runtime Bridge 暴露。", "/api/billing/summary");
  }

  return {
    handleCostRecordsRetired,
    handleLegacyLaunchTokensRetired,
    handleRuntimeSessionRunsRetired,
    handleRuntimeSessionsRetired,
    handleWorkbenchBootstrapRetired,
    handleWorkbenchRetired,
  };
}
