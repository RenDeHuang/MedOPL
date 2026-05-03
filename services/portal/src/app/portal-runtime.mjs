import http from "node:http";
import path from "node:path";
import { mkdir, readFile, writeFile, access, readdir, stat, rename } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import {
  adminSeed,
  BILLING_SERVICE_TIMEOUT_MS,
  BILLING_SERVICE_URL,
  RESOURCE_PROVISIONER_URL,
  BUILD_SHA,
  BUILD_TIME,
  codexRuntimeEventsFile,
  codexRuntimeRoot,
  frontendDistRoot,
  HARBOR_API_URL,
  HARBOR_ENABLED,
  HARBOR_PASSWORD,
  HARBOR_URL,
  HARBOR_USERNAME,
  LANGFUSE_PROJECT_ID,
  LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY,
  KUBESPHERE_URL,
  LANGFUSE_URL,
  mcBinary,
  medRunsRoot,
  medWorkspaceRoot,
  MINIO_API_URL,
  MINIO_CONSOLE_URL,
  OPENCOST_UI_URL,
  OPL_RUNTIME_MODE,
  OPL_RUNTIME_TIMEOUT_MS,
  OPL_WEB_URL,
  OPL_WEBUI_AUTH_MODE,
  PORT,
  portalWorkdir,
  PORTAL_ADMIN_SEED_BALANCE,
  PORTAL_IDENTITY_SYNC_MODE,
  PORTAL_INTERNAL_AUTH_TOKEN,
  PORTAL_OIDC_CLIENT_ID,
  PORTAL_OIDC_CLIENT_SECRET,
  PORTAL_OIDC_ENABLED,
  PORTAL_OIDC_ISSUER,
  PORTAL_OIDC_REDIRECT_URI,
  PORTAL_OIDC_SCOPE,
  PORTAL_OPL_ADAPTER_URL,
  PORTAL_OPL_PROVIDER_SECRET_ROOT,
  PORTAL_PUBLIC_URL,
  publicRoot,
  RANCHER_URL,
  repoRoot,
  RESOURCE_PROVISIONER_TIMEOUT_MS,
  runtimeRoot,
  SHOW_LEGACY_KUBESPHERE,
  syncWorkspaceToMinioScriptRelative,
  TENCENT_BILLING_ENABLED,
  TENCENT_BILLING_REQUIRED,
  validateProductionConfig,
  ZITADEL_ADMIN_USER_SCRIPT,
} from "./portal-runtime-config.mjs";
import {
  findUserByEmail,
  normalizeAuthEmail,
  sanitizePortalUser,
} from "./portal-auth-runtime-handler.mjs";
import {
  activeUserStatus,
  adminScopeResult,
  appendLedgerEntry,
  buildCommercialProfile,
  buildOverviewOnboarding,
  buildServerPlansFallback,
  buildServerPlansSummary,
  currentServerPlanSelection,
  ensureUserCommercialState,
  ensureWallet,
  isBlockedUserStatus,
  moneyAmount,
} from "./portal-commercial-domain.mjs";
import {
  buildWorkspaceFileChecksum,
  buildWorkspaceStorageKey,
  createOrUpdateStorageOrder,
  issueWorkspaceTransferToken,
  listWorkspaceFiles,
  markWorkspaceStorageDeleting,
  readWorkspaceTransferToken,
  recordWorkspaceFile,
  resolveWorkspaceStorageEntitlement,
} from "./portal-storage-domain.mjs";
import {
  createGflabProviderConfig,
  normalizeProviderApiKey,
  redactProviderConfig,
} from "./portal-lab-domain.mjs";
import { createProviderSecretStore } from "../domain/provider-secret-store.mjs";
import {
  announcementRows,
  defaultTaskTitle,
  formatDateOnly,
  formatDateTime,
  humanizeStatus,
  sandboxStatusLabel,
  sanitizeTaskTitle,
  slugify,
  taskStatusClass,
  taskStatusLabel,
  userTheme,
  visibleAnnouncementRows,
} from "./portal-presentation-domain.mjs";
import { createPortalRuntimeBootstrap } from "./portal-runtime-bootstrap.mjs";
import { createPortalHttpDispatcher } from "./portal-http-dispatcher.mjs";
import { createPortalIdentitySecurityRuntime } from "./portal-identity-security-runtime.mjs";
import { createPortalRuntimeObservability } from "./portal-runtime-observability.mjs";
import { createPortalWorkspaceRuntime } from "./portal-workspace-runtime.mjs";
import {
  appendCookie,
  clearCookie,
  guessContentType,
  parseCookies,
  parseForm,
  readBody,
  safeJsonForHtml,
  sendFile,
  sendHtml,
  sendJson,
  sendStaticAsset,
  setCookie,
} from "./portal-runtime-http.mjs";
import { createPortalRuntimeRouteWiring } from "./portal-runtime-route-wiring.mjs";

