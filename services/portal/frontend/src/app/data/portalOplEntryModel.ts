import {
  bindOplSession,
  createOplLaunch,
  fetchOplBootstrap,
  fetchOplEntryPreflight,
} from "../../api/portal/opl";
import { fetchOplLaunchStatus } from "../../api/portal/resources";
import { OPL_GATEWAY_UNAVAILABLE_MESSAGE, PortalDisplayError } from "./portalDisplayErrors";

function blockedByProviderKey(input: {
  workspaceId?: string;
  userVisibleState?: string;
  currentStage?: string;
}) {
  return {
    launchId: "",
    pageState: "blocked_by_provider_key",
    userVisibleState: input.userVisibleState || "provider_key_required",
    oplWebUrl: "",
    currentStage: input.currentStage || "provider_key_required",
    blockingUser: true,
    providerBound: false,
    providerKeyRef: "",
    gatewayReady: false,
    gatewayState: "等待模型调用密钥绑定",
    runtimeSessionId: "",
    oplSessionId: "",
    stages: [],
    workspaceId: input.workspaceId || "workspace-local-rc",
  } as const;
}

export async function loadOplEntryModel() {
  try {
    const params = new URLSearchParams(window.location.search);
    const existingLaunchId = params.get("launchId");
    const preflight = existingLaunchId ? null : await fetchOplEntryPreflight({ workspaceId: "workspace-local-rc" });
    if (preflight && !preflight.providerBound) {
      return blockedByProviderKey({
        workspaceId: preflight.workspaceId,
        userVisibleState: preflight.reason || preflight.error,
        currentStage: preflight.launchStatus,
      });
    }
    const launch = existingLaunchId
      ? { launchId: existingLaunchId, openUrl: "", oplWebUrl: "", launchStatus: "preparing", ok: true, workspaceId: "" }
      : await createOplLaunch({});
    const [status, bootstrap] = await Promise.all([
      fetchOplLaunchStatus(launch.launchId),
      fetchOplBootstrap(launch.launchId),
    ]);
    await bindOplSession({
      launchId: launch.launchId,
      oplSessionId: bootstrap.identity.oplSessionId,
      clientSessionState: { source: "figma_make_zip_portal_ui" },
    });
    return {
      launchId: launch.launchId,
      pageState: status.status === "ready" ? "ready" : status.status === "failed" ? "failed" : "preparing",
      userVisibleState: status.userVisibleState,
      oplWebUrl: status.oplWebUrl || launch.oplWebUrl || launch.openUrl,
      currentStage: status.currentStage,
      blockingUser: status.blockingUser,
      providerBound: status.providerBound,
      providerKeyRef: status.providerKeyRef,
      gatewayReady: status.gatewayReady,
      gatewayState: status.gatewayState,
      runtimeSessionId: bootstrap.identity.runtimeSessionId,
      oplSessionId: bootstrap.identity.oplSessionId,
      stages: status.stages,
      workspaceId: status.workspaceId || launch.workspaceId || "workspace-local-rc",
    } as const;
  } catch (error: unknown) {
    const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
    if (response?.status === 428 && response.data?.error === "provider_key_required") {
      return blockedByProviderKey({});
    }
    throw new PortalDisplayError(OPL_GATEWAY_UNAVAILABLE_MESSAGE);
  }
}
