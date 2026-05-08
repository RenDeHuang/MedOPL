function text(value = "") {
  return String(value ?? "").trim();
}

function hasForbiddenSecretField(value) {
  const serialized = JSON.stringify(value || {});
  return /apiKey|providerApiKey|rawProviderKey|launchToken|runtimeToken|bearerToken|runtimeEnv|OPL_CODEX_API_KEY|OPENAI_API_KEY|GFLABTOKEN/i.test(serialized);
}

function assertNoSecretRelay(input = {}) {
  if (!hasForbiddenSecretField(input)) return;
  const error = new Error("local_fake_runtime_relay_secret_field_forbidden");
  error.code = "LOCAL_FAKE_RUNTIME_RELAY_SECRET_FIELD_FORBIDDEN";
  throw error;
}

function fileRefsFrom(input = {}) {
  return (Array.isArray(input.fileRefs) ? input.fileRefs : [])
    .map(text)
    .filter(Boolean);
}

export function createLocalFakeRuntimeAgentRelay() {
  async function relayRun({ runtimeSession = {}, input = {} } = {}) {
    assertNoSecretRelay(input);
    const runId = text(input.runId || input.run_id);
    if (!runId) throw new Error("local_fake_runtime_run_id_required");
    const traceId = text(input.traceId || input.trace_id || runtimeSession.traceId);
    const fileRefs = fileRefsFrom(input);
    if (!fileRefs.length) throw new Error("local_fake_runtime_file_ref_required");
    const artifactName = `${runId}-result.md`;
    return {
      run: {
        runId,
        traceId,
        kind: "opl-local-e2e-run",
        toolName: text(input.toolName || input.tool_name || "opl-local-e2e"),
        status: "succeeded",
      },
      artifacts: [{
        kind: "outputs",
        name: artifactName,
        relativePath: `outputs/${runId}/${artifactName}`,
        sizeBytes: 128,
        contentType: "text/markdown",
      }],
      ledgerEntries: [{
        eventType: "runtime_run_succeeded",
        status: "succeeded",
        usage: {
          inputTokens: 12,
          outputTokens: 8,
          totalTokens: 20,
        },
        costSummary: {
          currency: "USD",
          estimatedCost: 0,
        },
        metadata: {
          publicStatus: "succeeded",
        },
      }],
      runtimeClaims: {
        runtimeSessionId: text(input.runtimeSessionId || runtimeSession.runtimeSessionId),
        workspaceId: text(input.workspaceId || runtimeSession.workspaceId),
        providerKeyRef: text(input.providerKeyRef || runtimeSession.providerKeyRef),
      },
    };
  }

  async function cancelRun() {
    return {
      status: "cancel_requested",
      ledgerEntries: [],
      runtimeClaims: {},
    };
  }

  return {
    cancelRun,
    relayRun,
  };
}
