import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const runtimeSource = await readFile("services/portal/src/app/portal-runtime.mjs", "utf8");
const workspaceSource = await readFile("services/portal/src/app/portal-workspace-runtime.mjs", "utf8");

assert.match(runtimeSource, /from "\.\/portal-workspace-runtime\.mjs"/, "portal_runtime_must_delegate_workspace_runtime");
assert.match(workspaceSource, /export function createPortalWorkspaceRuntime\(/, "workspace_runtime_must_export_factory");

for (const functionName of [
  "ensureTaskSpace",
  "archiveTaskSpace",
  "restoreTaskSpace",
  "markTaskSpaceDeleted",
  "ensureWorkspaceSession",
  "collectRunsForUser",
  "evaluateUserPolicy",
  "fetchWorkspaceStorageSnapshot",
]) {
  assert.match(workspaceSource, new RegExp(`function ${functionName}\\b`), `workspace_runtime_must_own_${functionName}`);
  assert.doesNotMatch(runtimeSource, new RegExp(`function ${functionName}\\b`), `portal_runtime_must_not_inline_${functionName}`);
}

assert.match(workspaceSource, /markWorkspaceStorageDeleting/, "workspace_runtime_must_preserve_storage_retention_hook");
assert.match(workspaceSource, /workspace_session/, "workspace_runtime_must_preserve_workspace_session_cookie");
assert.match(workspaceSource, /codex_runtime_run/, "workspace_runtime_must_preserve_codex_runtime_event_merge");
assert.match(runtimeSource, /createPortalWorkspaceRuntime\(\{[\s\S]*collectRunsForUser,[\s\S]*evaluateUserPolicy,/,
  "portal_runtime_must_wire_workspace_runtime_outputs");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_workspace_runtime",
}, null, 2));
