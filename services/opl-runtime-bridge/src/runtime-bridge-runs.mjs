import { addArtifactRecord, addSessionLedgerEntry, createRunRecord, updateRunStatus } from "./state-store.mjs";
import { providerKeyRefFrom } from "./runtime-bridge-launch-scope.mjs";

export const RUN_API_RUNTIME_MODES = Object.freeze({
  PLATFORM_PROVISIONED: "platform_provisioned",
  CUSTOMER_DEDICATED: "customer_dedicated",
  CLOUD_PROVISIONED: "platform_provisioned",
  USER_OWNED: "platform_provisioned",
  MANAGED_RUNTIME: "managed_runtime",
});

function normalizeRuntimeMode(value = "") {
  const mode = String(value || RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED).trim().toLowerCase();
  if (!mode) return RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED;
  if ([
    RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED,
    RUN_API_RUNTIME_MODES.CUSTOMER_DEDICATED,
  ].includes(mode)) {
    return RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED;
  }
  if (["cloud_provisioned", "cloud-provisioned", "user_owned", "user-owned", "user_owned_runtime", "user-owned-runtime"].includes(mode)) {
    return RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED;
  }
  return mode;
}

function runDispatchError({ message, code, details = {} }) {
  const error = new Error(message);
  error.code = code;
  error.stage = "platform_provisioned_runtime_dispatch";
  error.retryable = false;
  error.details = details;
  return error;
}

function platformRuntimeAgentRequiredError(runtimeMode) {
  return runDispatchError({
    message: "platform_isolated_runtime_agent_required",
    code: "PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED",
    details: {
      runtimeMode,
      requiredComponent: "platform-runtime-agent",
    },
  });
}

function apiOnlyRunUnsupportedError() {
  return runDispatchError({
    message: "api_only_run_unsupported",
    code: "API_ONLY_RUN_UNSUPPORTED",
    details: { mode: "api_only" },
  });
}

function resourceBindingRequiredError(scope = {}) {
  return runDispatchError({
    message: "resource_binding_required",
    code: "RESOURCE_BINDING_REQUIRED",
    details: scope,
  });
}

function runtimeAgentRelayNotImplementedError(scope = {}) {
  return runDispatchError({
    message: "runtime_agent_relay_not_implemented",
    code: "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED",
    details: scope,
  });
}

function normalizeArtifactRef(item = {}, run = {}, runtimeSession = {}) {
  if (!item || typeof item !== "object") return null;
  const relativePath = String(item.relativePath || item.relative_path || item.path || item.name || item.fileName || item.file_name || "").trim().replace(/^\/+/, "");
  const name = String(item.name || item.fileName || item.file_name || relativePath.split("/").pop() || "").trim();
  if (!relativePath || !name) return null;
  return {
    ...runtimeSession,
    ...run,
    kind: String(item.kind || item.fileKind || item.file_kind || "outputs").trim() || "outputs",
    name,
    relativePath,
    objectKey: String(item.objectKey || item.object_key || item.storageKey || item.storage_key || "").trim(),
    localPath: String(item.localPath || item.local_path || item.pathOnRuntime || item.path_on_runtime || "").trim(),
    sizeBytes: Number(item.sizeBytes ?? item.size_bytes ?? 0),
    contentType: String(item.contentType || item.content_type || "application/octet-stream").trim() || "application/octet-stream",
  };
}

function normalizeRuntimeArtifacts(response = {}, run = {}, runtimeSession = {}) {
  const candidates = [
    ...(Array.isArray(response.artifacts) ? response.artifacts : []),
    ...(Array.isArray(response.items) ? response.items : []),
    ...(response.artifact && typeof response.artifact === "object" ? [response.artifact] : []),
  ];
  return candidates.map((item) => normalizeArtifactRef(item, run, runtimeSession)).filter(Boolean);
}

export function publicRunArtifact(artifact = {}, run = {}, runtimeSession = {}) {
  const artifactId = String(artifact.artifactId || artifact.artifact_id || "").trim();
  return {
    artifactId,
    artifactRef: artifactId,
    runId: String(artifact.runId || artifact.run_id || run.runId || "").trim(),
    workspaceId: String(artifact.workspaceId || artifact.workspace_id || run.workspaceId || runtimeSession.workspaceId || "").trim(),
    resourceBindingId: String(artifact.resourceBindingId || artifact.resource_binding_id || run.resourceBindingId || runtimeSession.resourceBindingId || "").trim(),
    providerKeyRef: providerKeyRefFrom(artifact) || providerKeyRefFrom(run) || providerKeyRefFrom(runtimeSession),
    kind: String(artifact.kind || "outputs").trim() || "outputs",
    name: String(artifact.name || "").trim(),
    relativePath: String(artifact.relativePath || "").trim(),
    sizeBytes: Number(artifact.sizeBytes || 0),
    contentType: String(artifact.contentType || "application/octet-stream").trim() || "application/octet-stream",
  };
}

function publicRuntimeClaims(claims = {}, run = {}, runtimeSession = {}) {
  if (!claims || typeof claims !== "object") return null;
  return {
    runtimeSessionId: String(claims.runtimeSessionId || claims.runtime_session_id || run.runtimeSessionId || runtimeSession.runtimeSessionId || "").trim(),
    workspaceId: String(claims.workspaceId || claims.workspace_id || run.workspaceId || runtimeSession.workspaceId || "").trim(),
    providerKeyRef: providerKeyRefFrom(claims) || providerKeyRefFrom(run) || providerKeyRefFrom(runtimeSession),
  };
}

function retiredManagedRuntimeError(runtimeMode) {
  return runDispatchError({
    message: "managed_runtime_retired",
    code: "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED",
    details: { runtimeMode, retired: true },
  });
}

