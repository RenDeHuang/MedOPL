const RETENTION_DAYS = 7;
const ROOT_FOLDER_REF = "root";

function text(value = "") {
  return String(value ?? "").trim();
}

function numberValue(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function userTenantId(user = {}) {
  return text(user.tenantId || user.tenant_id || user.id);
}

function workspaceFileKind(value = "") {
  const normalized = text(value).toLowerCase();
  if (normalized === "outputs" || normalized === "output") return "output";
  return "input";
}

function workspaceFileSource(value = "") {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("runtime") || normalized.includes("artifact")) return "runtime_output";
  return "upload";
}

function fileRefFor(file = {}) {
  return text(file.fileRef || file.file_ref || file.id || file.artifactRef || file.artifact_ref);
}

function artifactRefFor(file = {}) {
  if (workspaceFileKind(file.kind) !== "output") return "";
  return text(file.artifactRef || file.artifact_ref || file.id || file.fileRef || file.file_ref);
}

function fileRetentionUntil(file = {}) {
  return text(file.retentionUntil || file.retention_until || file.retentionCleanupAfterAt || file.retention_cleanup_after_at);
}

function fileDeletedAt(file = {}) {
  return text(file.deletedAt || file.deleted_at);
}

function fileStatus(file = {}) {
  return text(file.status || (fileDeletedAt(file) ? "retention_protected" : "active"));
}

function folderPathFor(file = {}) {
  const relativePath = text(file.relativePath || file.relative_path);
  if (!relativePath.includes("/")) return "/";
  return `/${relativePath.split("/").slice(0, -1).join("/")}`;
}

function defaultFolderForFile(file = {}) {
  const folderRef = text(file.folderRef || file.folder_ref || file.folderId || file.folder_id);
  return folderRef || ROOT_FOLDER_REF;
}

function fileView(file = {}) {
  return {
    fileRef: fileRefFor(file),
    name: text(file.name || file.fileName || file.file_name),
    folderRef: defaultFolderForFile(file),
    kind: workspaceFileKind(file.kind),
    source: workspaceFileSource(file.source),
    runId: text(file.runId || file.run_id),
    sessionId: text(file.sessionId || file.session_id || file.oplSessionId || file.opl_session_id),
    artifactRef: artifactRefFor(file),
    sizeBytes: numberValue(file.sizeBytes || file.size_bytes),
    status: fileStatus(file),
    deletedAt: fileDeletedAt(file),
    retentionUntil: fileRetentionUntil(file),
  };
}

function rootFolderView() {
  return {
    folderRef: ROOT_FOLDER_REF,
    name: "全部文件",
    parentFolderRef: "",
    path: "/",
    status: "active",
  };
}

function folderRefFor(folder = {}) {
  return text(folder.folderRef || folder.folder_ref || folder.id);
}

function folderView(folder = {}) {
  return {
    folderRef: folderRefFor(folder),
    name: text(folder.name || folder.title || folderRefFor(folder)),
    parentFolderRef: text(folder.parentFolderRef || folder.parent_folder_ref || ROOT_FOLDER_REF),
    path: text(folder.path || "/"),
    status: text(folder.status || "active"),
  };
}

function folderFromFile(file = {}) {
  const folderRef = defaultFolderForFile(file);
  if (folderRef === ROOT_FOLDER_REF) return null;
  return {
    folderRef,
    name: text(folderRef.replace(/^folder-/, "")) || folderRef,
    parentFolderRef: ROOT_FOLDER_REF,
    path: folderPathFor(file),
    status: "active",
  };
}

function ownerMatches(row = {}, user = {}, workspaceId = "") {
  const targetWorkspaceId = text(workspaceId);
  const tenantId = userTenantId(user);
  if (text(row.userId || row.user_id) !== text(user.id)) return false;
  if (tenantId && text(row.tenantId || row.tenant_id) !== tenantId) return false;
  return text(row.workspaceId || row.workspace_id) === targetWorkspaceId;
}

function folderOwnerMatches(row = {}, user = {}, workspaceId = "") {
  const targetWorkspaceId = text(workspaceId);
  const rowUserId = text(row.userId || row.user_id);
  const rowTenantId = text(row.tenantId || row.tenant_id);
  if (rowUserId && rowUserId !== text(user.id)) return false;
  if (rowTenantId && rowTenantId !== userTenantId(user)) return false;
  return text(row.workspaceId || row.workspace_id) === targetWorkspaceId;
}

function activeOrProtected(row = {}) {
  const status = text(row.status || "active").toLowerCase();
  return status !== "deleted" && status !== "cleanup_ready";
}

function storageCapacityGb(storageEntitlement = {}) {
  return numberValue(storageEntitlement.storageSizeGb || storageEntitlement.capacityGb || storageEntitlement.fileSpaceGb);
}

function usedGbFor(files = []) {
  const bytes = files.reduce((sum, file) => sum + numberValue(file.sizeBytes || file.size_bytes), 0);
  return Number((bytes / 1024 ** 3).toFixed(6));
}

function fileSortKey(file = {}) {
  return `${defaultFolderForFile(file)}:${text(file.name || file.fileName || file.file_name)}:${fileRefFor(file)}`;
}

export function buildPortalFileSpacePayload({ db = {}, user = {}, workspaceId = "", storageEntitlement = {} } = {}) {
  const workspaceFiles = (Array.isArray(db.workspaceFiles) ? db.workspaceFiles : [])
    .filter((file) => ownerMatches(file, user, workspaceId))
    .filter(activeOrProtected)
    .sort((left, right) => fileSortKey(left).localeCompare(fileSortKey(right)));

  const folderByRef = new Map([[ROOT_FOLDER_REF, rootFolderView()]]);
  for (const folder of Array.isArray(db.workspaceFolders) ? db.workspaceFolders : []) {
    if (!folderOwnerMatches(folder, user, workspaceId)) continue;
    if (!activeOrProtected(folder)) continue;
    const view = folderView(folder);
    if (view.folderRef) folderByRef.set(view.folderRef, view);
  }
  for (const file of workspaceFiles) {
    const inferred = folderFromFile(file);
    if (inferred && !folderByRef.has(inferred.folderRef)) folderByRef.set(inferred.folderRef, inferred);
  }

  const folders = Array.from(folderByRef.values())
    .sort((left, right) => {
      if (left.folderRef === ROOT_FOLDER_REF) return -1;
      if (right.folderRef === ROOT_FOLDER_REF) return 1;
      return left.path.localeCompare(right.path) || left.folderRef.localeCompare(right.folderRef);
    });
  const files = workspaceFiles.map(fileView);

  return {
    capacityGb: storageCapacityGb(storageEntitlement),
    usedGb: usedGbFor(workspaceFiles),
    retentionDays: RETENTION_DAYS,
    currentFolderRef: ROOT_FOLDER_REF,
    folders,
    files,
    selectedFileRefs: files
      .filter((file) => workspaceFiles.find((row) => fileRefFor(row) === file.fileRef)?.selected === true)
      .map((file) => file.fileRef),
    actions: {
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
    },
    deletePolicy: {
      ordinaryDeleteRequiresConfirmation: false,
      retentionDays: RETENTION_DAYS,
      permanentDeleteRequiresConfirmation: true,
      clearFileSpaceRequiresConfirmation: true,
    },
  };
}
