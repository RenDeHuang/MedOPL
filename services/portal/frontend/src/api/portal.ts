import { apiClient } from "./client";

export type PortalQueryValue = string | number | undefined;

export interface PortalPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  balance: number;
  lastActiveAt?: string;
  lastUsedAt?: string;
  createdAt?: string;
  deletedAt?: string;
}

export interface AdminUserFinanceRow {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  createdAt?: string;
  reason?: string;
}

export interface AdminUsersPayload {
  items: AdminUserListItem[];
  pagination: PortalPagination;
  allowRegistration: boolean;
  financeRows: AdminUserFinanceRow[];
  groups: Array<{ id: string; name: string }>;
  kpis?: Record<string, unknown>;
}

type PortalAdminActionValue = string | number | boolean | null | undefined;

interface PortalActionErrorShape {
  message?: string;
}

export interface OverviewQuery {
  tasks_page?: PortalQueryValue;
  runs_page?: PortalQueryValue;
}

export interface OverviewPayload {
  kpis: {
    accountStatus: string;
    billingStatus: string;
    entitlementStatus: string;
    balance: number;
    todayCost: number;
    historicalCost: number;
    activeTasks: number;
    workspaceCount: number;
    runCount: number;
    frozenAmount?: number;
    availableBalance?: number;
    pendingCostToday?: number;
    exactCostToday?: number;
    pendingCostMonth?: number;
    exactCostMonth?: number;
  };
  commercial: CommercialProfile;
  serverPlansSummary: ServerPlansSummary;
  selectedServerPlan?: SelectedServerPlan | null;
  onboarding: OnboardingPayload;
  resourceOrders?: ResourceOrdersPayload;
  taskCards: Array<{
    slug: string;
    title: string;
    status: string;
    runCount: number;
    updatedAt: string;
  }>;
  taskPagination: PortalPagination;
  latestRuns: Array<{
    runId: string;
    workspaceId: string;
    workspaceTitle: string;
    status: string;
    createdAt: string;
    displayTime: string;
  }>;
  latestRunsPagination: PortalPagination;
}

export interface BillingQuery {
  from?: PortalQueryValue;
  to?: PortalQueryValue;
  page_size?: PortalQueryValue;
  tasks_page?: PortalQueryValue;
  ledger_page?: PortalQueryValue;
  runs_page?: PortalQueryValue;
}

export interface BillingPayload {
  wallet: {
    balance: number;
  };
  totals: {
    cpuCost: number;
    gpuCost: number;
    pvCost: number;
    totalCost: number;
  };
  breakdown: {
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    vpnCost: number;
    trafficCost: number;
    otherCloudCost: number;
    cloudSource: string;
    pricingSource?: string;
  };
  summary: {
    selectedCost: number;
    runCount: number;
    workspaceCount: number;
  };
  taskCosts: Array<{
    slug: string;
    title: string;
    totalCost: number;
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    runCount: number;
  }>;
  taskPagination: PortalPagination;
  runCosts: Array<{
    runId: string;
    workspaceId: string;
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    totalCost: number;
    startedAt: string;
    endedAt: string;
    pricingSource: string;
    runStatus: string;
  }>;
  runPagination: PortalPagination;
  ledger: Array<{
    id?: string;
    type: string;
    amount: number;
    reason?: string;
    createdAt: string;
  }>;
  ledgerPagination: PortalPagination;
  filter: {
    range: string;
    from: string;
    to: string;
  };
  trend: {
    labels: string[];
    total: number[];
    cpu: number[];
    gpu: number[];
    storage: number[];
  };
  todayCost: number;
}

export interface WorkspaceQuery {
  task?: PortalQueryValue;
  tasks_page?: PortalQueryValue;
  runs_page?: PortalQueryValue;
  inputs_page?: PortalQueryValue;
  outputs_page?: PortalQueryValue;
}

export interface StorageEntitlementPayload {
  enabled: boolean;
  status: "disabled" | "active" | string;
  freeQuotaGb: number;
  minimumPurchaseGb: number;
  storageBackend: string;
  retentionPolicy: string;
  cosPrefix: string;
  resourceOrderId: string;
  storagePlanId: string;
  storageSizeGb: number;
  message: string;
}

