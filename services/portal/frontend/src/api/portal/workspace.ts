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

export function disabledStorageEntitlement(): StorageEntitlementPayload {
  return {
    enabled: false,
    status: "disabled",
    freeQuotaGb: 0,
    minimumPurchaseGb: 10,
    storageBackend: "portal_storage",
    retentionPolicy: "order_lifecycle",
    cosPrefix: "",
    resourceOrderId: "",
    storagePlanId: "",
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
  metadata?: WorkspaceFileRecord[];
}

export interface StorageOrderPayload {
  workspaceId: string;
  order: {
    id: string;
    status: string;
    storagePlanId: string;
    storageSizeGb: number;
    storageBackend: string;
    retentionPolicy: string;
    cosPrefix: string;
    createdAt: string;
    updatedAt: string;
  };
  entitlement: StorageEntitlementPayload;
}

export interface WorkspaceFileRecord {
  id: string;
  tenantId: string;
  userId: string;
  workspaceId: string;
  runId?: string;
  kind: "inputs" | "outputs" | "artifacts" | string;
  name: string;
  relativePath: string;
  storageKey: string;
  localPath: string;
  sizeBytes: number;
  checksum: string;
  contentType: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
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
    storageKey?: string;
    contentType?: string;
  };
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

export async function createStorageOrder(input: { task?: string; workspaceId?: string; storageSizeGb: number; storagePlanId?: string }) {
  const { data } = await apiClient.post<StorageOrderPayload>("/storage/orders", input);
  return data;
}

export async function createWorkspaceFileUploadUrl(input: { task?: string; workspaceId?: string; kind?: "inputs" | "outputs"; fileName: string; relativePath?: string }) {
  const { data } = await apiClient.post<WorkspaceFileTransferPayload>("/workspace/files/upload-url", input);
  return data;
}

export async function createWorkspaceFileDownloadUrl(params: { task?: string; workspaceId?: string; kind?: "inputs" | "outputs"; file: string; relativePath?: string }) {
  const { data } = await apiClient.get<WorkspaceFileTransferPayload>("/workspace/files/download-url", {
    params: {
      ...params,
      relativePath: params.relativePath || params.file,
    },
  });
  return data;
}
