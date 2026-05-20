import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createWorkspacePayloadBuilder } from "../../../services/portal/src/app/portal-page-workspace-payloads.mjs";
import { isSmokeClassifiedIn } from "../../../scripts/v22-test-classification.mjs";

const RAW_API_KEY = "gflabtoken_raw_key_file_space";
const SECRET_ID = "secret-id-file-space";
const SECRET_KEY = "secret-key-file-space";

const forbiddenFieldPattern = /objectKey|storageKey|localPath|signedUrl|cosBucket|cosPrefix|SecretId|SecretKey|kubeconfig|rawApiKey|apiKey|bearerToken/i;
const forbiddenValuePattern = new RegExp([
  RAW_API_KEY,
  SECRET_ID,
  SECRET_KEY,
  "kubeconfig-file-space",
  "bearer-token-file-space",
  "runtime/internal/object",
  "workspace-storage-key",
  "/runtime/private/file",
  "signed.example.test",
  "cos-prefix-must-not-leak",
  "cos-prefix-proof-must-not-leak",
  "cos_standard_workspace_quota",
].map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

const fileSpaceAllowedKeys = Object.freeze([
  "capacityGb",
  "usedGb",
  "retentionDays",
  "currentFolderRef",
  "folders",
  "files",
  "selectedFileRefs",
  "actions",
  "deletePolicy",
]);

const folderAllowedKeys = Object.freeze([
  "folderRef",
  "name",
  "parentFolderRef",
  "path",
  "status",
]);

const fileAllowedKeys = Object.freeze([
  "fileRef",
  "name",
  "folderRef",
  "kind",
  "source",
  "sessionId",
  "taskRef",
  "artifactRef",
  "sizeBytes",
  "status",
  "deletedAt",
  "retentionUntil",
]);

function assertExactKeys(object = {}, expected = [], label = "object") {
  assert.deepEqual(Object.keys(object), expected, `${label}_keys_mismatch`);
}

function assertNoForbiddenLeak(value, label) {
  const serialized = JSON.stringify(value);
  assert.equal(forbiddenFieldPattern.test(serialized), false, `${label}_must_not_include_forbidden_field`);
  assert.equal(forbiddenValuePattern.test(serialized), false, `${label}_must_not_include_forbidden_value`);
}

function assertUserCopy(source, label) {
  for (const required of [
    "文件空间",
    "输入文件",
    "输出文件",
    "上传文件",
    "下载全部结果",
    "结果回流",
    "文件空间可读写",
    "前往运行环境",
  ]) {
    assert(source.includes(required), `${label}_missing_user_copy:${required}`);
  }
  for (const forbidden of [
    "CVM",
    "COS bucket",
    "cosBucket",
    "cosPrefix",
    "K8s",
    "TKE",
    "objectKey",
    "storageKey",
    "localPath",
    "signedUrl",
    "SecretId",
    "SecretKey",
    "kubeconfig",
    "raw API Key",
    "token",
  ]) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_show_forbidden_copy:${forbidden}`);
  }
}

function interfaceBody(source = "", name = "") {
  const match = source.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert(match, `workspace_types_missing_interface:${name}`);
  return match[1];
}

const user = {
  id: "user-v22-file-space",
  tenantId: "tenant-v22-file-space",
  email: "file-space@example.test",
  role: "user",
};

const workspaceId = "workspace-v22-file-space";
const runId = "run-v22-file-space";
const sessionId = "session-v22-file-space";
const outputRef = "artifact-v22-file-space-output";

const db = {
  users: [user],
  taskSpaces: [{
    slug: workspaceId,
    userId: user.id,
    path: `/tmp/${workspaceId}`,
    title: "File Space Management",
    status: "active",
    serverPlanId: "pro_8c16g_100gb",
    createdAt: "2026-05-08T08:00:00.000Z",
  }],
  workspaceSessions: [],
  workspaceFiles: [
    {
      id: "file-v22-input",
      tenantId: user.tenantId,
      userId: user.id,
      workspaceId,
      kind: "inputs",
      name: "dataset.csv",
      relativePath: "project-a/dataset.csv",
      folderRef: "folder-project-a",
      sizeBytes: 1024,
      contentType: "text/csv",
      status: "active",
      source: "upload",
      selected: true,
      SecretId: SECRET_ID,
      SecretKey: SECRET_KEY,
      kubeconfig: "kubeconfig-file-space",
      rawApiKey: RAW_API_KEY,
      bearerToken: "bearer-token-file-space",
      objectKey: "runtime/internal/object/input.csv",
      storageKey: "workspace-storage-key",
      localPath: "/runtime/private/file/input.csv",
      signedUrl: "https://signed.example.test/input.csv",
      cosBucket: "must-not-leak",
      cosPrefix: "cos-prefix-must-not-leak",
      createdAt: "2026-05-08T08:01:00.000Z",
      updatedAt: "2026-05-08T08:02:00.000Z",
    },
    {
      id: outputRef,
      tenantId: user.tenantId,
      userId: user.id,
      workspaceId,
      runId,
      oplSessionId: sessionId,
      kind: "outputs",
      name: "result.md",
      relativePath: "project-a/result.md",
      folderRef: "folder-project-a",
      sizeBytes: 2048,
      contentType: "text/markdown",
      status: "retention_protected",
      source: "runtime_bridge_artifact_reference",
      deletedAt: "2026-05-08T09:00:00.000Z",
      retentionCleanupAfterAt: "2026-05-15T09:00:00.000Z",
      objectKey: "runtime/internal/object/result.md",
      storageKey: "workspace-storage-key",
      localPath: "/runtime/private/file/result.md",
      signedUrl: "https://signed.example.test/result.md",
      createdAt: "2026-05-08T08:03:00.000Z",
      updatedAt: "2026-05-08T09:00:00.000Z",
    },
  ],
  workspaceFolders: [
    {
      id: "folder-project-a",
      folderRef: "folder-project-a",
      workspaceId,
      name: "project-a",
      parentFolderRef: "root",
      path: "/project-a",
      status: "active",
      cosPrefix: "cos-prefix-must-not-leak",
    },
  ],
};

const buildWorkspacePayload = createWorkspacePayloadBuilder({
  collectRunsForUser: async () => [{ runId, workspaceId, status: "completed", createdAt: "2026-05-08T08:03:00.000Z" }],
  currentServerPlanSelection: () => null,
  defaultTaskTitle: (slug) => slug,
  ensureTaskSpace: async () => db.taskSpaces[0],
  fetchBillingSummary: async () => ({ source: "contract_snapshot_fixture", totals: { totalCost: 0 }, items: [] }),
  findTaskSpace: () => db.taskSpaces[0],
  formatDateTime: (value) => String(value || ""),
  isRunTerminal: () => true,
  latestActiveWorkspaceSession: () => null,
  listFilesRecursive: async () => [],
  listTaskSpacesForUser: () => db.taskSpaces,
  mkdir: async () => {},
  path,
  readPortalEvents: async () => [],
  sanitizeTaskTitle: (_slug, title) => title,
  stat: async () => ({ size: 0 }),
  workspaceStorageEntitlement: () => ({
    enabled: true,
    status: "active",
    storageSizeGb: 100,
    storageBackend: "cos_standard_workspace_quota",
    cosPrefix: "cos-prefix-proof-must-not-leak",
    message: "active",
  }),
});

const workspacePayload = await buildWorkspacePayload(db, user, workspaceId);
const fileSpace = workspacePayload.fileSpace;

assert(fileSpace, "workspace_payload_must_include_file_space");
assertExactKeys(fileSpace, fileSpaceAllowedKeys, "file_space");
assert.equal(fileSpace.capacityGb, 100, "file_space_capacity_gb_mismatch");
assert.equal(fileSpace.usedGb, 0.000003, "file_space_used_gb_mismatch");
assert.equal(fileSpace.retentionDays, 7, "file_space_retention_days_mismatch");
assert.equal(fileSpace.currentFolderRef, "root", "file_space_current_folder_ref_mismatch");
assert.equal(fileSpace.folders.length, 2, "file_space_folders_count_mismatch");
assert.equal(fileSpace.files.length, 2, "file_space_files_count_mismatch");
assert.deepEqual(fileSpace.selectedFileRefs, ["file-v22-input"], "file_space_selected_refs_mismatch");
assert.deepEqual(fileSpace.actions, {
  createFolder: true,
  renameFolder: true,
  deleteFileOrFolder: true,
  uploadToCurrentFolder: true,
  moveFileOrFolder: true,
  selectFiles: true,
  batchDownload: true,
  batchDelete: true,
  permanentDeleteRequiresConfirmation: true,
  clearFileSpaceRequiresConfirmation: true,
}, "file_space_actions_mismatch");
assert.deepEqual(fileSpace.deletePolicy, {
  ordinaryDeleteRequiresConfirmation: false,
  retentionDays: 7,
  permanentDeleteRequiresConfirmation: true,
  clearFileSpaceRequiresConfirmation: true,
}, "file_space_delete_policy_mismatch");

for (const folder of fileSpace.folders) {
  assertExactKeys(folder, folderAllowedKeys, `folder_${folder.folderRef}`);
}
for (const file of fileSpace.files) {
  assertExactKeys(file, fileAllowedKeys, `file_${file.fileRef}`);
}

const inputFile = fileSpace.files.find((item) => item.kind === "input");
const outputFile = fileSpace.files.find((item) => item.kind === "output");
assert.equal(inputFile.source, "upload", "input_file_source_mismatch");
assert.equal(inputFile.folderRef, "folder-project-a", "input_file_folder_ref_mismatch");
assert.equal(outputFile.source, "runtime_output", "output_file_source_mismatch");
assert.ok(outputFile.taskRef, "output_file_task_ref_required");
assert.notEqual(outputFile.taskRef, runId, "output_file_task_ref_must_not_expose_run_id");
assert.equal(outputFile.sessionId, sessionId, "output_file_session_link_mismatch");
assert.equal(outputFile.artifactRef, outputRef, "output_file_artifact_ref_mismatch");
assert.equal(outputFile.status, "retention_protected", "output_file_status_mismatch");
assert.equal(outputFile.deletedAt, "2026-05-08T09:00:00.000Z", "output_file_deleted_at_mismatch");
assert.equal(outputFile.retentionUntil, "2026-05-15T09:00:00.000Z", "output_file_retention_until_mismatch");
assertNoForbiddenLeak(fileSpace, "file_space_payload");
assertNoForbiddenLeak(workspacePayload, "workspace_payload");
assert.equal(JSON.stringify(workspacePayload).includes("tokenCount"), false, "workspace_payload_must_not_expose_token_count_on_file_space_page");
assert.equal(JSON.stringify(workspacePayload).includes("cos-prefix-proof-must-not-leak"), false, "workspace_payload_must_not_expose_storage_prefix_value");
assert.equal(JSON.stringify(workspacePayload).includes("cos_standard_workspace_quota"), false, "workspace_payload_must_not_expose_internal_storage_backend");
assert.equal(JSON.stringify(workspacePayload).includes("storageBackend"), false, "workspace_payload_must_not_expose_storage_backend_field");
assert.equal(JSON.stringify(workspacePayload).includes('"runId"'), false, "workspace_payload_must_not_expose_run_id_field");

const workspaceSurfaceSources = await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8");
const workspaceSurfaceSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
const workspaceTypesSource = await readFile("services/portal/frontend/src/api/portal/workspace.ts", "utf8");
const contractSource = await readFile("docs/contracts/v22-portal-files-billing-trace-boundary.md", "utf8");
const suiteSource = await readFile("tests/contract/contract-test-v22-mvp-contract-suite.mjs", "utf8");

assertUserCopy(workspaceSurfaceSources, "workspace_surface");
assert(workspaceSurfaceSources.includes("loadWorkspaceModel"), "workspace_page_must_use_zip_portal_adapter_loader");
assert(workspaceSurfaceSources.includes("TabsTrigger value=\"input\""), "workspace_page_must_render_input_file_tab");
assert(workspaceSurfaceSources.includes("TabsTrigger value=\"output\""), "workspace_page_must_render_output_file_tab");
assert(workspaceSurfaceSources.includes("model.fileSpaceUsed"), "workspace_page_must_render_file_space_usage");
assert(workspaceSurfaceSources.includes("file.taskName"), "workspace_page_must_render_output_task_linkage");
assert(workspaceSurfaceSources.includes("handleUploadClick"), "workspace_page_upload_button_must_bind_file_action");
assert(workspaceSurfaceSources.includes("handleDownloadFile"), "workspace_page_download_button_must_bind_file_action");
assert(workspaceSurfaceSources.includes('type="file"'), "workspace_page_upload_action_must_use_file_input");
assert(workspaceSurfaceSources.includes("FormData"), "workspace_page_upload_action_must_submit_multipart_form_data");
assert(workspaceSurfaceSources.includes("fetch(intent.url"), "workspace_page_upload_action_must_post_to_signed_upload_url");
assert.equal(workspaceSurfaceSources.includes("结果下载请在 OPL 工作台或任务详情中完成"), false, "workspace_page_must_not_keep_fake_download_disabled_copy");
assert.equal(workspaceSurfaceSources.includes("文件下载请在 OPL 工作台或任务详情中完成"), false, "workspace_page_must_not_keep_fake_file_download_disabled_copy");
assert(workspaceSurfaceSource.includes("workspace.fileSpace"), "workspace_adapter_must_read_file_space_payload");
assert(workspaceSurfaceSource.includes("fileSpacePercent"), "workspace_adapter_must_project_file_space_usage");
assert(workspaceSurfaceSource.includes("fetchWorkspaceStorage"), "workspace_adapter_must_read_workspace_storage_projection");
assert(workspaceSurfaceSource.includes("fetchStorageEntitlement"), "workspace_adapter_must_read_storage_entitlement_projection");
assert(workspaceSurfaceSource.includes("createWorkspaceFileUploadUrl"), "workspace_adapter_must_issue_upload_url");
assert(workspaceSurfaceSource.includes("createWorkspaceFileDownloadUrl"), "workspace_adapter_must_issue_download_url");
assert(workspaceTypesSource.includes("FileSpacePayload"), "workspace_types_must_define_file_space_payload");
assert(workspaceTypesSource.includes("selectedFileRefs"), "workspace_types_must_include_selected_file_refs");
const storageEntitlementType = interfaceBody(workspaceTypesSource, "StorageEntitlementPayload");
assert.equal(storageEntitlementType.includes("cosPrefix"), false, "workspace_storage_entitlement_type_must_not_expose_storage_prefix");
assert.equal(storageEntitlementType.includes("storageBackend"), false, "workspace_storage_entitlement_type_must_not_expose_storage_backend");
for (const forbidden of ["tenantId", "userId", "resourceBindingId", "billingAttributionId", "accountId", "storagePlanId", "serverPlanId"]) {
  assert.equal(storageEntitlementType.includes(forbidden), false, `workspace_storage_entitlement_type_must_not_expose_internal_field:${forbidden}`);
}
assert(contractSource.includes("文件空间属于 workspace，和运行环境生命周期分离"), "contract_must_define_file_space_lifecycle");
assert(contractSource.includes("本分支允许最小 Portal frontend 文件空间展示"), "contract_must_allow_minimal_frontend_file_space");
assert.equal(contractSource.includes("- 不改 frontend。"), false, "contract_must_not_keep_old_frontend_non_goal");
assert(isSmokeClassifiedIn("tests/regression/portal/regression-test-v22-portal-file-space-management.mjs"), "mvp_suite_must_include_file_space_management_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_file_space_management",
  covered: [
    "workspace_file_space_payload",
    "folder_and_file_field_allowlist",
    "input_output_runtime_trace_linkage",
    "delete_retention_policy",
    "frontend_user_language_controls",
    "secret_cloud_internal_storage_guard",
  ],
}, null, 2));
