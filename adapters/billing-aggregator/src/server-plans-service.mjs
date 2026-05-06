import {
  normalizeStringMap,
  normalizeTolerations,
  serverPlanCatalog as loadServerPlanCatalog,
} from "./server-plans-catalog-normalization.mjs";
import { filterServerPlansPayload } from "./server-plans-availability-filters.mjs";
import { createServerPlansCloudState } from "./server-plans-cloud-state.mjs";
import { createServerPlansCloudStatus } from "./server-plans-cloud-status.mjs";
import { createServerPlansDiscoveryRuntime } from "./server-plans-discovery-runtime.mjs";
import { createServerPlansListQuery } from "./server-plans-list-query.mjs";
import { createServerPlansQuoteRuntime } from "./server-plans-quote-runtime.mjs";

export function createServerPlansService({
  env = {},
  deps = {},
  state = {},
} = {}) {
  const {
    SERVER_PLAN_CATALOG_JSON = "[]",
    SERVER_PLAN_CACHE_TTL_MS = 300000,
    TENCENT_CLOUD_REGION = "",
    TENCENT_PRICE_ENABLED = false,
    TENCENT_PLAN_DISCOVERY_ENABLED = false,
  } = env;
  const {
    firstString,
    firstNumber,
    sanitizeCloudError,
    cloudErrorMessage,
    tencentCloudConfigured,
    callTencentCloud,
    randomUUID,
  } = deps;
  const cloudRuntimeState = state.cloudRuntimeState || {
    lastDiscoveryAt: "",
    lastDiscoveryError: null,
    lastQuoteAt: "",
    lastQuoteError: null,
    lastBillQueryAt: "",
    lastBillQueryError: null,
  };
  const serverPlanCache = state.serverPlanCache || {
    expiresAt: 0,
    payload: null,
  };

  const { markCloudState } = createServerPlansCloudState({
    cloudRuntimeState,
    sanitizeCloudError,
  });

  function serverPlanCatalog() {
    return loadServerPlanCatalog({ SERVER_PLAN_CATALOG_JSON });
  }

  const { discoverTencentServerPlans, overlayCatalogOnDiscovered } = createServerPlansDiscoveryRuntime({
    callTencentCloud,
    env,
    firstString,
    firstNumber,
    markCloudState,
    randomUUID,
    tencentCloudConfigured,
  });
  const { quoteTencentServerPlan } = createServerPlansQuoteRuntime({
    callTencentCloud,
    env,
    firstString,
    firstNumber,
    markCloudState,
    sanitizeCloudError,
    tencentCloudConfigured,
  });
  const { buildTencentCloudStatus } = createServerPlansCloudStatus({
    cloudErrorMessage,
    cloudRuntimeState,
    env,
    tencentCloudConfigured,
  });

  const listServerPlans = createServerPlansListQuery({
    firstString,
    firstNumber,
    normalizeStringMap,
    normalizeTolerations: (value) => normalizeTolerations(value, { firstString }),
    filterServerPlansPayload: (payload, query, options = {}) => filterServerPlansPayload(payload, query, {
      ...options,
      firstString,
      serverPlanCache,
      SERVER_PLAN_CACHE_TTL_MS,
    }),
    tencentCloudConfigured,
    quoteTencentServerPlan,
    discoverTencentServerPlans,
    serverPlanCatalog,
    overlayCatalogOnDiscovered,
    buildTencentCloudStatus,
    markCloudState,
    env: {
      TENCENT_CLOUD_REGION,
      TENCENT_PRICE_ENABLED,
      TENCENT_PLAN_DISCOVERY_ENABLED,
      SERVER_PLAN_CACHE_TTL_MS,
    },
    state: { serverPlanCache },
  });

  return {
    buildTencentCloudStatus,
    listServerPlans,
    markCloudState,
    serverPlanCatalog,
  };
}