export interface WorkspacePayload {
  workspace: {
    slug: string;
    title: string;
    status: string;
    serverPlan?: SelectedServerPlan | null;
    storageEntitlement?: StorageEntitlementPayload;
    createdAt: string | null;
    archivedAt: string | null;
    deletedAt: string | null;
  };
  counts: {
    inputs: number;
    outputs: number;
    runs: number;
    completedRuns: number;
  };
  costs: {
    cpuCost: number;
    gpuCost: number;
    pvCost: number;
    totalCost: number;
  };
  storageEntitlement?: StorageEntitlementPayload;
  runStatus: {
    running: number;
    completed: number;
  };
  activeSession: {
    id: string;
    createdAt: string | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
  } | null;
  recentRuns: Array<{
    runId: string;
    status: string;
    createdAt: string;
  }>;
  eventTimeline: Array<{
    type: string;
    occurredAt: string;
    workspaceId: string;
  }>;
  distribution: {
    inputBytes: number;
    outputBytes: number;
  };
  tasks: Array<{
    slug: string;
    title: string;
    status: string;
    inputs: number;
    outputs: number;
    runs: number;
    totalCost: number;
    updatedAt: string;
  }>;
  tasksPageRows: Array<{
    slug: string;
    title: string;
    status: string;
    inputs: number;
    outputs: number;
    runs: number;
    totalCost: number;
    updatedAt: string;
  }>;
  tasksPagination: PortalPagination;
  taskTreemap: Array<{
    name: string;
    value: number;
    task: {
      slug: string;
      title: string;
      status: string;
      inputs: number;
      outputs: number;
      runs: number;
      totalCost: number;
      updatedAt: string;
    };
  }>;
  files: Array<{
    name: string;
    fullPath: string;
  }>;
  filesPagination: PortalPagination;
  outputs: Array<{
    name: string;
    fullPath: string;
  }>;
  outputsPagination: PortalPagination;
  runsPagination: PortalPagination;
}

export interface CurrentUserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  accountStatus: string;
  billingStatus: string;
  entitlementStatus: string;
  commercial?: CommercialProfile;
  selectedServerPlan?: SelectedServerPlan | null;
  initials: string;
  currentTaskSlug: string;
}

export interface SelectedServerPlan {
  id: string;
  name: string;
  provider: string;
  region: string;
  zone: string;
  instanceType: string;
  cpu?: number;
  memoryGb?: number;
  gpu?: number;
  currency: string;
  priceStatus: string;
  originalPrice?: number;
  discountPrice: number;
  unitPrice: number;
  minBillableHours: number;
  riskFactor: number;
  reservationFloor: number;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  gpuCount: number;
  storageRequest: string;
  storageLimit: string;
  nodePool?: string;
  runtimeClass: string;
  nodeSelector: Record<string, string>;
  tolerations?: Array<{ key: string; operator: string; value: string; effect: string }>;
  provisioningMode?: string;
  tkeClusterId?: string;
  nodePoolId?: string;
  nodePoolCreatePayload?: Record<string, unknown> | null;
  nodePoolScalePayload?: Record<string, unknown> | null;
  provisionerPayload?: Record<string, unknown> | null;
  selectedAt: string;
  selectionNote: string;
}

export interface TrialEntitlement {
  kind: string;
  status: string;
  source: string;
  currency: string;
  totalCredit: number;
  remainingCredit: number;
  createdAt: string;
  expiresAt: string;
  note: string;
}

export interface CommercialProfile {
  accountStatus: string;
  billingStatus: string;
  entitlementStatus: string;
  walletBalance: number;
  balanceFloor: number;
  canEnterWorkbench: boolean;
  canStartChargeableRun: boolean;
  chargeBlockedReasons: string[];
  priceTransparency: string;
  trialEntitlement: TrialEntitlement | null;
  group: null | {
    id: string;
    name: string;
    balanceFloor: number;
    maxConcurrentRuns: number;
  };
}

