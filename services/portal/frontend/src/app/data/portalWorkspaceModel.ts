import {
  createOplFileRef,
  startOplRun,
} from "../../api/portal/opl";
import {
  createWorkspaceFileDownloadUrl,
  createWorkspaceFileUploadUrl,
  fetchStorageEntitlement,
  fetchWorkspace,
  fetchWorkspaceStorage,
} from "../../api/portal/workspace";
import {
  type FileItem,
  fileRetentionStatusLabel,
  fileRetentionUntilLabel,
  fileSpaceFileState,
  fileSpaceViewState,
  retentionProtected,
} from "./portalWorkspaceFileSpace";
import {
  bytesToSize,
  contentTypeFromName,
  dateText,
  downloadTargetUrl,
  fileType,
  gb,
  latestEventText,
  numberValue,
  stringValue,
  arrayValue,
} from "./portalFormatters";
import { currentLaunchId } from "./portalLaunchContext";
import { PortalDisplayError } from "./portalDisplayErrors";
import { usePortalQuery } from "./portalQuery";

export type { FileItem };

function relativePathFromFile(value: { name?: string; fullPath?: string; relativePath?: string }) {
  return stringValue(value.relativePath || value.fullPath || value.name, "");
}

export type WorkspaceViewState = {
  filteredInputFiles: FileItem[];
  filteredOutputFiles: FileItem[];
  downloadableOutputFiles: FileItem[];
  hasDownloadableOutputFiles: boolean;
};

export function filterWorkspaceFiles(files: readonly FileItem[], searchQuery = "") {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return [...files];
  return files.filter((file) => file.name.toLowerCase().includes(query));
}

export function buildWorkspaceViewState(input: {
  inputFiles: readonly FileItem[];
  outputFiles: readonly FileItem[];
  searchQuery?: string;
}): WorkspaceViewState {
  const filteredInputFiles = filterWorkspaceFiles(input.inputFiles, input.searchQuery);
  const filteredOutputFiles = filterWorkspaceFiles(input.outputFiles, input.searchQuery);
  const downloadableOutputFiles = input.outputFiles.filter((file) => file.canDownload);
  return {
    filteredInputFiles,
    filteredOutputFiles,
    downloadableOutputFiles,
    hasDownloadableOutputFiles: downloadableOutputFiles.length > 0,
  };
}

