function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateText(value: unknown) {
  return typeof value === "string" && value ? value.replace("T", " ").slice(0, 16) : "未返回";
}

function arrayValue<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

export interface FileItem {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  type: string;
  contentType: string;
  updated: string;
  kind: "inputs" | "outputs";
  relativePath: string;
  canDownload: boolean;
  downloadUnavailableReason?: string;
  taskId?: string;
  taskName?: string;
  fileRef?: string;
  artifactRef?: string;
  sessionId?: string;
  folderRef?: string;
  selected?: boolean;
  isRetentionProtected?: boolean;
  retentionUntilLabel?: string;
  retentionStatusLabel?: string;
}

export function retentionProtected(status: unknown) {
  return String(status || "").toLowerCase() === "retention_protected";
}

export function fileRetentionUntilLabel(file: { status?: string; retentionUntil?: string } | undefined) {
  if (!file || !retentionProtected(file.status)) return "";
  return file.retentionUntil ? `保护至 ${dateText(file.retentionUntil)}` : "处于 7 天保护期";
}

export function fileRetentionStatusLabel(file: { status?: string; retentionUntil?: string } | undefined) {
  if (!file) return "";
  return retentionProtected(file.status) ? "7 天保护期" : "可用";
}

export function fileSpaceViewState(fileSpace: any) {
  const fileSpaceFiles = arrayValue<any>(fileSpace?.files);
  const fileSpaceFolders = arrayValue(fileSpace?.folders);
  const selectedFileRefs = arrayValue<string>(fileSpace?.selectedFileRefs);
  const fileSpaceActions = objectValue(fileSpace?.actions);
  const fileSpaceDeletePolicy = objectValue(fileSpace?.deletePolicy);
  return {
    fileSpaceFiles,
    fileSpaceFolders,
    selectedFileRefs,
    selectedFileRefSet: new Set(selectedFileRefs),
    fileSpaceActions,
    fileSpaceDeletePolicy,
    fileSpaceRetentionLabel: `${numberValue(fileSpace?.retentionDays, numberValue(fileSpaceDeletePolicy.retentionDays, 7))} 天保护期`,
    fileSpaceSelectionLabel: selectedFileRefs.length > 0 ? `已选择 ${selectedFileRefs.length} 个文件` : "未选择文件",
    fileSpaceBulkDeleteEnabled: Boolean(fileSpaceActions.batchDelete && selectedFileRefs.length > 0),
  };
}

export function fileSpaceFileState(file: any, selectedFileRefSet: Set<string>) {
  const fileRef = stringValue(file?.fileRef, "");
  return {
    folderRef: file?.folderRef,
    selected: selectedFileRefSet.has(fileRef),
    isRetentionProtected: retentionProtected(file?.status),
    retentionUntilLabel: fileRetentionUntilLabel(file),
    retentionStatusLabel: fileRetentionStatusLabel(file),
  };
}