export interface ServerPlansSummary {
  source: string;
  configured: boolean;
  priceEnabled: boolean;
  discoveryEnabled?: boolean;
  discoveredCount?: number;
  catalogCount: number;
  quotedCount: number;
  salableCount: number;
  priceStatus: string;
  lowestHourlyPrice: number;
  note: string;
  cloudStatus?: TencentCloudStatus | null;
}

export interface OnboardingPayload {
  nextStepId: string;
  items: Array<{
    id: string;
    title: string;
    state: string;
    href: string;
    description: string;
  }>;
}

export interface ServerPlanItem {
  id: string;
  name: string;
  provider: string;
  region: string;
  zone: string;
  instanceType: string;
  cpu: number;
  memoryGb: number;
  gpu: number;
  nodePool: string;
  runtimeClass: string;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<{ key: string; operator: string; value: string; effect: string }>;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  gpuCount?: number;
  storageRequest?: string;
  storageLimit?: string;
  minBillableHours: number;
  riskFactor: number;
  reservationFloor: number;
  priceStatus: string;
  salable: boolean;
  reason?: string;
  currency?: string;
  originalPrice?: number;
  discountPrice?: number;
  unitPrice?: number;
  provisioningMode?: string;
  tkeClusterId?: string;
  nodePoolId?: string;
  nodePoolCreatePayload?: Record<string, unknown> | null;
  nodePoolScalePayload?: Record<string, unknown> | null;
  provisionerPayload?: Record<string, unknown> | null;
  selectionNote?: string;
  source?: string;
}

export interface TencentCloudError {
  message?: string;
  code?: string;
  status?: number;
}

export interface TencentCloudStatus {
  provider?: string;
  region?: string;
  credentialsConfigured?: boolean;
  tokenConfigured?: boolean;
  priceEnabled?: boolean;
  billingEnabled?: boolean;
  billingRequired?: boolean;
  tencentRegion?: string;
  priceImageConfigured?: boolean;
  catalogConfigured?: boolean;
  discoveryEnabled?: boolean;
  lastQuoteAt?: string;
  lastQuoteError?: string;
  lastBillQueryAt?: string;
  lastBillQueryError?: string;
  exactBillingSource?: string;
  pendingSource?: string;
  price?: {
    enabled?: boolean;
    imageConfigured?: boolean;
    endpoint?: string;
    catalogConfigured?: boolean;
    catalogCount?: number;
    discoveryEnabled?: boolean;
    discoveryZonesConfigured?: boolean;
    discoveredCount?: number;
    quotedCount?: number;
    salableCount?: number;
    lastDiscoveryAt?: string;
    lastDiscoveryError?: TencentCloudError | null;
    lastQuoteAt?: string;
    lastQuoteError?: TencentCloudError | null;
  };
  billing?: {
    enabled?: boolean;
    required?: boolean;
    endpoint?: string;
    exactBillingSource?: string;
    lastBillQueryAt?: string;
    lastBillQueryError?: TencentCloudError | null;
  };
  provisioning?: {
    source?: string;
    automaticProvisionCount?: number;
    existingNodePoolCount?: number;
    note?: string;
  };
  readiness?: {
    cloudAccountConnected?: boolean;
    realPriceReady?: boolean;
    exactBillReady?: boolean;
    catalogReady?: boolean;
    serverPlansReady?: boolean;
  };
}

export interface CloudStatusPayload {
  ok: boolean;
  cloudStatus: TencentCloudStatus;
}

export interface ServerPlansPayload {
  ok: boolean;
  source: string;
  configured: boolean;
  priceEnabled: boolean;
  discoveryEnabled?: boolean;
  discoveredCount?: number;
  catalogCount: number;
  items: ServerPlanItem[];
  selectedServerPlan?: SelectedServerPlan | null;
  workspaceId?: string;
  note?: string;
  cloudStatus?: TencentCloudStatus | null;
  summary: ServerPlansSummary;
  commercial: CommercialProfile;
  freezePolicy: {
    source: string;
    basis: string;
    finalBilling: string;
    minBillableHoursDefault: number;
    pendingCostIntervalSeconds: number;
    opencostRole: string;
  };
}

