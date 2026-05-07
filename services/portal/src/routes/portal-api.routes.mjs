import { createPortalApiCostsRoutes } from "./portal-api-costs.routes.mjs";
import { createPortalApiRunsRoutes } from "./portal-api-runs.routes.mjs";
import { createPortalApiSessionsRoutes } from "./portal-api-sessions.routes.mjs";
import { createPortalApiStateRoutes } from "./portal-api-state.routes.mjs";
import { createPortalApiTracesRoutes } from "./portal-api-traces.routes.mjs";
import { createPortalApiV22ManagedEnvironmentReleaseRoutes } from "./portal-api-v22-managed-environment-release.routes.mjs";
import { createPortalApiV22OplWorkRoutes } from "./portal-api-v22-opl-work.routes.mjs";
import { createPortalApiV22UserCreditProviderKeyRoutes } from "./portal-api-v22-user-credit-provider-key.routes.mjs";
import { createPlatformProvisionedResourceRoutes } from "./platform-provisioned-resource.routes.mjs";
import { createUserOwnedResourceRoutes } from "./user-owned-resource.routes.mjs";
import { buildUserBillingSummary as buildDefaultUserBillingSummary } from "../domain/wallet-ledger.mjs";

export function createPortalApiRoutes({
  activeUserStatus,
  adminScopeResult,
  announcementRows,
  buildCommercialProfile,
  buildSessionTraceDetailPayload,
  buildSessionTracesApiPayload,
  collectRunsForUser,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  evaluateUserPolicy,
  fetchBillingSummary,
  fetchHarborSummary,
  fetchOplAdapterCosts,
  fetchOplAdapterRuns,
  fetchOplAdapterTraceRows,
  fetchOpsRegistryImageRows,
  fetchTraceRows,
  formatDateTime,
  isRunTerminal,
  normalizePageSize,
  paginateRows,
  parsePositiveInt,
  productProfile = {},
  providerSecretStore = null,
  readBody = async () => Buffer.from(""),
  readSessionsRequestOptions,
  readTracesRequestOptions,
  sendJson,
  buildUserBillingSummary = buildDefaultUserBillingSummary,
  cloudProvisioner = null,
  visibleAnnouncementRows,
  writeDb = async () => {},
  workspaceChatSessionsForUser,
}) {
  const handleV22UserCreditProviderKey = createPortalApiV22UserCreditProviderKeyRoutes({
    activeUserStatus,
    buildUserBillingSummary,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
    providerSecretStore,
    readBody,
    sendJson,
    writeDb,
  });
  const handleV22OplWork = createPortalApiV22OplWorkRoutes({
    activeUserStatus,
    buildUserBillingSummary,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
    readBody,
    sendJson,
    writeDb,
  });
  const handleV22ManagedEnvironmentRelease = createPortalApiV22ManagedEnvironmentReleaseRoutes({
    readBody,
    sendJson,
    writeDb,
  });
  const handlePlatformProvisionedResources = createPlatformProvisionedResourceRoutes({
    readBody,
    sendJson,
    writeDb,
    cloudProvisioner,
  });
  const handleLegacyUserOwnedResources = createUserOwnedResourceRoutes({
    readBody,
    sendJson,
    writeDb,
    cloudProvisioner,
  });
  const handleSessions = createPortalApiSessionsRoutes({
    fetchOplAdapterRuns,
    normalizePageSize,
    paginateRows,
    readSessionsRequestOptions,
    sendJson,
    workspaceChatSessionsForUser,
  });
  const handleRuns = createPortalApiRunsRoutes({
    buildUserBillingSummary,
    collectRunsForUser,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
    fetchOplAdapterRuns,
    formatDateTime,
    isRunTerminal,
    readBody,
    sendJson,
  });
  const handleState = createPortalApiStateRoutes({
    activeUserStatus,
    buildUserBillingSummary,
    currentServerPlanSelection,
    currentTaskSpaceForUser,
    sendJson,
  });
  const handleCosts = createPortalApiCostsRoutes({
    fetchBillingSummary,
    fetchOplAdapterCosts,
    sendJson,
  });
  const handleTraces = createPortalApiTracesRoutes({
    adminScopeResult,
    buildSessionTraceDetailPayload,
    buildSessionTracesApiPayload,
    fetchOplAdapterTraceRows,
    fetchTraceRows,
    normalizePageSize,
    paginateRows,
    parsePositiveInt,
    readTracesRequestOptions,
    sendJson,
  });

  async function handleAnnouncements({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/announcements") return false;
    const showAll = user.role === "admin" && String(url.searchParams.get("mode") || "").toLowerCase() === "all";
    sendJson(res, {
      items: showAll ? announcementRows(db) : visibleAnnouncementRows(db, user),
      source: "portal_settings",
      type: "live",
    });
    return true;
  }

  async function handleMe({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/me") return false;
    const policy = await evaluateUserPolicy(db, user);
    const wallet = db.wallets.find((item) => item.userId === user.id) || { balance: 0 };
    const commercial = buildCommercialProfile(db, user, { wallet, policy });
    sendJson(res, {
      ...portalUserProfile(user, commercial),
      currentTaskSlug: user.currentTaskSlug || "default",
      selectedServerPlan: currentServerPlanSelection(currentTaskSpaceForUser(db, user)),
      productProfile: portalProductProfile(productProfile),
    });
    return true;
  }

  function portalUserProfile(user, commercial) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: activeUserStatus(user.status),
      accountStatus: commercial.accountStatus,
      billingStatus: commercial.billingStatus,
      entitlementStatus: commercial.entitlementStatus,
      commercial,
      initials: userInitials(user),
    };
  }

  function userInitials(user = {}) {
    return String(user.name || user.email || "?")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";
  }

  function portalProductProfile(profile = {}) {
    const runtimeMode = String(profile.runtimeMode || "platform_provisioned").trim().toLowerCase() || "platform_provisioned";
    return {
      runtimeMode,
      opsProfileEnabled: Boolean(profile.opsProfileEnabled),
      opsSurfaceEnabled: Boolean(profile.opsProfileEnabled),
    };
  }

  async function handleBillingSummary({ req, res, url, db, user }) {
    if (req.method !== "GET" || url.pathname !== "/portal/api/billing/me/summary") return false;
    sendJson(res, buildUserBillingSummary(db, { user }));
    return true;
  }

  async function handleRegistry({ req, res, url, user }) {
    if (req.method !== "GET") return false;
    if (url.pathname !== "/portal/api/registry/summary" && url.pathname !== "/portal/api/registry/images") return false;
    if (user.role !== "admin") {
      sendJson(res, { error: "forbidden" }, 403);
      return true;
    }
    if (url.pathname === "/portal/api/registry/summary") {
      sendJson(res, {
        ok: false,
        available: false,
        mode: "retired",
        error: "retired_in_v21",
        retiredIn: "v21",
        note: "Portal v21 已移除 Harbor/registry 旧栈入口。",
        imageTagCount: 0,
        dataSource: "retired_in_v21",
      });
      return true;
    }
    sendJson(res, {
      ok: false,
      available: false,
      mode: "retired",
      error: "retired_in_v21",
      retiredIn: "v21",
      note: "Portal v21 已移除 Harbor/registry 旧栈入口。",
      items: [],
      dataSource: "retired_in_v21",
    });
    return true;
  }

  return async function handlePortalApiRoutes(context) {
    if (await handleV22UserCreditProviderKey(context)) return true;
    if (await handleV22ManagedEnvironmentRelease(context)) return true;
    if (await handleV22OplWork(context)) return true;
    if (await handlePlatformProvisionedResources(context)) return true;
    if (await handleLegacyUserOwnedResources(context)) return true;
    if (await handleState(context)) return true;
    if (await handleAnnouncements(context)) return true;
    if (await handleMe(context)) return true;
    if (await handleSessions(context)) return true;
    if (await handleRuns(context)) return true;
    if (await handleBillingSummary(context)) return true;
    if (await handleCosts(context)) return true;
    if (await handleRegistry(context)) return true;
    if (await handleTraces(context)) return true;
    return false;
  };
}