function fullRuntimeScope(runtimeSession = {}, input = {}) {
  return {
    mode: String(input.mode || runtimeSession.mode || "api_only").trim().toLowerCase() === "full_runtime" ? "full_runtime" : "api_only",
    resourceBindingId: String(input.resourceBindingId || input.resource_binding_id || runtimeSession.resourceBindingId || "").trim(),
    computeInstanceId: String(input.computeInstanceId || input.compute_instance_id || runtimeSession.computeInstanceId || "").trim(),
    storageBucketId: String(input.storageBucketId || input.storage_bucket_id || runtimeSession.storageBucketId || "").trim(),
    runtimeAgentId: String(input.runtimeAgentId || input.runtime_agent_id || runtimeSession.runtimeAgentId || "").trim(),
    runtimeAgentEndpoint: String(input.runtimeAgentEndpoint || input.runtime_agent_endpoint || runtimeSession.runtimeAgentEndpoint || "").trim().replace(/\/$/, ""),
  };
}

export function createRunApi({
  productRuntimeMode = process.env.PRODUCT_RUNTIME_MODE || RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED,
  runtimeAgentRelay = null,
}) {
  const runtimeMode = normalizeRuntimeMode(productRuntimeMode);

  async function submitRuntimeRun(state, runtimeSession, input, req) {
    const scope = fullRuntimeScope(runtimeSession, input);
    if (scope.mode !== "full_runtime") throw apiOnlyRunUnsupportedError();
    if (!scope.resourceBindingId || !scope.computeInstanceId || !scope.storageBucketId) {
      throw resourceBindingRequiredError(scope);
    }
    if (!scope.runtimeAgentId && !scope.runtimeAgentEndpoint) {
      throw platformRuntimeAgentRequiredError(runtimeMode);
    }
    if (!runtimeAgentRelay) {
      throw runtimeAgentRelayNotImplementedError(scope);
    }
    const runId = String(input.runId || input.run_id || "").trim();
    const traceId = String(input.traceId || input.trace_id || runtimeSession.traceId || "").trim();
    const response = await runtimeAgentRelay.relayRun({
      runtimeSession,
      input: {
        ...input,
        runId,
        traceId,
        providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
      },
      req,
    });
    const run = createRunRecord(state, {
      ...runtimeSession,
      ...input,
      runId: response.run?.runId || runId,
      traceId: response.run?.traceId || traceId,
      kind: response.run?.kind || input.kind || "med-autoscience",
      toolName: response.run?.toolName || input.toolName || input.tool_name || "med-autoscience",
      status: response.run?.status || "submitted",
      jobName: response.run?.jobName || "",
      userAgent: req?.headers?.["user-agent"] || "",
      providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
      resourceBindingId: scope.resourceBindingId,
    });
    const publicArtifacts = normalizeRuntimeArtifacts(response, run, runtimeSession).map((artifact) => {
      const persistedArtifact = addArtifactRecord(state, {
        ...artifact,
        workspaceId: run.workspaceId || runtimeSession.workspaceId || "",
        workspaceSessionId: run.workspaceSessionId || runtimeSession.workspaceSessionId || "",
        runtimeSessionId: run.runtimeSessionId || runtimeSession.runtimeSessionId || "",
        resourceBindingId: scope.resourceBindingId,
        providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
      });
      return publicRunArtifact(persistedArtifact, run, runtimeSession);
    });
    for (const ledgerEntry of Array.isArray(response.ledgerEntries) ? response.ledgerEntries : []) {
      addSessionLedgerEntry(state, {
        ...ledgerEntry,
        tenantId: runtimeSession.tenantId || "",
        portalUserId: runtimeSession.portalUserId || "",
        workspaceId: run.workspaceId || runtimeSession.workspaceId || "",
        workspaceSessionId: run.workspaceSessionId || runtimeSession.workspaceSessionId || "",
        runtimeSessionId: run.runtimeSessionId || runtimeSession.runtimeSessionId || "",
        resourceBindingId: scope.resourceBindingId,
        providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
        runId: run.runId,
        traceId: run.traceId,
        artifactRefs: publicArtifacts.map((artifact) => artifact.artifactRef),
      });
    }
    return {
      ...run,
      artifacts: publicArtifacts,
      runtimeClaims: publicRuntimeClaims(response.runtimeClaims || response.runtimeTokenClaims, run, runtimeSession),
      ledgerEntryCount: Array.isArray(response.ledgerEntries) ? response.ledgerEntries.length : 0,
    };
  }

  async function syncRunnerRun(state, run, runStatus = null) {
    if (runtimeMode === RUN_API_RUNTIME_MODES.MANAGED_RUNTIME) {
      throw retiredManagedRuntimeError(runtimeMode);
    }
    if (!runStatus) return run;
    return updateRunStatus(state, run.runId, runStatus) || run;
  }

  async function cancelRuntimeRun(runtimeSession, run, input = {}) {
    const scope = fullRuntimeScope(runtimeSession, input);
    if (scope.mode !== "full_runtime") {
      throw apiOnlyRunUnsupportedError();
    }
    if (!runtimeAgentRelay) {
      throw runtimeAgentRelayNotImplementedError(scope);
    }
    const response = await runtimeAgentRelay.cancelRun({
      runtimeSession,
      runId: run.runId,
      input: {
        ...input,
        runId: run.runId,
        providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
      },
    });
    return {
      status: response.status || "cancel_requested",
      ledgerEntryCount: Array.isArray(response.ledgerEntries) ? response.ledgerEntries.length : 0,
      runtimeClaims: publicRuntimeClaims(response.runtimeClaims || response.runtimeTokenClaims, run, runtimeSession),
    };
  }

  return {
    cancelRuntimeRun,
    runtimeMode,
    submitRuntimeRun,
    syncRunnerRun,
  };
}
