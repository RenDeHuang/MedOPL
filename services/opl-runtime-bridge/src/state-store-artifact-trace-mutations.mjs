import {
  buildArtifactRecord,
  buildTraceRecord,
} from "./state-store-artifact-trace-records.mjs";
import { addEvent } from "./state-store-events.mjs";

export function addArtifactRecord(state, input = {}) {
  const artifact = buildArtifactRecord(input);
  const exists = state.artifacts.find((item) =>
    item.runId === artifact.runId &&
    item.objectKey === artifact.objectKey &&
    item.localPath === artifact.localPath &&
    item.name === artifact.name
  );
  if (exists) return exists;
  state.artifacts.push(artifact);
  addEvent(state, "runner_artifact_synced", artifact);
  return artifact;
}

export function addTraceRecord(state, input = {}) {
  const trace = buildTraceRecord(input);
  state.traceLinks.push(trace);
  return trace;
}