export interface ResourceOrderItem {
  id: string;
  status: string;
  workspaceId: string;
  workspaceTitle?: string;
  runId?: string;
  serverPlanId?: string;
  serverPlanName?: string;
  region?: string;
  quotedAmount?: number;
  frozenAmount?: number;
  freezeAmount?: number;
  pendingCost?: number;
  exactCost?: number;
  currency?: string;
  pricingSource?: string;
  provisionRequestId?: string;
  cloudResourceIds?: string[];
  failedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResourceOrdersPayload {
  items: ResourceOrderItem[];
  summary?: {
    activeCount?: number;
    frozenAmount?: number;
    pendingAmount?: number;
    exactAmount?: number;
  };
}

export interface ResourceOrderQuoteInput {
  workspaceId?: string;
  workspaceSessionId?: string;
  serverPlanId: string;
  estimatedHours?: number;
}

export interface ResourceOrderFreezeInput {
  quoteId?: string;
  resourceOrderId?: string;
  workspaceId?: string;
  workspaceSessionId?: string;
  serverPlanId?: string;
  estimatedHours?: number;
}

export interface ResourceOrderMutationResult {
  ok: boolean;
  resourceOrderId?: string;
  quoteId?: string;
  order?: ResourceOrderItem | null;
  provisioner?: unknown;
}

export interface CloudResourcesPayload {
  ok: boolean;
  source?: string;
  resources: {
    ok?: boolean;
    reason?: string;
    cluster?: Record<string, unknown> | null;
    summary?: {
      nodePoolCount?: number;
      instanceCount?: number;
      taggedInstanceCount?: number;
      orderLinkedNodePoolCount?: number;
    };
    nodePools?: Array<Record<string, unknown>>;
    instances?: Array<Record<string, unknown>>;
  };
  resourceOrders?: {
    items: ResourceOrderItem[];
  };
}

export interface AnnouncementPayload {
  items: Array<{
    id: string;
    title: string;
    content: string;
    scope: string;
    status: string;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
    operatorId: string;
  }>;
  source: string;
  type: string;
}

export interface SessionsPayload {
  user: {
    id: string;
    name: string;
    email: string;
  };
  sessions: Array<{
    sessionId: string;
    sessionType: "ordinary" | "mas" | string;
    userId: string;
    userName: string;
    userEmail: string;
    workspaceId: string;
    workspaceSessionId: string;
    lastUsedAt: string;
    status: string;
    source: string;
  }>;
  pagination: PortalPagination;
  sources: Record<string, { source: string; type: string }>;
}

export interface RunsPayload {
  runs: Array<{
    runId: string;
    workspaceId: string;
    workspaceSessionId: string;
    userId: string;
    userName: string;
    userEmail?: string;
    status: string;
    startedAt: string;
    endedAt: string;
    source: string;
    type: string;
  }>;
  source: string;
  type: string;
  note?: string;
}

export interface WorkspaceStoragePayload {
  workspaceId: string;
  entitlement?: StorageEntitlementPayload;
  storage: {
    inputsCount: number;
    outputsCount: number;
    inputBytes: number;
    outputBytes: number;
  };
  minio: {
    available?: boolean;
    synced?: boolean;
    status?: string;
    note?: string;
    objects?: Array<{ key: string; size: number }>;
  };
}

export interface CostsSummaryPayload {
  source: string;
  type: string;
  note?: string;
  totals: {
    cpuCost: number;
    gpuCost: number;
    pvCost: number;
    totalCost: number;
  };
  items: any[];
}

export interface RunCostPayload {
  source: string;
  type: string;
  note?: string;
  runId: string;
  cost: null | {
    cpuCost: number;
    gpuCost: number;
    storageCost: number;
    totalCost: number;
    pricingSource: string;
  };
}

export interface RegistrySummaryPayload {
  available?: boolean;
  mode?: string;
  note?: string;
  projectCount?: number;
  repositoryCount?: number;
  artifactCount?: number;
  imageTagCount?: number;
  [key: string]: any;
}

export interface RegistryImagesPayload {
  items: any[];
  dataSource: string;
}

export interface TraceSummaryPayload {
  available?: boolean;
  mode?: string;
  note?: string;
  traceCount?: number;
  latestTraceAt?: string;
  dataSource?: string;
}

export interface TracesPayload {
  filters: {
    userId: string;
    workspaceId: string;
    runId: string;
    sessionId?: string;
    status?: string;
  };
  summary: TraceSummaryPayload;
  items: Array<{
    traceId: string;
    traceName: string;
    title?: string;
    userId: string;
    tenantId?: string;
    workspaceId: string;
    workspaceSessionId: string;
    runtimeSessionId?: string;
    runId: string;
    resourceOrderId?: string;
    serverPlanId?: string;
    model: string;
    sessionId: string;
    tokenCount: number;
    userAgent: string;
    latencyMs: number;
    inputPreview: string;
    startedAt: string;
    updatedAt?: string;
    status: string;
    businessStatus?: string;
    url: string;
    files?: {
      inputsCount: number;
      outputsCount: number;
      latestOutputs?: Array<{ name: string; size: number; downloadUrl: string }>;
    };
    billing?: {
      pendingCost: number;
      exactCost: number;
      source: string;
    };
  }>;
  pagination: PortalPagination;
  dataSource: string;
  note?: string;
}

export type SessionTracesPayload = TracesPayload;

export async function fetchOverview(params: OverviewQuery = {}) {
  const { data } = await apiClient.get<OverviewPayload>("/overview", { params });
  return data;
}

export async function fetchBilling(params: BillingQuery = {}) {
  const { data } = await apiClient.get<BillingPayload>("/billing", { params });
  return data;
}

export async function fetchServerPlans() {
  const { data } = await apiClient.get<ServerPlansPayload>("/server-plans");
  return data;
}

export async function fetchResourceOrders(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<ResourceOrdersPayload>("/resource-orders", { params });
  return data;
}

export async function fetchCloudResources() {
  const { data } = await apiClient.get<CloudResourcesPayload>("/cloud/resources");
  return data;
}

export async function quoteResourceOrder(input: ResourceOrderQuoteInput) {
  const { data } = await apiClient.post<ResourceOrderMutationResult>("/resource-orders/quote", input);
  return data;
}

export async function freezeResourceOrder(input: ResourceOrderFreezeInput) {
  const { data } = await apiClient.post<ResourceOrderMutationResult>("/resource-orders/freeze", input);
  return data;
}

export async function provisionResourceOrder(input: { resourceOrderId: string; runId?: string }) {
  const { data } = await apiClient.post<ResourceOrderMutationResult>("/resource-orders/provision", input);
  return data;
}

export async function releaseResourceOrder(input: { resourceOrderId: string; scaleToZero?: boolean }) {
  const { data } = await apiClient.post<ResourceOrderMutationResult>("/resource-orders/release", input);
  return data;
}

export async function deleteResourceOrderNodePool(input: {
  resourceOrderId: string;
  nodePoolId?: string;
  destroyCvmInstances: boolean;
  confirmDeleteNodePool: boolean;
}) {
  const { data } = await apiClient.post<ResourceOrderMutationResult>("/resource-orders/delete-node-pool", input);
  return data;
}

export async function selectServerPlan(input: { planId: string; task?: string }) {
  const { data } = await apiClient.post("/server-plans/select", input);
  return data as { ok: boolean; workspaceId: string; selectedServerPlan: SelectedServerPlan | null };
}

export async function fetchWorkspace(params: WorkspaceQuery = {}) {
  const { data } = await apiClient.get<WorkspacePayload>("/workspace", { params });
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get<CurrentUserPayload>("/me");
  return data;
}

export async function fetchAnnouncements(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<AnnouncementPayload>("/announcements", { params });
  return data;
}

export async function fetchSessions(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<SessionsPayload>("/sessions", { params });
  return data;
}

export async function fetchRuns(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<RunsPayload>("/runs", { params });
  return data;
}

export async function fetchWorkspaceStorage(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<WorkspaceStoragePayload>("/workspace/storage", { params });
  return data;
}

export async function fetchCostsSummary(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<CostsSummaryPayload>("/costs/summary", { params });
  return data;
}

export async function fetchWorkspaceCosts(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<CostsSummaryPayload>("/costs/workspace", { params });
  return data;
}

export async function fetchRunCosts(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<RunCostPayload>("/costs/run", { params });
  return data;
}

export async function fetchRegistrySummary() {
  const { data } = await apiClient.get<RegistrySummaryPayload>("/registry/summary");
  return data;
}

export async function fetchRegistryImages(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<RegistryImagesPayload>("/registry/images", { params });
  return data;
}

export async function fetchTraceSummary() {
  const { data } = await apiClient.get<TraceSummaryPayload>("/traces/summary");
  return data;
}

export async function fetchTraces(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<TracesPayload>("/traces", { params });
  return data;
}

export async function fetchSessionTraces(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<SessionTracesPayload>("/session-traces", { params });
  return data;
}

export async function fetchAdminAgentTraces(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<SessionTracesPayload>("/admin/agent-traces", { params });
  return data;
}

export async function fetchAdminOverview() {
  const { data } = await apiClient.get("/admin/overview");
  return data;
}

export async function fetchAdminUsers(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<AdminUsersPayload>("/admin/users", { params });
  return data;
}

function buildPortalAdminFormPayload(fields: Record<string, PortalAdminActionValue>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  return body;
}

function readPortalActionError(html: string, fallback: string) {
  if (!html) return fallback;
  if (typeof DOMParser === "undefined") return fallback;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const cardText = doc.querySelector(".card")?.textContent?.trim();
  const titleText = doc.querySelector("title")?.textContent?.trim();
  return cardText || titleText || fallback;
}

async function postPortalAdminAction(path: string, fields: Record<string, PortalAdminActionValue>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: buildPortalAdminFormPayload(fields),
  });

  if (response.ok) {
    return;
  }

  const html = await response.text().catch(() => "");
  const fallback = `请求失败（${response.status}）`;
  const error = new Error(readPortalActionError(html, fallback)) as Error & PortalActionErrorShape;
  error.message = readPortalActionError(html, fallback);
  throw error;
}