const {
  layoutV2,
  layout,
  portalStore,
  clients: {
    billingClient,
    resourceProvisionerClient,
    minioStorageClient,
    harborRegistryClient,
    langfuseTraceClient,
  oplAdapterClient,
  },
  createOplLaunchService,
  createAuthRuntimeHandler,
  createFeatureRuntimeHandlers,
  createApiRuntimeHandlers,
  createPageRuntimePayloads,
  createServerPlanRuntimeHandler,
} = createPortalRuntimeBootstrap({
  layout: { safeJsonForHtml, userTheme },
  store: {
    atomicWriteJson,
    exists,
    sanitizeTaskTitle,
    getTaskPath,
  },
  clients: {
    billingServiceUrl: BILLING_SERVICE_URL,
    billingTimeoutMs: BILLING_SERVICE_TIMEOUT_MS,
    formatDateTime,
    harborApiUrl: HARBOR_API_URL,
    harborPassword: HARBOR_PASSWORD,
    harborUsername: HARBOR_USERNAME,
    langfuseProjectId: LANGFUSE_PROJECT_ID,
    langfusePublicKey: LANGFUSE_PUBLIC_KEY,
    langfuseSecretKey: LANGFUSE_SECRET_KEY,
    langfuseUrl: LANGFUSE_URL,
    mcBinary,
    minioApiUrl: MINIO_API_URL,
    oplRuntimeTimeoutMs: OPL_RUNTIME_TIMEOUT_MS,
    oplWebUrl: OPL_WEB_URL,
    portalOplAdapterUrl: PORTAL_OPL_ADAPTER_URL,
    portalWorkdir,
    provisionerTimeoutMs: RESOURCE_PROVISIONER_TIMEOUT_MS,
    provisionerUrl: RESOURCE_PROVISIONER_URL,
    repoRoot,
    syncWorkspaceToMinioScriptRelative,
  },
});

const execFileAsync = promisify(execFile);

const {
  buildAdminSecuritySummary,
  exchangeOidcCode,
  fetchOidcUserInfo,
  runZitadelAdminUser,
} = createPortalIdentitySecurityRuntime({
  env: {
    adminSeed,
    HARBOR_PASSWORD,
    PORTAL_IDENTITY_SYNC_MODE,
    PORTAL_OIDC_CLIENT_ID,
    PORTAL_OIDC_CLIENT_SECRET,
    PORTAL_OIDC_ISSUER,
    PORTAL_OIDC_REDIRECT_URI,
    PORTAL_OIDC_SCOPE,
    ZITADEL_ADMIN_USER_SCRIPT,
  },
  deps: {
    access: (file) => access(file, fsConstants.R_OK),
    execFileAsync,
    repoRoot,
  },
});

const {
  buildPortalHealthPayload,
  ensureStorageInfra,
  logPortalEvent,
  readDb,
  readPortalEvents,
  storageMode,
  writeDb,
} = portalStore;

const {
  fetchBillingStatus,
  fetchBillingSummary,
  fetchHarborSummary,
  fetchLangfuseSummary,
  fetchMinioSummary,
  fetchOplAdapterCosts,
  fetchOplAdapterRuns,
  fetchOplAdapterTraceRows,
  fetchPendingSummary,
  fetchServerPlans,
  fetchTraceRows,
  probe,
  readBillingRequestOptions,
  readOverviewRequestOptions,
  readSessionsRequestOptions,
  readTracesRequestOptions,
  runtimePerformanceSummary,
  workspaceChatSessionsForUser,
} = createPortalRuntimeObservability({
  billingClient,
  codexRuntimeEventsFile,
  codexRuntimeRoot,
  harborRegistryClient,
  langfuseTraceClient,
  minioStorageClient,
  oplAdapterClient,
  path,
  readFile,
  readdir,
});

