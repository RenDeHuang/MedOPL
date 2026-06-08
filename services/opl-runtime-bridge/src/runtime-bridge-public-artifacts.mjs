import { providerKeyRefFrom } from "./runtime-bridge-launch-scope.mjs";

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
