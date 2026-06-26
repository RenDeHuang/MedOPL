import { goControlPlaneClient } from "../client";

export interface OplLaunchInput {
  workspaceId?: string;
  task?: string;
}

export interface OplProviderKeyInput {
  workspaceId?: string;
  apiKey: string;
}

export interface OplProviderKeyPayload {
  ok: boolean;
  workspaceId: string;
  providerBound: boolean;
  providerKeyRef: string;
  boundStatus: string;
}

export interface OplEntryPreflightPayload {
  ok: boolean;
  error?: string;
  workspaceId: string;
  providerBound: boolean;
  providerKeyRef: string;
  boundStatus: string;
  launchStatus: string;
  readyForManagedEnvironment: boolean;
  nextAction: string;
  reason?: string;
}

export interface OplRuntimeGateInput {
  workspaceId?: string;
  invocationMode?: "ordinary_chat" | "runtime_required" | "api_only";
  runtimePlanId?: string;
  storagePlanId?: string;
  sessionId?: string;
  taskRef?: string;
  taskIntent?: "paper" | "grant" | "ppt" | "book" | "research" | string;
}

export interface OplRuntimeGateCommercialAction {
  action: "open_medopl_purchase" | "select_plan" | "recharge_or_credit_required" | "open_runtime_storage" | "return_to_opl_task" | string;
  reason: string;
  workspaceId: string;
  sessionId: string;
  taskRef: string;
  taskIntent: string;
  requiredPlan: string;
  planRequirement: {
    runtimePlanId: string;
    storagePlanId: string;
    compute: string;
    storage: string;
  };
  balanceRequirement: {
    currency: string;
    minRequiredBalance: number;
    currentBalance: number;
    availableBalance: number;
    activeFreeze: number;
  };
  medoplDeeplink: string;
  returnToOplDeeplink: string;
  returnToOplTaskContract: OplReturnToTaskContract;
  canClaim: string[];
  cannotClaim: string[];
}

export interface OplReturnToTaskContract {
  resumeAction: "return_to_opl_task" | string;
  resumeMethod: "GET" | string;
  workspaceId: string;
  sessionId: string;
  taskRef: string;
  taskIntent: string;
  returnToOplDeeplink: string;
  requiredConsumer: "opl-webui" | string;
  canClaim: string[];
  cannotClaim: string[];
}

export interface OplPurchaseActionProjection {
  workspaceId: string;
  sessionId: string;
  taskRef: string;
  taskIntent: string;
  requiredPlan: string;
  selectedPlanId: string;
  balance: number;
  availableBalance: number;
  activeFreeze: number;
  minRequiredBalance: number;
  canOpenRuntimeStorage: boolean;
  selectPlanAction: { action: string; label: string; href: string; method: string };
  rechargeOrCreditAction: { action: string; label: string; href: string; method: string };
  openRuntimeStorageAction: { action: string; label: string; href: string; method: string };
  returnToOplAction: { action: string; label: string; href: string; method: string };
  returnToOplTaskContract: OplReturnToTaskContract;
  canClaim: string[];
  cannotClaim: string[];
}

export interface OplRuntimeGatePayload {
  ok: boolean;
  productOwner: "medopl";
  primaryConsumer: "opl-webui";
  consumerRole: "entry_and_chat_surface";
  ordinaryChatOwner: "opl-webui";
  runtimeRequiredOwner: "medopl";
  workspaceId: string;
  workspaceBindingId: string;
  invocationMode: string;
  medoplRuntimeRequired: boolean;
  providerKeyStatus: string;
  providerKeyRef?: string;
  runtimePlanId: string;
  runtimeBindingId?: string;
  runtimeState: string;
  storagePlanId: string;
  storageBindingId?: string;
  storageState: string;
  nodePoolProjection: {
    nodePoolRef?: string;
    state: string;
    customerVisible: boolean;
  };
  billing: {
    freezeStatus: string;
    frozenAmount: number;
    currency: string;
  };
  release: {
    canReleaseRuntime: boolean;
    destroyStorage: string;
    stopBilling: string;
  };
  consumerProjection: {
    chatSurface: "opl-webui";
    runSurface: string;
    uploadEnabled: boolean;
    runEnabled: boolean;
    artifactEnabled: boolean;
    releaseAction: string;
    storageAction: string;
  };
  actionContract: {
    primaryAction: OplRuntimeGateCommercialAction;
    availableActions: OplRuntimeGateCommercialAction[];
    purchaseProjection?: OplPurchaseActionProjection;
  };
  nextAction: string;
  cannotClaim: string[];
}

export interface OplLaunchPayload {
  ok: boolean;
  launchId: string;
  openUrl: string;
  oplWebUrl: string;
  launchStatus: string;
  workspaceId: string;
  providerBound: boolean;
  providerKeyRef: string;
}

