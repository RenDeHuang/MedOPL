import { createPortalAuthRuntimeHandler } from "./portal-auth-runtime-handler.mjs";
import { createPortalLayout } from "./portal-layout.mjs";
import { createPortalApiRuntimeHandlers } from "./portal-api-runtime-handlers.mjs";
import { createPortalFeatureRuntimeHandlers } from "./portal-feature-runtime-handlers.mjs";
import { createPortalPageRuntimePayloads } from "./portal-page-runtime-payloads.mjs";
import { createPortalRuntimeClients } from "./portal-runtime-clients.mjs";
import { createPortalRuntimeStore } from "./portal-store-runtime.mjs";
import { createPortalServerPlanRuntimeHandler } from "./portal-server-plan-runtime-handler.mjs";
import { createOplLaunchService } from "../services/opl-launch.service.mjs";

export function createPortalRuntimeBootstrap({
  layout,
  store,
  clients,
}) {
  const portalLayout = createPortalLayout(layout);
  const portalStore = createPortalRuntimeStore(store);
  const runtimeClients = createPortalRuntimeClients(clients);

  return {
    ...portalLayout,
    portalStore,
    clients: runtimeClients,
    createOplLaunchService,
    createAuthRuntimeHandler: createPortalAuthRuntimeHandler,
    createFeatureRuntimeHandlers: createPortalFeatureRuntimeHandlers,
    createApiRuntimeHandlers: createPortalApiRuntimeHandlers,
    createPageRuntimePayloads: createPortalPageRuntimePayloads,
    createServerPlanRuntimeHandler: createPortalServerPlanRuntimeHandler,
  };
}
