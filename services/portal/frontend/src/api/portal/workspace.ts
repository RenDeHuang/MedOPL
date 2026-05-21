import { apiClient } from "../client";
import type { PortalPagination, PortalQueryValue } from "./common";
import type { SelectedServerPlan } from "./server-plans";

export interface WorkspaceQuery {
  task?: PortalQueryValue;
  tasks_page?: PortalQueryValue;
  runs_page?: PortalQueryValue;
  inputs_page?: PortalQueryValue;
  outputs_page?: PortalQueryValue;
}

export interface WorkspaceResourceUsagePayload {
  source: string;
  taskRef: string;
  sessionId: string;
  workspaceId: string;
  status: string;
  latencyMs: number;
  inputFileCount: number;
  outputFileCount: number;
  outputBytes: number;
  costItemCount: number;
}

export interface WorkspaceCostEstimatePayload {
  amount: number;
  currency: string;
  source: string;
  pricingSource: string;
  status: string;
  billingTruth: boolean;
  pendingReconciliation: boolean;
  components: {
    compute: number;
    storage: number;
    total: number;
  };
}

export interface WorkspaceBalanceLinkPayload {
  linkedToBalance: boolean;
  chargeApplied: boolean;
  rechargeStatus: string;
  estimateOnly: boolean;
  estimatedAmount: number;
  currency: string;
  balanceCents: number;
  availableBalanceCents: number;
}

export interface ManagedResourceBindingPlanPayload {
  managedEnvironment: string;
  regionLabel: string;
  planSpec: string;
  status: string;
  estimatedCost: {
    amount: number;
    currency: string;
    source: string;
    status: string;
    billingTruth: boolean;
    chargeApplied: boolean;
  };
  releasePolicy: {
    status: string;
    releasedAt: string;
    billingStopConfirmBy: string;
    stopBillingConfirmWithinMinutes: number;
    protection: string;
  };
  auditStatus: {
    status: string;
    auditReadyAt: string;
    policy: string;
  };
  snapshot: {
    source: string;
    label: string;
    realResourceCreated: boolean;
    providerAdapterStage: string;
  };
}

export interface StorageEntitlementPayload {
  enabled: boolean;
  status: "disabled" | "active" | string;
  freeQuotaGb: number;
  minimumPurchaseGb: number;
  retentionPolicy: string;
  storageSizeGb: number;
  message: string;
}

export interface FileSpaceFolderPayload {
  folderRef: string;
  name: string;
  parentFolderRef: string;
  path: string;
  status: string;
}

export interface FileSpaceFilePayload {
  fileRef: string;
  name: string;
  folderRef: string;
  kind: "input" | "output" | string;
  source: "upload" | "runtime_output" | string;
  sessionId: string;
  taskRef: string;
  artifactRef: string;
  sizeBytes: number;
  status: string;
  deletedAt: string;
  retentionUntil: string;
}

export interface FileSpaceActionsPayload {
  createFolder: boolean;
  renameFolder: boolean;
  deleteFileOrFolder: boolean;
  uploadToCurrentFolder: boolean;
  moveFileOrFolder: boolean;
  selectFiles: boolean;
  batchDownload: boolean;
  batchDelete: boolean;
  permanentDeleteRequiresConfirmation: boolean;
  clearFileSpaceRequiresConfirmation: boolean;
}

export interface FileSpaceDeletePolicyPayload {
  ordinaryDeleteRequiresConfirmation: boolean;
  retentionDays: number;
  permanentDeleteRequiresConfirmation: boolean;
  clearFileSpaceRequiresConfirmation: boolean;
}

export interface FileSpacePayload {
  capacityGb: number;
  usedGb: number;
  retentionDays: number;
  currentFolderRef: string;
  folders: FileSpaceFolderPayload[];
  files: FileSpaceFilePayload[];
  selectedFileRefs: string[];
  actions: FileSpaceActionsPayload;
  deletePolicy: FileSpaceDeletePolicyPayload;
}

export function disabledStorageEntitlement(): StorageEntitlementPayload {
  return {
    enabled: false,
    status: "disabled",
    freeQuotaGb: 0,
    minimumPurchaseGb: 10,
    retentionPolicy: "workspace_lifecycle",
    storageSizeGb: 0,
    message: "storage_required",
  };
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
  managedResourceBindingPlan?: ManagedResourceBindingPlanPayload | null;
  fileSpace?: FileSpacePayload | null;
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
    taskRef: string;
    status: string;
    createdAt: string;
    resourceUsage?: WorkspaceResourceUsagePayload;
    costEstimate?: WorkspaceCostEstimatePayload;
    balanceLink?: WorkspaceBalanceLinkPayload;
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
    artifactRef?: string;
    fileRef?: string;
    taskRef?: string;
    sessionId?: string;
    workspaceId?: string;
    kind?: string;
    sizeBytes?: number;
    contentType?: string;
    status?: string;
    source?: string;
    resourceUsage?: WorkspaceResourceUsagePayload;
    costEstimate?: WorkspaceCostEstimatePayload;
    balanceLink?: WorkspaceBalanceLinkPayload;
    createdAt?: string;
    updatedAt?: string;
  }>;
  outputsPagination: PortalPagination;
  runsPagination: PortalPagination;
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
  userStorage: {
    available?: boolean;
    synced?: boolean;
    status?: string;
    note?: string;
    objects?: Array<{ key: string; size: number }>;
  };
  metadata?: Array<{
    fileRef: string;
    workspaceId: string;
    kind: "inputs" | "outputs" | "artifacts" | string;
    name: string;
    relativePath: string;
    sizeBytes: number;
    checksum: string;
    contentType: string;
    status: string;
    source: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface WorkspaceFileTransferPayload {
  workspaceId: string;
  provider: string;
  method: "GET" | "POST" | string;
  expiresAt: string;
  url: string;
  file: {
    kind: "inputs" | "outputs" | "artifacts" | string;
    name: string;
    relativePath: string;
    contentType?: string;
  };
}

export interface WorkspaceFileUploadUrlInput {
  task?: string;
  workspaceId?: string;
  kind?: "inputs" | "outputs";
  fileName: string;
  relativePath?: string;
  oplSessionId?: string;
  sessionId?: string;
}

export interface WorkspaceFileDownloadUrlParams {
  task?: string;
  workspaceId?: string;
  kind?: "inputs" | "outputs";
  file: string;
  relativePath?: string;
  oplSessionId?: string;
  sessionId?: string;
}

export async function fetchWorkspace(params: WorkspaceQuery = {}) {
  const { data } = await apiClient.get<WorkspacePayload>("/workspace", { params });
  return data;
}

export async function fetchWorkspaceStorage(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<WorkspaceStoragePayload>("/workspace/storage", { params });
  return data;
}

export async function fetchStorageEntitlement(params?: Record<string, string | number | undefined>) {
  const { data } = await apiClient.get<{ workspaceId: string; entitlement: StorageEntitlementPayload }>("/storage/entitlement", { params });
  return data;
}

export async function createWorkspaceFileUploadUrl(input: WorkspaceFileUploadUrlInput) {
  const { data } = await apiClient.post<WorkspaceFileTransferPayload>("/workspace/files/upload-url", input);
  return data;
}

export async function createWorkspaceFileDownloadUrl(params: WorkspaceFileDownloadUrlParams) {
  const { data } = await apiClient.get<WorkspaceFileTransferPayload>("/workspace/files/download-url", {
    params: {
      ...params,
      relativePath: params.relativePath || params.file,
    },
  });
  return data;
}