export interface OplBootstrapPayload {
  runtimeBridgeContractVersion: string;
  capabilities: string[];
  supportedEvents: string[];
  identity: {
    portalUserId: string;
    workspaceId: string;
    workspaceSessionId: string;
    runtimeSessionId: string;
    oplSessionId: string;
  };
}

export interface OplSessionBindInput {
  launchId: string;
  oplSessionId: string;
  clientSessionState?: Record<string, unknown>;
}

export interface OplMessageInput {
  launchId: string;
  message: string;
  waitForCompletion?: boolean;
}

export interface OplFileInput {
  launchId: string;
  fileName: string;
  relativePath?: string;
  contentType: string;
  sizeBytes: number;
}

export interface OplRunInput {
  launchId: string;
  message: string;
  fileRefs: string[];
  toolName?: string;
  mode?: "full_runtime";
}

export interface OplFileRefPayload {
  ok: boolean;
  fileRef?: string;
  error?: string;
  gate?: string;
  status?: string;
  capability?: string;
  file?: {
    fileRef?: string;
    name?: string;
    relativePath?: string;
    sizeBytes?: number;
    contentType?: string;
    status?: string;
  };
}

export interface OplRunStatusPayload {
  runRef?: string;
  status: string;
  error?: string;
}

export interface OplRunPayload {
  ok: boolean;
  error?: string;
  gate?: string;
  status?: string;
  statusUrl?: string;
  run?: OplRunStatusPayload;
  artifacts?: Array<{
    artifactRef: string;
    name: string;
    relativePath: string;
    sizeBytes: number;
    contentType: string;
  }>;
}

export interface OplArtifactPayload {
  ok: boolean;
  error?: string;
  gate?: string;
  status?: string;
  artifactRef?: string;
  artifact?: {
    artifactRef: string;
    workspaceId: string;
    providerKeyRef: string;
    kind: string;
    name: string;
    relativePath: string;
    sizeBytes: number;
    contentType: string;
  };
}

function launchParams(launchId: string) {
  return { launchId };
}

export async function createOplLaunch(input: OplLaunchInput) {
  const { data } = await goControlPlaneClient.post<OplLaunchPayload>("/opl/launch", input);
  return data;
}

export async function fetchOplEntryPreflight(input: OplLaunchInput = {}) {
  const { data } = await goControlPlaneClient.post<OplEntryPreflightPayload>("/opl/entry/preflight", input);
  return data;
}

export async function fetchOplRuntimeGate(input: OplRuntimeGateInput = {}) {
  const { data } = await goControlPlaneClient.post<OplRuntimeGatePayload>("/opl/runtime-gate", {
    workspaceId: input.workspaceId,
    invocationMode: input.invocationMode || "runtime_required",
    runtimePlanId: input.runtimePlanId || "starter_2c4g_10gb",
    storagePlanId: input.storagePlanId || "workspace_10gb",
    sessionId: input.sessionId,
    taskRef: input.taskRef,
    taskIntent: input.taskIntent || "research",
  });
  return data;
}

export async function bindProviderKeyForOplEntry(input: OplProviderKeyInput) {
  const { data } = await goControlPlaneClient.post<OplProviderKeyPayload>("/v22/provider-key", {
    workspaceId: input.workspaceId,
    apiKey: input.apiKey,
    idempotencyKey: `opl-entry-provider-key:${input.workspaceId || "workspace-local-rc"}`,
  });
  return data;
}

export async function fetchOplBootstrap(launchId: string) {
  const { data } = await goControlPlaneClient.get<OplBootstrapPayload>("/opl/bootstrap", {
    params: launchParams(launchId),
  });
  return data;
}

export async function bindOplSession(input: OplSessionBindInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post("/opl/sessions/bind", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function sendOplMessage(input: OplMessageInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post("/opl/messages", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplMessageStatus(launchId: string, messageId: string) {
  const { data } = await goControlPlaneClient.get(`/opl/messages/${encodeURIComponent(messageId)}/status`, {
    params: launchParams(launchId),
  });
  return data;
}

export async function createOplFileRef(input: OplFileInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post<OplFileRefPayload>("/opl/files", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function startOplRun(input: OplRunInput) {
  const { launchId, ...body } = input;
  const { data } = await goControlPlaneClient.post<OplRunPayload>("/opl/runs", body, {
    params: launchParams(launchId),
  });
  return data;
}

export async function fetchOplArtifact(launchId: string, artifactRef: string) {
  const { data } = await goControlPlaneClient.get<OplArtifactPayload>(`/opl/artifacts/${encodeURIComponent(artifactRef)}`, {
    params: launchParams(launchId),
  });
  return data;
}