const {
  archiveTaskSpace,
  collectRunsForTask,
  collectRunsForUser,
  currentTaskSpaceForUser,
  evaluateUserPolicy,
  fetchWorkspaceMinioState,
  fetchWorkspaceStorageSnapshot,
  findTaskSpace,
  handleUpload,
  hasActiveRuns,
  hasActiveWorkspaceSession,
  isRunTerminal,
  latestActiveWorkspaceSession,
  listFilesRecursive,
  listTaskSpacesForUser,
  markTaskSpaceDeleted,
  nextTaskSlug,
  readWorkspaceSession,
  restoreTaskSpace,
  safeRelativePath,
  syncWorkspaceFileToMinio,
  workspaceSessionCookie,
  workspaceStorageEntitlement,
  ensureTaskSpace,
  ensureWorkspaceSession,
} = createPortalWorkspaceRuntime({
  buildWorkspaceFileChecksum,
  buildWorkspaceStorageKey,
  codexRuntimeEventsFile,
  defaultTaskTitle,
  exists,
  getTaskPath,
  guessContentType,
  isBlockedUserStatus,
  layoutV2,
  logPortalEvent,
  markWorkspaceStorageDeleting,
  medRunsRoot,
  minioStorageClient,
  mkdir,
  path,
  randomUUID,
  readBody,
  readDb,
  readFile,
  readdir,
  recordWorkspaceFile,
  resolveWorkspaceStorageEntitlement,
  sanitizeTaskTitle,
  sendHtml,
  slugify,
  stat,
  writeDb,
  writeFile,
});

const oplLaunchService = createOplLaunchService({
  evaluateUserPolicy,
  findTaskSpace,
  ensureTaskSpace,
  ensureWorkspaceSession,
  createOplLaunch,
  providerSecretStore: createProviderSecretStore({ secretsRoot: PORTAL_OPL_PROVIDER_SECRET_ROOT }),
  resolveStorageEntitlement: workspaceStorageEntitlement,
  defaultTaskTitle,
  logPortalEvent,
  writeDb,
});
const {
  handleLabPackageRoutes,
  handleOplRoutes,
  handleResourceOrderRoutes,
  handleWorkspaceStorageRoutes,
} = createFeatureRuntimeHandlers({
  appendCookie,
  buildWorkspaceFileChecksum,
  buildWorkspaceStorageKey,
  createOrUpdateStorageOrder,
  defaultTaskTitle,
  ensureTaskSpace,
  exists,
  fetchServerPlans,
  fetchWorkspaceMinioState,
  fetchWorkspaceStorageSnapshot,
  findTaskSpace,
  guessContentType,
  issueWorkspaceTransferToken,
  layoutV2,
  listWorkspaceFiles,
  logPortalEvent,
  mkdir,
  normalizeAuthEmail,
  oplLaunchService,
  path,
  portalInternalAuthAllowed,
  readBody,
  readDb,
  readJsonBody,
  readWorkspaceTransferToken,
  recordWorkspaceFile,
  resourceProvisionerClient,
  safeRelativePath,
  sendFile,
  sendHtml,
  sendJson,
  slugify,
  stat,
  syncWorkspaceFileToMinio,
  workspaceStorageEntitlement,
  writeFile,
  writeDb,
});

const handleAuthRoutes = createAuthRuntimeHandler({
  clearCookie,
  createGflabProviderConfig,
  defaultTaskTitle,
  ensureTaskSpace,
  ensureUserCommercialState,
  exchangeOidcCode,
  fetchOidcUserInfo,
  isBlockedUserStatus,
  layoutV2,
  logPortalEvent,
  normalizeProviderApiKey,
  oplLaunchService,
  parseCookies,
  parseForm,
  portalInternalAuthAllowed,
  portalOidc: {
    clientId: PORTAL_OIDC_CLIENT_ID,
    clientSecret: PORTAL_OIDC_CLIENT_SECRET,
    enabled: PORTAL_OIDC_ENABLED,
    issuer: PORTAL_OIDC_ISSUER,
    redirectUri: PORTAL_OIDC_REDIRECT_URI,
    scope: PORTAL_OIDC_SCOPE,
  },
  readBody,
  redactProviderConfig,
  sendHtml,
  sendJson,
  setCookie,
  writeDb,
});