export async function loadWorkspaceModel() {
  const workspace = await fetchWorkspace();
  const launchId = currentLaunchId();
  const workspaceId = workspace.workspace.slug;
  const sessionId = workspace.activeSession?.id || workspace.outputs.find((file) => file.sessionId)?.sessionId || "";
  const storageParams = {
    workspaceId,
    ...(sessionId ? { oplSessionId: sessionId } : {}),
  };
  const [storageProjection, entitlementProjection] = await Promise.all([
    fetchWorkspaceStorage(storageParams),
    fetchStorageEntitlement({ workspaceId }),
  ]);
  const entitlement = entitlementProjection.entitlement || storageProjection.entitlement || workspace.storageEntitlement;
  const metadataByRelativePath = new Map(
    arrayValue<NonNullable<typeof storageProjection.metadata>[number]>(storageProjection.metadata)
      .map((item) => [item.relativePath, item] as const),
  );
  const {
    fileSpaceFiles,
    fileSpaceFolders,
    selectedFileRefs,
    selectedFileRefSet,
    fileSpaceActions,
    fileSpaceDeletePolicy,
    fileSpaceRetentionLabel,
    fileSpaceSelectionLabel,
    fileSpaceBulkDeleteEnabled,
  } = fileSpaceViewState(workspace.fileSpace);
  const fileSpaceByRef = new Map(fileSpaceFiles.map((file) => [file.fileRef, file] as const));
  const canUseTransferActions = Boolean(entitlement?.enabled && sessionId);
  const downloadUnavailableReason = canUseTransferActions
    ? ""
    : !entitlement?.enabled
      ? "存储空间未开通"
      : !sessionId
        ? "当前没有可用 OPL 会话"
        : "计算资源未绑定";
  const files = workspace.files.map<FileItem>((file) => {
    const relativePath = relativePathFromFile(file);
    const metadata = metadataByRelativePath.get(relativePath);
    const fileSpaceFile = metadata?.fileRef ? fileSpaceByRef.get(metadata.fileRef) : undefined;
    return {
      id: metadata?.fileRef || relativePath || file.name,
      name: file.name,
      size: metadata ? bytesToSize(metadata.sizeBytes) : "Portal 文件",
      sizeBytes: numberValue(metadata?.sizeBytes),
      type: fileType(file.name),
      contentType: stringValue(metadata?.contentType, contentTypeFromName(file.name)),
      updated: dateText(metadata?.updatedAt || metadata?.createdAt || workspace.workspace.createdAt),
      kind: "inputs",
      relativePath,
      canDownload: Boolean(canUseTransferActions && relativePath),
      downloadUnavailableReason,
      fileRef: metadata?.fileRef || fileSpaceFile?.fileRef,
      sessionId,
      ...fileSpaceFileState(fileSpaceFile, selectedFileRefSet),
    };
  });
  const outputs = workspace.outputs.map<FileItem>((file) => {
    const relativePath = relativePathFromFile(file);
    const metadata = metadataByRelativePath.get(relativePath);
    const fileSpaceFile = file.fileRef ? fileSpaceByRef.get(file.fileRef) : undefined;
    const outputSessionId = file.sessionId || fileSpaceFile?.sessionId || sessionId;
    return {
      id: file.fileRef || metadata?.fileRef || file.artifactRef || relativePath || file.name,
      name: file.name,
      size: bytesToSize(file.sizeBytes ?? metadata?.sizeBytes ?? fileSpaceFile?.sizeBytes),
      sizeBytes: numberValue(file.sizeBytes ?? metadata?.sizeBytes ?? fileSpaceFile?.sizeBytes),
      type: fileType(file.name),
      contentType: stringValue(file.contentType || metadata?.contentType, contentTypeFromName(file.name)),
      updated: dateText(file.updatedAt || file.createdAt || metadata?.updatedAt || fileSpaceFile?.retentionUntil),
      kind: "outputs",
      relativePath,
      canDownload: Boolean(entitlement?.enabled && outputSessionId && relativePath),
      downloadUnavailableReason: entitlement?.enabled
        ? outputSessionId ? "" : "当前结果缺少 OPL 会话"
        : "存储空间未开通",
      taskId: file.taskRef,
      taskName: file.sessionId || "会话输出",
      fileRef: file.fileRef || metadata?.fileRef || fileSpaceFile?.fileRef,
      artifactRef: file.artifactRef,
      sessionId: outputSessionId,
      folderRef: fileSpaceFile?.folderRef,
      selected: selectedFileRefSet.has(file.fileRef || metadata?.fileRef || fileSpaceFile?.fileRef || ""),
      isRetentionProtected: retentionProtected(fileSpaceFile?.status || file.status),
      retentionUntilLabel: fileRetentionUntilLabel(fileSpaceFile || { status: file.status, retentionUntil: "" }),
      retentionStatusLabel: fileRetentionStatusLabel(fileSpaceFile || { status: file.status, retentionUntil: "" }),
    };
  });
  const storageBytes = numberValue(storageProjection.storage.inputBytes) + numberValue(storageProjection.storage.outputBytes);
  const usedGb = Math.max(numberValue(workspace.fileSpace?.usedGb), storageBytes / 1024 ** 3);
  const capacityGb = numberValue(entitlement?.storageSizeGb, numberValue(workspace.fileSpace?.capacityGb));
  const pageState = workspace.workspace.archivedAt
    ? "archived"
    : !workspace.fileSpace || !entitlement?.enabled
      ? "file-space-unavailable"
      : files.length === 0
        ? "empty-inputs"
        : outputs.length === 0
          ? "empty-outputs"
          : "ready";

  async function createUploadIntent(fileName: string) {
    const cleanName = stringValue(fileName, "portal-upload-placeholder.txt");
    const transfer = await createWorkspaceFileUploadUrl({
      workspaceId,
      fileName: cleanName,
      relativePath: cleanName,
      kind: "inputs",
      ...(sessionId ? { oplSessionId: sessionId } : {}),
    });
    return {
      url: downloadTargetUrl(transfer.url),
      method: transfer.method,
      expiresAt: transfer.expiresAt,
      fileName: transfer.file.name,
    };
  }

  async function createDownloadIntent(file: FileItem) {
    const transfer = await createWorkspaceFileDownloadUrl({
      workspaceId,
      kind: file.kind,
      file: file.relativePath || file.name,
      relativePath: file.relativePath || file.name,
      ...(file.sessionId ? { oplSessionId: file.sessionId } : sessionId ? { oplSessionId: sessionId } : {}),
    });
    return {
      url: downloadTargetUrl(transfer.url),
      method: transfer.method,
      expiresAt: transfer.expiresAt,
      fileName: transfer.file.name,
    };
  }

  const runStartMessage = !launchId
    ? "当前页面没有 launchId，不能直接向 OPL 发起运行。请从“进入 OPL”流程进入后再执行。"
    : files.length === 0
      ? "当前没有可用于发起运行的输入文件。"
      : "";

  async function createRunFromWorkspaceFiles() {
    if (!launchId) {
      throw new PortalDisplayError("当前页面没有 launchId，无法向 OPL 发起运行。请先从 Portal 进入 OPL。");
    }
    if (files.length === 0) {
      throw new PortalDisplayError("当前没有可用于发起运行的输入文件。");
    }
    const fileRefs: string[] = [];
    for (const file of files) {
      if (file.fileRef) {
        fileRefs.push(file.fileRef);
        continue;
      }
      const projection = await createOplFileRef({
        launchId,
        fileName: file.name,
        relativePath: file.relativePath || file.name,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      });
      const createdFileRef = stringValue(projection.fileRef || projection.file?.fileRef, "");
      if (!createdFileRef) {
        throw new PortalDisplayError(
          projection.error === "file_upload_capability_not_supported"
            ? "当前 OPL 映射尚未观测到可复用的文件引用能力。"
            : "OPL 文件引用创建失败，当前不能直接发起运行。",
        );
      }
      fileRefs.push(createdFileRef);
    }
    const run = await startOplRun({
      launchId,
      message: `使用存储空间输入文件发起运行：${files.map((file) => file.name).join(", ")}`,
      fileRefs,
      toolName: "workspace-files",
      mode: "full_runtime",
    });
    const runProjection = run.run as { runId?: string } | undefined;
    return {
      ok: Boolean(run.ok),
      error: stringValue(run.error, ""),
      gate: stringValue(run.gate, ""),
      status: stringValue(run.status || run.run?.status, run.ok ? "submitted" : "gated"),
      runId: stringValue(runProjection?.runId, ""),
    };
  }

  return {
    launchId,
    pageState,
    workspaceTitle: workspace.workspace.title,
    createdAt: dateText(workspace.workspace.createdAt),
    status: workspace.workspace.status,
    latestBackflow: latestEventText(workspace.eventTimeline),
    fileSpaceUsed: gb(usedGb),
    fileSpaceTotal: gb(capacityGb),
    fileSpaceAvailable: gb(Math.max(0, capacityGb - usedGb)),
    fileSpacePercent: capacityGb > 0 ? Math.min(100, Math.round((usedGb / capacityGb) * 100)) : 0,
    fileSpaceRetentionLabel,
    fileSpaceSelectionLabel,
    fileSpaceFolders,
    selectedFileRefs,
    fileSpaceActions,
    fileSpaceDeletePolicy,
    fileSpaceBulkDeleteEnabled,
    fileSpaceActionMessage: downloadUnavailableReason,
    uploadEnabled: Boolean(canUseTransferActions),
    inputFiles: files,
    outputFiles: outputs,
    inputsCount: storageProjection.storage.inputsCount || workspace.counts.inputs,
    outputsCount: storageProjection.storage.outputsCount || workspace.counts.outputs,
    runStartEnabled: Boolean(launchId && files.length > 0),
    runStartMessage,
    createUploadIntent,
    createDownloadIntent,
    createRunFromWorkspaceFiles,
  } as const;
}

export function useWorkspaceModel(refreshVersion: number) {
  return usePortalQuery(loadWorkspaceModel, [refreshVersion]);
}
