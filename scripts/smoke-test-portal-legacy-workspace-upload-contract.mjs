import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const runtimeSource = await readFile("services/portal/src/app/portal-runtime.mjs", "utf8");
const workspaceRuntimeSource = await readFile("services/portal/src/app/portal-workspace-runtime.mjs", "utf8");
const taskSpaceRoutesSource = await readFile("services/portal/src/routes/task-space.routes.mjs", "utf8");
const storageRoutesSource = await readFile("services/portal/src/routes/workspace-storage.routes.mjs", "utf8");
const uploadSupportSource = await readFile("services/portal/src/routes/workspace-storage-upload-support.mjs", "utf8");

assert.doesNotMatch(runtimeSource, /function handleUpload\b/, "portal_runtime_must_not_inline_legacy_workspace_upload");
assert.doesNotMatch(runtimeSource, /\breadMultipartFiles\b/, "portal_runtime_must_not_reference_multipart_parser_directly");
assert.doesNotMatch(runtimeSource, /\bpersistWorkspaceUpload\b/, "portal_runtime_must_not_reference_upload_persistence_directly");

assert.match(runtimeSource, /handleUpload,\s*[\s\S]*\} = createPortalWorkspaceRuntime\(/, "portal_runtime_must_receive_legacy_upload_handler_from_workspace_runtime");
assert.match(workspaceRuntimeSource, /createWorkspaceUploadSupport\(/, "workspace_runtime_must_use_shared_upload_support");
assert.match(workspaceRuntimeSource, /async function handleUpload\b/, "workspace_runtime_must_own_legacy_upload_handler");

assert.match(taskSpaceRoutesSource, /handleUpload,\s*[\s\S]*await handleUpload\(req, res, user, db\)/, "task_space_route_must_pass_current_db_to_legacy_upload_handler");
assert.match(storageRoutesSource, /from "\.\/workspace-storage-upload-support\.mjs"/, "workspace_storage_routes_must_use_shared_upload_support");
assert.match(uploadSupportSource, /export function createWorkspaceUploadSupport\(/, "upload_support_must_export_factory");
assert.match(uploadSupportSource, /function readMultipartFiles\(/, "upload_support_must_own_multipart_parser");
assert.match(uploadSupportSource, /async function persistWorkspaceUpload\(/, "upload_support_must_own_upload_persistence");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_legacy_workspace_upload",
}, null, 2));
