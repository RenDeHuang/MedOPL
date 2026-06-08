import { publicRunArtifact } from "./runtime-bridge-public-artifacts.mjs";

const FORBIDDEN_SHAPE_FIELD_PATTERN = /rawProviderKey|providerSecret|apiKey|launchToken|runtimeToken|bearerToken|objectKey|storageKey|localPath|signedUrl|presignedUrl|pathOnRuntime/i;

function text(value = "") {
  return String(value ?? "").trim();
}

function providerKeyRefFrom(...records) {
  for (const record of records) {
    const ref = text(record?.providerKeyRef || record?.provider_key_ref);
    if (ref) return ref;
  }
  return "";
}

function runtimeSessionShape(runtimeSession = {}) {
  return {
    type: "runtimeResource",
    name: "runtimeSession",
    runtimeSessionId: text(runtimeSession.runtimeSessionId || runtimeSession.runtime_session_id),
    workspaceId: text(runtimeSession.workspaceId || runtimeSession.workspace_id),
    workspaceSessionId: text(runtimeSession.workspaceSessionId || runtimeSession.workspace_session_id),
    providerKeyRef: providerKeyRefFrom(runtimeSession),
  };
}

function runtimeRunToolShape(run = {}, runtimeSession = {}) {
  return {
    type: "runtimeTool",
    name: "runtime.run",
    runId: text(run.runId || run.run_id),
    traceId: text(run.traceId || run.trace_id || runtimeSession.traceId || runtimeSession.trace_id),
    toolName: text(run.toolName || run.tool_name) || "opl-runtime",
    providerKeyRef: providerKeyRefFrom(run, runtimeSession),
    inputSchema: {
      type: "object",
      required: ["runtimeSessionId", "workspaceId", "providerKeyRef"],
    },
  };
}

function runtimePromptShape(run = {}, runtimeSession = {}) {
  return {
    type: "runtimePrompt",
    name: "runtimePrompt",
    runId: text(run.runId || run.run_id),
    runtimeSessionId: text(runtimeSession.runtimeSessionId || runtimeSession.runtime_session_id),
    providerKeyRef: providerKeyRefFrom(run, runtimeSession),
  };
}

function runtimeArtifactShape(artifact = {}, run = {}, runtimeSession = {}) {
  const publicArtifact = publicRunArtifact(artifact, run, runtimeSession);
  return {
    type: "runtimeArtifact",
    ...publicArtifact,
  };
}

function runtimeApprovalShape(run = {}) {
  return {
    type: "runtimeApproval",
    name: "runtimeApproval",
    runId: text(run.runId || run.run_id),
    status: "future_authorized_only",
    approvalRequired: false,
  };
}

function boundaryShape() {
  return {
    shapeOnly: true,
    productionMcpServer: false,
    externalClientsAuthorized: false,
    realCloudAuthorized: false,
    secretReadAuthorized: false,
    deployAuthorized: false,
    kubectlAuthorized: false,
    buildPushAuthorized: false,
    liveTestAuthorized: false,
  };
}

export function assertMcpCompatibleShapeOnly(payload = {}) {
  const serialized = JSON.stringify(payload || {});
  if (FORBIDDEN_SHAPE_FIELD_PATTERN.test(serialized)) {
    throw new Error("mcp_compatible_shape_forbidden_field_detected");
  }
  if (payload?.boundary?.shapeOnly !== true) {
    throw new Error("mcp_compatible_shape_only_boundary_required");
  }
  for (const field of [
    "productionMcpServer",
    "externalClientsAuthorized",
    "realCloudAuthorized",
    "secretReadAuthorized",
    "deployAuthorized",
  ]) {
    if (payload.boundary[field] !== false) {
      throw new Error(`mcp_compatible_boundary_must_not_authorize:${field}`);
    }
  }
  return payload;
}

export function buildMcpCompatibleRuntimeShapes({
  runtimeSession = {},
  run = {},
  artifact = {},
} = {}) {
  const payload = {
    boundary: boundaryShape(),
    tools: [
      runtimeRunToolShape(run, runtimeSession),
    ],
    resources: [
      runtimeSessionShape(runtimeSession),
    ],
    prompts: [
      runtimePromptShape(run, runtimeSession),
    ],
    artifacts: [
      runtimeArtifactShape(artifact, run, runtimeSession),
    ],
    runtimeApproval: runtimeApprovalShape(run),
  };
  return assertMcpCompatibleShapeOnly(payload);
}
