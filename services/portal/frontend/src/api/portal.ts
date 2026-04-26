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
    balance: number;
    todayCost: number;
    historicalCost: number;
    activeTasks: number;
    workspaceCount: number;
    runCount: number;
  };
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

export interface WorkspacePayload {
  workspace: {
    slug: string;
    title: string;
    status: string;
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
  initials: string;
  currentTaskSlug: string;
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
    userId: string;
    workspaceId: string;
    workspaceSessionId: string;
    runId: string;
    model: string;
    sessionId: string;
    tokenCount: number;
    userAgent: string;
    latencyMs: number;
    inputPreview: string;
    startedAt: string;
    status: string;
    url: string;
  }>;
  pagination: PortalPagination;
  dataSource: string;
  note?: string;
}

export async function fetchOverview(params: OverviewQuery = {}) {
  const { data } = await apiClient.get<OverviewPayload>("/overview", { params });
  return data;
}

export async function fetchBilling(params: BillingQuery = {}) {
  const { data } = await apiClient.get<BillingPayload>("/billing", { params });
  return data;
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
