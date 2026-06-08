import { addArtifactRecord } from "./state-store-artifact-trace-mutations.mjs";
import { addSessionLedgerEntry } from "./state-store-session-ledger.mjs";
import { addEvent } from "./state-store-events.mjs";
import { nowIso } from "./state-store-record-time.mjs";
import { buildRunRecord } from "./state-store-run-records.mjs";
import { providerKeyRefFrom } from "./runtime-bridge-launch-scope.mjs";
import { publicRunArtifact } from "./runtime-bridge-public-artifacts.mjs";
import {
  isWebuiRuntimeMode,
  launchTokenFrom,
  readBody,
  runIdFromInput,
  sendJson,
  traceIdFromInput,
} from "./runtime-bridge-routes-http.mjs";
import { runBelongsToLaunch } from "./runtime-bridge-launch-lookup.mjs";
import {
  publicGatedRun,
  runtimeRunMetadataRefs,
} from "./runtime-bridge-contract-payloads.mjs";
import { mapRunError } from "./run-error-mapper.mjs";

export const RUN_API_RUNTIME_MODES = Object.freeze({
  PLATFORM_PROVISIONED: "platform_provisioned",
  CUSTOMER_DEDICATED: "customer_dedicated",
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
  if (["cloud_provisioned", "cloud-provisioned"].includes(mode)) {
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
    artifactId: String(item.artifactId || item.artifact_id || item.artifactRef || item.artifact_ref || item.outputFileRef || item.output_file_ref || "").trim(),
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

function publicMetadataRef(value = "") {
  const ref = String(value || "").trim();
  if (!ref || ref.length > 128) return "";
  if (/[\\/]/.test(ref) || /^https?:/i.test(ref)) return "";
  return /^[a-zA-Z0-9._:-]+$/.test(ref) ? ref : "";
}

function runtimeMetadataRefsFromLedgerEntries(entries = []) {
  const refs = {
    billingMetadataRef: "",
    usageMetadataRef: "",
  };
  for (const entry of Array.isArray(entries) ? entries : []) {
    const costSummary = entry?.costSummary && typeof entry.costSummary === "object" ? entry.costSummary : {};
    refs.billingMetadataRef ||= publicMetadataRef(costSummary.billingMetadataRef || costSummary.billing_metadata_ref);
    refs.usageMetadataRef ||= publicMetadataRef(costSummary.usageMetadataRef || costSummary.usage_metadata_ref);
  }
  return refs;
}

function publicRuntimeClaims(claims = {}, run = {}, runtimeSession = {}) {
  if (!claims || typeof claims !== "object") return null;
  return {
    runtimeSessionId: String(claims.runtimeSessionId || claims.runtime_session_id || run.runtimeSessionId || runtimeSession.runtimeSessionId || "").trim(),
    workspaceId: String(claims.workspaceId || claims.workspace_id || run.workspaceId || runtimeSession.workspaceId || "").trim(),
    providerKeyRef: providerKeyRefFrom(claims) || providerKeyRefFrom(run) || providerKeyRefFrom(runtimeSession),
  };
}

function runtimeLedgerEntryInput(ledgerEntry = {}, { runtimeSession = {}, run = {}, scope = {}, providerKeyRef = "", artifactRefs = [] } = {}) {
  const metadata = ledgerEntry.metadata && typeof ledgerEntry.metadata === "object" ? ledgerEntry.metadata : {};
  return {
    tenantId: runtimeSession.tenantId || "",
    portalUserId: runtimeSession.portalUserId || "",
    workspaceId: run.workspaceId || runtimeSession.workspaceId || "",
    workspaceSessionId: run.workspaceSessionId || runtimeSession.workspaceSessionId || "",
    runtimeSessionId: run.runtimeSessionId || runtimeSession.runtimeSessionId || "",
    sessionId: runtimeSession.oplSessionId || runtimeSession.runtimeSessionId || "",
    oplSessionId: runtimeSession.oplSessionId || "",
    resourceBindingId: scope.resourceBindingId,
    providerKeyRef,
    runId: run.runId,
    traceId: run.traceId,
    eventType: ledgerEntry.eventType || ledgerEntry.event_type || "runtime_event",
    status: ledgerEntry.status || run.status || "recorded",
    usage: ledgerEntry.usage && typeof ledgerEntry.usage === "object" ? ledgerEntry.usage : {},
    costSummary: ledgerEntry.costSummary && typeof ledgerEntry.costSummary === "object" ? ledgerEntry.costSummary : {},
    metadata: {
      publicStatus: metadata.publicStatus || metadata.public_status || metadata.status || ledgerEntry.status || run.status || "recorded",
    },
    artifactRefs,
    createdAt: ledgerEntry.createdAt || ledgerEntry.created_at || "",
    updatedAt: ledgerEntry.updatedAt || ledgerEntry.updated_at || "",
  };
}

function createRunRecord(state, input = {}) {
  const run = buildRunRecord(input);
  state.runs.push(run);
  addEvent(state, "runner_run_submitted", run);
  return run;
}

function updateRunStatus(state, runId, patch = {}) {
  const run = state.runs.find((item) => item.runId === runId);
  if (!run) return null;
  Object.assign(run, {
    ...patch,
    updatedAt: nowIso(),
  });
  addEvent(state, "runner_run_status_synced", run);
  return run;
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

function runnerFailureEvent(runtimeSession = {}, mapped = {}) {
  return {
    ...runtimeSession,
    correlationId: mapped.correlationId,
    code: mapped.code,
    stage: mapped.stage,
    retryable: mapped.retryable,
    error: mapped.message,
    details: mapped.details,
  };
}

function runtimeAgentRequiredByContract(error) {
  return [
    "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED",
    "PLATFORM_PROVISIONED_RUNTIME_AGENT_REQUIRED",
  ].includes(String(error?.code || ""));
}

function runStatusUrlFor(runId = "") {
  return `/api/opl/runs/${encodeURIComponent(String(runId || ""))}/status`;
}

export function createRunApi({
  productRuntimeMode = process.env.PRODUCT_RUNTIME_MODE || RUN_API_RUNTIME_MODES.PLATFORM_PROVISIONED,
  config = {},
  eventApi = null,
  launchApi = null,
  readLaunchRuntimeSession = null,
  runtimeAgentRelay = null,
  updateState: updateRuntimeState = null,
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
    const metadataRefs = runtimeMetadataRefsFromLedgerEntries(response.ledgerEntries);
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
      ...metadataRefs,
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
      addSessionLedgerEntry(state, runtimeLedgerEntryInput(ledgerEntry, {
        runtimeSession,
        run,
        scope,
        providerKeyRef: providerKeyRefFrom(input) || providerKeyRefFrom(runtimeSession),
        artifactRefs: publicArtifacts.map((artifact) => artifact.artifactRef),
      }));
    }
    return {
      ...run,
      artifacts: publicArtifacts,
      ...metadataRefs,
      runtimeClaims: publicRuntimeClaims(response.runtimeClaims || response.runtimeTokenClaims, run, runtimeSession),
      ledgerEntryCount: Array.isArray(response.ledgerEntries) ? response.ledgerEntries.length : 0,
    };
  }

  async function syncRunnerRun(state, run, runStatus = null) {
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

  async function handleRunStatus(req, res, url, match) {
    const launchToken = launchTokenFrom({}, url, req);
    const launch = launchApi?.verifyLaunchToken?.(launchToken);
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return;
    }
    let status = 200;
    let payload = null;
    if (typeof updateRuntimeState !== "function") {
      sendJson(res, 500, { ok: false, error: "runtime_state_store_missing" });
      return;
    }
    await updateRuntimeState(async (state) => {
      const run = state.runs.find((item) => item.runId === match[1]);
      if (!run || !runBelongsToLaunch(run, launch)) {
        status = 404;
        payload = { ok: false, error: "run_not_found" };
        return;
      }
      const synced = await syncRunnerRun(state, run);
      payload = { ok: true, run: synced || run };
    });
    sendJson(res, status, payload);
  }

  async function handleRuntimeRunInput(input, req, res, url, { successStatus = 200 } = {}) {
    const resolved = await readLaunchRuntimeSession(input, url, req, res);
    if (!resolved) return;
    const { runtimeSession } = resolved;
    let status = successStatus;
    let payload = null;
    await updateRuntimeState(async (state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      try {
        const run = await submitRuntimeRun(state, activeRuntimeSession, input, req);
        await eventApi.publishTraceEvent(state, {
          ...activeRuntimeSession,
          runId: run.runId,
          traceId: run.traceId,
          ...runtimeRunMetadataRefs(run),
          artifactRefs: (run.artifacts || []).map((artifact) => artifact.artifactRef).filter(Boolean),
          eventType: "runtime_run",
          traceName: "OPL runtime run",
          status: run.status || "recorded",
          model: input.model || activeRuntimeSession.model || "opl-runtime",
          tokenCount: Number(input.tokenCount || input.token_count || 0),
          userAgent: req?.headers?.["user-agent"] || "",
        });
        payload = { ok: true, run, artifacts: run.artifacts || [] };
      } catch (error) {
        if (isWebuiRuntimeMode(config.runtimeMode) && runtimeAgentRequiredByContract(error)) {
          const run = createRunRecord(state, {
            ...activeRuntimeSession,
            ...input,
            runId: input.runId || input.run_id || runIdFromInput(input),
            traceId: input.traceId || input.trace_id || activeRuntimeSession.traceId || "",
            status: "gated",
            error: "requires_runtime_agent",
            kind: input.kind || "opl-runtime",
            toolName: input.toolName || input.tool_name || "opl-runtime",
            resourceBindingId: activeRuntimeSession.resourceBindingId || input.resourceBindingId || input.resource_binding_id || "",
            providerKeyRef: activeRuntimeSession.providerKeyRef || input.providerKeyRef || input.provider_key_ref || "",
          });
          eventApi.recordEvent(state, "downstream_runtime_gate_evaluated", {
            ...activeRuntimeSession,
            runId: run.runId,
            traceId: run.traceId,
            status: "gated",
            error: "requires_runtime_agent",
            gate: "run_not_observed",
            code: error.code || "",
          });
          status = 409;
          payload = {
            ok: false,
            error: "requires_runtime_agent",
            gate: "run_not_observed",
            status: "gated",
            run: publicGatedRun(run),
            statusUrl: runStatusUrlFor(run.runId),
          };
          return;
        }
        status = 502;
        const mapped = mapRunError(error, { correlationId: input?.correlationId || input?.correlation_id || "" });
        eventApi.recordEvent(state, "runner_run_failed", runnerFailureEvent(activeRuntimeSession, mapped));
        payload = { ok: false, error: mapped };
      }
    });
    sendJson(res, status, payload);
  }

  async function handleRuntimeRun(req, res, url) {
    await handleRuntimeRunInput(await readBody(req), req, res, url);
  }

  async function handleRuntimeBridgeRun(req, res, url) {
    const input = await readBody(req);
    Object.assign(input, {
      mode: input.mode || "full_runtime",
      runId: runIdFromInput(input),
      traceId: traceIdFromInput(input),
    });
    await handleRuntimeRunInput(input, req, res, url, { successStatus: 201 });
  }

  return {
    cancelRuntimeRun,
    handleRuntimeBridgeRun,
    handleRuntimeRun,
    handleRuntimeRunInput,
    handleRunStatus,
    runtimeMode,
    submitRuntimeRun,
    syncRunnerRun,
  };
}