export async function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/create-user", {
    name: input.name,
    email: input.email,
    password: input.password,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function updateAdminRegistrationSettings(input: {
  allowRegistration: boolean;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/settings", {
    allowRegistration: input.allowRegistration,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function updateAdminUser(input: {
  userId: string;
  name: string;
  email: string;
  password?: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/update-user", {
    userId: input.userId,
    name: input.name,
    email: input.email,
    password: input.password || "",
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function toggleAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/toggle-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function rechargeAdminUser(input: {
  userId: string;
  amount: number;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/recharge", {
    userId: input.userId,
    amount: input.amount,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function refundAdminUser(input: {
  userId: string;
  amount: number;
  reason: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/ledger-adjust", {
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    actionType: "refund",
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function deleteAdminUser(input: {
  userId: string;
  redirectTo?: string;
}) {
  await postPortalAdminAction("/portal/admin/delete-user", {
    userId: input.userId,
    redirectTo: input.redirectTo || "/portal/app/admin/users",
  });
}

export async function fetchAdminGroups() {
  const { data } = await apiClient.get("/admin/groups");
  return data;
}

export async function fetchAdminBillingOps() {
  const { data } = await apiClient.get("/admin/billing-ops");
  return data;
}

export async function fetchAdminUsage(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get("/admin/usage", { params });
  return data;
}

export async function fetchAdminSystem() {
  const { data } = await apiClient.get("/admin/system");
  return data;
}

export async function fetchAdminOps() {
  const { data } = await apiClient.get("/admin/ops");
  return data;
}

export async function fetchAdminSandboxes() {
  const { data } = await apiClient.get("/admin/sandboxes");
  return data;
}

export async function fetchAdminAudit(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get("/admin/audit", { params });
  return data;
}

export async function fetchAdminAlerts() {
  const { data } = await apiClient.get("/admin/alerts");
  return data;
}

export async function fetchAdminUserPortrait(userId: string) {
  const { data } = await apiClient.get("/admin/user", { params: { userId } });
  return data;
}

export async function fetchAdminWorkspacePortrait(userId: string, workspaceId: string) {
  const { data } = await apiClient.get("/admin/workspace", { params: { userId, workspaceId } });
  return data;
}

export async function fetchAdminRunPortrait(runId: string) {
  const { data } = await apiClient.get("/admin/run", { params: { runId } });
  return data;
}