async function exists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function atomicWriteJson(file, value) {
  const tmp = `${file}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  const content = JSON.stringify(value, null, 2);
  await writeFile(tmp, content, "utf8");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rename(tmp, file);
      return;
    } catch (error) {
      if (attempt === 4) {
        await writeFile(file, content, "utf8");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
}

function getTaskPath(userId, taskSlug) {
  return path.join(medWorkspaceRoot, userId, taskSlug);
}

async function currentUser(req) {
  const db = await readDb();
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.portal_session;
  if (!sessionId) return { db, user: null };
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session) return { db, user: null };
  return { db, user: db.users.find((item) => item.id === session.userId) || null };
}

function portalInternalAuthAllowed(req) {
  if (!PORTAL_INTERNAL_AUTH_TOKEN) return true;
  return String(req.headers["x-portal-internal-token"] || "") === PORTAL_INTERNAL_AUTH_TOKEN;
}

async function readJsonBody(req) {
  const bodyText = (await readBody(req)).toString("utf8");
  if (!bodyText.trim()) return {};
  return JSON.parse(bodyText);
}

async function createOplLaunch({
  user,
  taskSpace,
  workspaceSession,
  requireRealOplWeb = false,
  providerConfig = null,
  providerConfigSecretRef = "",
  storageEntitlement = null,
}) {
  return oplAdapterClient.createLaunch({
    user,
    taskSpace,
    workspaceSession,
    requireRealOplWeb,
    providerConfig,
    providerConfigSecretRef,
    storageEntitlement,
  });
}

async function fetchHarborImageRows(limit = 50) {
  return harborRegistryClient.fetchImageRows(limit);
}

function groupNameById(db, groupId = "") {
  if (!groupId) return "";
  const group = db.groups.find((item) => item.id === groupId);
  return group?.name || "";
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

const {
  buildBillingPayload,
  buildOverviewPayload,
  buildWorkspacePayload,
} = createPageRuntimePayloads({
  buildCommercialProfile,
  buildOverviewOnboarding,
  buildServerPlansFallback,
  buildServerPlansSummary,
  collectRunsForUser,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  defaultTaskTitle,
  ensureTaskSpace,
  ensureWallet,
  evaluateUserPolicy,
  fetchBillingSummary,
  fetchPendingSummary,
  fetchServerPlans,
  findTaskSpace,
  formatDateOnly,
  formatDateTime,
  isRunTerminal,
  latestActiveWorkspaceSession,
  listFilesRecursive,
  listTaskSpacesForUser,
  mkdir,
  path,
  readPortalEvents,
  sanitizeTaskTitle,
  stat,
  workspaceStorageEntitlement,
});

const {
  buildCostsSummaryApiPayload,
  buildRegistryImagesApiPayload,
  buildRegistrySummaryApiPayload,
  buildRunCostsApiPayload,
  buildRunsApiPayload,
  buildSessionsApiPayload,
  buildTraceSummaryApiPayload,
  buildTracesApiPayload,
  buildWorkspaceCostsApiPayload,
  buildWorkspaceStorageApiPayload,
  handlePortalAdminApiRoutes,
  handlePortalApiRoutes,
} = createApiRuntimeHandlers({
  activeUserStatus,
  adminScopeResult,
  announcementRows,
  buildAdminSecuritySummary,
  buildCommercialProfile,
  buildWorkspacePayload,
  collectRunsForTask,
  collectRunsForUser,
  currentServerPlanSelection,
  currentTaskSpaceForUser,
  evaluateUserPolicy,
  fetchBillingStatus,
  fetchBillingSummary,
  fetchHarborImageRows,
  fetchHarborSummary,
  fetchLangfuseSummary,
  fetchMinioSummary,
  fetchOplAdapterCosts,
  fetchOplAdapterRuns,
  fetchOplAdapterTraceRows,
  fetchPendingSummary,
  fetchTraceRows,
  fetchWorkspaceMinioState,
  fetchWorkspaceStorageSnapshot,
  findTaskSpace,
  formatDateTime,
  humanizeStatus,
  isRunTerminal,
  latestActiveWorkspaceSession,
  listTaskSpacesForUser,
  money,
  probe,
  readPortalEvents,
  readSessionsRequestOptions,
  readTracesRequestOptions,
  readWorkspaceSession,
  redisConfigured: Boolean(process.env.REDIS_URL),
  runtimePerformanceSummary,
  sanitizeTaskTitle,
  sendJson,
  storageMode,
  urls: {
    harborUrl: HARBOR_URL,
    langfuseUrl: LANGFUSE_URL,
    minioConsoleUrl: MINIO_CONSOLE_URL,
    opencostUiUrl: OPENCOST_UI_URL,
    oplWebUrl: OPL_WEB_URL,
    portalOplAdapterUrl: PORTAL_OPL_ADAPTER_URL,
    rancherUrl: RANCHER_URL,
  },
  visibleAnnouncementRows,
  workspaceChatSessionsForUser,
});

const handleServerPlanRoutes = createServerPlanRuntimeHandler({
  defaultTaskTitle,
  ensureTaskSpace,
  evaluateUserPolicy,
  fetchBillingStatus,
  fetchServerPlans,
  findTaskSpace,
  logPortalEvent,
  readBody,
  sendJson,
  slugify,
  writeDb,
});
const {
  handlePortalAdminUserRoutes,
  handlePortalBillingExportRoutes,
  handlePortalTaskSpaceRoutes,
  handlePortalAdminOpsRoutes,
  handlePortalLegacyRedirectRoutes,
} = createPortalRuntimeRouteWiring({
  activeUserStatus,
  appendLedgerEntry,
  billingServiceUrl: BILLING_SERVICE_URL,
  buildBillingPayload,
  archiveTaskSpace,
  defaultTaskTitle,
  ensureTaskSpace,
  ensureUserCommercialState,
  evaluateUserPolicy,
  exists,
  fetchBillingSummary,
  fetchPendingSummary,
  findTaskSpace,
  handleUpload,
  hasActiveRuns,
  hasActiveWorkspaceSession,
  layoutV2,
  logPortalEvent,
  markTaskSpaceDeleted,
  mkdir,
  nextTaskSlug,
  parseCookies,
  parseForm,
  path,
  readBillingRequestOptions,
  readBody,
  readWorkspaceSession,
  restoreTaskSpace,
  runZitadelAdminUser,
  runtimeRoot,
  safeRelativePath,
  sendFile,
  sendHtml,
  sendJson,
  slugify,
  workspaceSessionCookie,
  writeDb,
});

const dispatchPortalHttpRequest = createPortalHttpDispatcher({
  buildBillingPayload,
  buildOverviewPayload,
  buildPortalHealthPayload,
  buildWorkspacePayload,
  currentUser,
  frontendDistRoot,
  guessContentType,
  handleAuthRoutes,
  handleLabPackageRoutes,
  handleOplRoutes,
  handlePortalAdminApiRoutes,
  handlePortalAdminOpsRoutes,
  handlePortalAdminUserRoutes,
  handlePortalApiRoutes,
  handlePortalBillingExportRoutes,
  handlePortalLegacyRedirectRoutes,
  handlePortalTaskSpaceRoutes,
  handleResourceOrderRoutes,
  handleServerPlanRoutes,
  handleWorkspaceStorageRoutes,
  layoutV2,
  logPortalEvent,
  parseForm,
  path,
  readBillingRequestOptions,
  readBody,
  readOverviewRequestOptions,
  sendHtml,
  sendJson,
  sendStaticAsset,
  slugify,
  writeDb,
});

const server = http.createServer(dispatchPortalHttpRequest);

ensureStorageInfra().then(() => {
  validateProductionConfig();
  server.listen(PORT, () => {
    console.log(`portal listening on :${PORT}`);
  });
});
