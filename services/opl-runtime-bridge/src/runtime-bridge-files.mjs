import { readState, updateState } from "./state-store-core.mjs";
import { addArtifactRecord } from "./state-store-artifact-trace-mutations.mjs";
import { addEvent } from "./state-store-events.mjs";
import { artifactGatePayload, fileGatePayload } from "./runtime-bridge-contract-payloads.mjs";
import { isWebuiRuntimeMode, launchTokenFrom, readBody, sendJson } from "./runtime-bridge-routes-http.mjs";
import { publicRunArtifact } from "./runtime-bridge-public-artifacts.mjs";
import { runBelongsToLaunch, runtimeSessionByLaunch } from "./runtime-bridge-launch-lookup.mjs";

function artifactBelongsToLaunch(artifact = {}, launch = {}) {
  return artifact.runtimeSessionId === launch.runtimeSessionId &&
    artifact.workspaceSessionId === launch.workspaceSessionId &&
    artifact.workspaceId === launch.workspaceId;
}

function runtimeAgentRelaySupportsFile(relay = null) {
  return Boolean(relay && typeof relay.relayFile === "function");
}

export function createRuntimeBridgeFileApi({
  config,
  launchApi,
  runApi,
  runtimeAgentRelay,
}) {
  async function readLaunchRuntimeSession(input, url, req, res) {
    const launch = launchApi.verifyLaunchToken(launchTokenFrom(input, url, req));
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return null;
    }
    const state = await readState();
    const runtimeSession = runtimeSessionByLaunch(state, launch);
    if (!runtimeSession) {
      sendJson(res, 404, { ok: false, error: "runtime_session_not_found" });
      return null;
    }
    return { launch, state, runtimeSession };
  }

  async function readLaunchForRequest(req, url, res) {
    const launchToken = launchTokenFrom({}, url, req);
    const launch = launchApi.verifyLaunchToken(launchToken);
    if (!launch) {
      sendJson(res, 401, { ok: false, error: "launch_token_invalid" });
      return null;
    }
    const state = await readState();
    return { launch, launchToken, state };
  }

  async function handleRuntimeBridgeFile(req, res, url) {
    const input = await readBody(req);
    const resolved = await readLaunchRuntimeSession(input, url, req, res);
    if (!resolved) return;
    const { runtimeSession } = resolved;
    const relativePath = String(input.relativePath || input.relative_path || input.fileName || input.file_name || input.name || "").trim().replace(/^\/+/, "");
    if (!relativePath) {
      sendJson(res, 422, { ok: false, error: "file_name_required" });
      return;
    }
    let artifact = null;
    let publicArtifact = null;
    if (isWebuiRuntimeMode(config.runtimeMode)) {
      let payload = null;
      await updateState((state) => {
        const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
        addEvent(state, "opl_file_gate_evaluated", {
          ...activeRuntimeSession,
          error: "file_upload_capability_not_supported",
          gate: "file_ref_not_observed",
          capability: "file_upload",
          source: "webui_bridge",
          fileName: input.name || input.fileName || input.file_name || relativePath.split("/").pop() || "",
          sizeBytes: Number(input.sizeBytes ?? input.size_bytes ?? 0),
          contentType: String(input.contentType || input.content_type || "application/octet-stream").trim() || "application/octet-stream",
        });
        payload = fileGatePayload({ runtimeSession: activeRuntimeSession, input, relativePath });
      });
      sendJson(res, 409, payload);
      return;
    }
    if (runtimeAgentRelaySupportsFile(runtimeAgentRelay) && (runtimeSession.runtimeAgentEndpoint || input.runtimeAgentEndpoint || input.runtime_agent_endpoint)) {
      let payload = null;
      await updateState(async (state) => {
        const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
        const relayedFile = await runtimeAgentRelay.relayFile({
          runtimeSession: activeRuntimeSession,
          input: {
            ...input,
            relativePath,
          },
          req,
        });
        artifact = addArtifactRecord(state, {
          ...activeRuntimeSession,
          ...relayedFile,
          artifactId: relayedFile.fileRef || relayedFile.artifactRef,
          runId: String(input.runId || input.run_id || activeRuntimeSession.oplSessionId || activeRuntimeSession.runtimeSessionId || "").trim(),
          kind: relayedFile.kind || "inputs",
          resourceBindingId: activeRuntimeSession.resourceBindingId || input.resourceBindingId || input.resource_binding_id || "",
          providerKeyRef: activeRuntimeSession.providerKeyRef || input.providerKeyRef || input.provider_key_ref || "",
        });
        addEvent(state, "runtime_agent_file_referenced", {
          ...activeRuntimeSession,
          artifactId: artifact.artifactId,
          fileRef: artifact.artifactId,
          kind: artifact.kind,
        });
        publicArtifact = {
          ...publicRunArtifact(artifact, {
            runId: artifact.runId,
            workspaceId: activeRuntimeSession.workspaceId,
            resourceBindingId: activeRuntimeSession.resourceBindingId,
            providerKeyRef: activeRuntimeSession.providerKeyRef,
          }, activeRuntimeSession),
          fileRef: artifact.artifactId,
          workspaceSessionId: activeRuntimeSession.workspaceSessionId || "",
          runtimeSessionId: activeRuntimeSession.runtimeSessionId || "",
          status: relayedFile.status || "ready",
          source: relayedFile.source || "runtime_agent_http",
        };
        payload = {
          ok: true,
          fileRef: publicArtifact.fileRef,
          file: publicArtifact,
        };
      });
      sendJson(res, 201, payload);
      return;
    }
    await updateState((state) => {
      const activeRuntimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === runtimeSession.runtimeSessionId) || runtimeSession;
      artifact = addArtifactRecord(state, {
        ...activeRuntimeSession,
        runId: String(input.runId || input.run_id || input.sessionId || activeRuntimeSession.oplSessionId || activeRuntimeSession.runtimeSessionId || "").trim(),
        kind: String(input.kind || "inputs").trim() || "inputs",
        name: String(input.name || input.fileName || input.file_name || relativePath.split("/").pop() || "").trim(),
        relativePath,
        sizeBytes: Number(input.sizeBytes ?? input.size_bytes ?? 0),
        contentType: String(input.contentType || input.content_type || "application/octet-stream").trim() || "application/octet-stream",
      });
      addEvent(state, "opl_file_referenced", {
        ...activeRuntimeSession,
        artifactId: artifact.artifactId,
        kind: artifact.kind,
      });
      publicArtifact = publicRunArtifact(artifact, {
        runId: artifact.runId,
        workspaceId: activeRuntimeSession.workspaceId,
        resourceBindingId: activeRuntimeSession.resourceBindingId,
        providerKeyRef: activeRuntimeSession.providerKeyRef,
      }, activeRuntimeSession);
    });
    sendJson(res, 201, {
      ok: true,
      fileRef: publicArtifact.artifactRef,
      file: publicArtifact,
    });
  }

  async function handleRunArtifacts(req, res, url, match) {
    const resolved = await readLaunchForRequest(req, url, res);
    if (!resolved) return;
    const { launch } = resolved;
    let status = 200;
    let payload = null;
    await updateState(async (state) => {
      const run = state.runs.find((item) => item.runId === match[1]);
      if (!run || !runBelongsToLaunch(run, launch)) {
        status = 404;
        payload = { ok: false, error: "run_not_found" };
        return;
      }
      await runApi.syncRunnerRun(state, run).catch((error) => {
        addEvent(state, "runner_artifact_sync_failed", { ...run, error: String(error.message || error) });
        return null;
      });
      const items = state.artifacts
        .filter((item) => item.runId === match[1])
        .map((item) => publicRunArtifact(item, run, state.runtimeSessions.find((session) => session.runtimeSessionId === run.runtimeSessionId) || {}));
      if (!items.length && isWebuiRuntimeMode(config.runtimeMode)) {
        addEvent(state, "artifact_output_gate_evaluated", {
          ...run,
          error: "artifact_not_observed",
          gate: "output_file_ref_not_observed",
        });
        status = 409;
        payload = artifactGatePayload({ runId: run.runId });
        return;
      }
      payload = {
        ok: true,
        items,
      };
    });
    sendJson(res, status, payload);
  }

  async function handleRuntimeBridgeArtifact(req, res, url, match) {
    const resolved = await readLaunchForRequest(req, url, res);
    if (!resolved) return;
    const { launch, state } = resolved;
    const artifactRef = decodeURIComponent(match[1] || "");
    const artifact = state.artifacts.find((item) => item.artifactId === artifactRef);
    if (!artifact || !artifactBelongsToLaunch(artifact, launch)) {
      sendJson(res, 404, isWebuiRuntimeMode(config.runtimeMode)
        ? artifactGatePayload({ artifactRef })
        : { ok: false, error: "artifact_not_found" });
      return;
    }
    const run = state.runs.find((item) => item.runId === artifact.runId) || {};
    const runtimeSession = state.runtimeSessions.find((item) => item.runtimeSessionId === artifact.runtimeSessionId) || {};
    sendJson(res, 200, {
      ok: true,
      artifact: publicRunArtifact(artifact, run, runtimeSession),
    });
  }

  async function handleRunsList(_req, res) {
    const state = await readState();
    sendJson(res, 200, {
      ok: true,
      items: state.runs.map((run) => ({
        ...run,
        artifacts: state.artifacts
          .filter((item) => item.runId === run.runId)
          .map((item) => publicRunArtifact(item, run, state.runtimeSessions.find((session) => session.runtimeSessionId === run.runtimeSessionId) || {})),
      })),
    });
  }

  async function handleArtifactsList(_req, res) {
    const state = await readState();
    sendJson(res, 200, {
      ok: true,
      items: state.artifacts.map((item) => {
        const run = state.runs.find((entry) => entry.runId === item.runId) || {};
        const runtimeSession = state.runtimeSessions.find((session) => session.runtimeSessionId === item.runtimeSessionId) || {};
        return publicRunArtifact(item, run, runtimeSession);
      }),
    });
  }

  return {
    handleArtifactsList,
    handleRunArtifacts,
    handleRuntimeBridgeArtifact,
    handleRuntimeBridgeFile,
    handleRunsList,
  };
}
