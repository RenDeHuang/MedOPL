import { useRef, useState } from "react";
import { Badge, Button, Card, Input, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/core";
import {
  FolderOpen,
  Upload,
  FileText,
  Image,
  File,
  ArrowRight,
  Search,
  Download,
  MoreVertical,
  AlertCircle,
  HardDrive,
  Clock,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { buildWorkspaceViewState, useWorkspaceModel, type FileItem } from "../data/portalWorkspaceModel";
import { Link } from "react-router";

type PageState = "ready" | "empty-inputs" | "empty-outputs" | "file-space-unavailable" | "archived";

function getFileIcon(type: string) {
  if (type === "png" || type === "jpg") return <Image className="w-4 h-4 text-neutral-400" />;
  if (type === "pdf") return <FileText className="w-4 h-4 text-neutral-400" />;
  return <File className="w-4 h-4 text-neutral-400" />;
}

export function Workspace() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const query = useWorkspaceModel(refreshVersion);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取存储空间数据...</Card>
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-red-200 bg-red-50 p-6 text-sm text-red-700">{query.error}</Card>
      </div>
    );
  }

  const model = query.data;
  const pageState = model.pageState as PageState;
  const viewState = buildWorkspaceViewState({
    inputFiles: model.inputFiles,
    outputFiles: model.outputFiles,
    searchQuery,
  });

  const openTransfer = (url: string) => {
    window.location.assign(url);
  };

  function handleUploadClick() {
    setActionMessage("");
    uploadFileInputRef.current?.click();
  }

  async function handleUploadFileSelected(file: globalThis.File | null) {
    if (!file) return;
    setActionMessage("");
    setPendingAction("upload");
    try {
      const intent = await model.createUploadIntent(file.name);
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch(intent.url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("workspace_upload_failed");
      setActionMessage(`${file.name} 已上传，存储空间数据正在刷新。`);
      setRefreshVersion((version) => version + 1);
    } catch {
      setActionMessage(model.fileSpaceActionMessage || "上传通道暂不可用，请确认存储空间和计算资源状态。");
    } finally {
      setPendingAction(null);
      if (uploadFileInputRef.current) uploadFileInputRef.current.value = "";
    }
  }

  async function handleDownloadFile(file: FileItem) {
    setActionMessage("");
    setPendingAction(file.id);
    try {
      const intent = await model.createDownloadIntent(file);
      setActionMessage(`${intent.fileName} 下载链接有效至 ${intent.expiresAt}`);
      openTransfer(intent.url);
    } catch {
      setActionMessage(file.downloadUnavailableReason || "下载通道暂不可用，请稍后重试。");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDownloadAllResults() {
    if (viewState.downloadableOutputFiles.length === 0) {
      setActionMessage(model.fileSpaceActionMessage || "当前没有可下载的结果文件。");
      return;
    }
    setActionMessage("");
    setPendingAction("download-all");
    try {
      for (const file of viewState.downloadableOutputFiles) {
        const intent = await model.createDownloadIntent(file);
        const anchor = document.createElement("a");
        anchor.href = intent.url;
        anchor.download = intent.fileName;
        anchor.rel = "noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setActionMessage(`已创建 ${viewState.downloadableOutputFiles.length} 个结果文件下载通道。`);
    } catch {
      setActionMessage("部分结果文件下载通道暂不可用，请稍后重试。");
    } finally {
      setPendingAction(null);
    }
  }

  function renderOplEntryButton({ variant, className, showArrow = false }: { variant?: "outline"; className?: string; showArrow?: boolean } = {}) {
    return (
      <Button asChild variant={variant} className={className} title={model.runStartMessage || "进入 OPL"}>
        <Link to="/opl-launch">
          进入 OPL
          {showArrow && <ArrowRight className="w-4 h-4" />}
        </Link>
      </Button>
    );
  }

  // Empty Inputs State
  if (pageState === "empty-inputs") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <input
          ref={uploadFileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => handleUploadFileSelected(event.target.files?.[0] || null)}
        />
        {/* Header */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">存储空间</h1>
              <p className="text-neutral-600 text-sm">
                当前存储空间可用，可以查看输入文件、输出文件和保留期
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={handleUploadClick}
                disabled={!model.uploadEnabled || pendingAction === "upload"}
                title={model.fileSpaceActionMessage || "创建文件上传通道"}
              >
                <Upload className="w-4 h-4 mr-2" />
                上传文件
              </Button>
              {renderOplEntryButton({ className: "gap-2", showArrow: true })}
            </div>
          </div>
        </div>
        {actionMessage && (
          <Card className="border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-700">{actionMessage}</Card>
        )}

        {/* Workspace Info */}
        <Card className="border border-neutral-200 mb-6">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-neutral-600" />
                <h2 className="font-semibold text-neutral-900">当前存储空间</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                可用
              </Badge>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-neutral-600 mb-1">绑定 OPL workspace</div>
                <div className="font-semibold text-neutral-900">{model.workspaceTitle}</div>
                <div className="text-xs text-neutral-500 mt-1">创建于 {model.createdAt}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">存储空间</div>
                <div className="font-semibold text-neutral-900">{model.fileSpaceUsed} / {model.fileSpaceTotal}</div>
                <div className="text-xs text-neutral-500 mt-1">剩余 {model.fileSpaceAvailable}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">绑定状态</div>
                <div className="font-semibold text-neutral-900">{model.status}</div>
                <div className="text-xs text-neutral-500 mt-1">存储空间可读写</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">最近回流</div>
                <div className="font-semibold text-neutral-900">{model.latestBackflow}</div>
                <div className="text-xs text-neutral-500 mt-1">输出结果已同步</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂无输入文件</h3>
          <p className="text-sm text-neutral-600 mb-6 max-w-md text-center">
            上传输入文件后，可以在 OPL 中使用这些文件进行分析和处理
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleUploadClick}
              disabled={!model.uploadEnabled || pendingAction === "upload"}
              title={model.fileSpaceActionMessage || "创建文件上传通道"}
            >
              <Upload className="w-4 h-4 mr-2" />
              上传文件
            </Button>
            {renderOplEntryButton({ variant: "outline" })}
          </div>
        </div>
      </div>
    );
  }

  // Empty Outputs State
  if (pageState === "empty-outputs") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">存储空间</h1>
              <p className="text-neutral-600 text-sm">
                当前存储空间可用，可以查看输出文件资源清单或进入 OPL
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/billing">查看费用与用量</Link>
              </Button>
              {renderOplEntryButton({ className: "gap-2", showArrow: true })}
            </div>
          </div>
        </div>
        {actionMessage && (
          <Card className="border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-700">{actionMessage}</Card>
        )}

        {/* Workspace Info */}
        <Card className="border border-neutral-200 mb-6">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-neutral-600" />
                <h2 className="font-semibold text-neutral-900">当前存储空间</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                可用
              </Badge>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-neutral-600 mb-1">绑定 OPL workspace</div>
                <div className="font-semibold text-neutral-900">{model.workspaceTitle}</div>
                <div className="text-xs text-neutral-500 mt-1">创建于 {model.createdAt}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">存储空间</div>
                <div className="font-semibold text-neutral-900">{model.fileSpaceUsed} / {model.fileSpaceTotal}</div>
                <div className="text-xs text-neutral-500 mt-1">剩余 {model.fileSpaceAvailable}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">绑定状态</div>
                <div className="font-semibold text-neutral-900">{model.status}</div>
                <div className="text-xs text-neutral-500 mt-1">存储空间可读写</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">输入文件</div>
                <div className="font-semibold text-neutral-900">{model.inputsCount} 个文件</div>
                <div className="text-xs text-neutral-500 mt-1">占用 {model.fileSpaceUsed}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂无输出文件</h3>
          <p className="text-sm text-neutral-600 mb-6 max-w-md text-center">
            在 OPL 中完成任务后，输出文件会回流到存储空间清单
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link to="/billing">查看费用与用量</Link>
            </Button>
            {renderOplEntryButton()}
          </div>
        </div>
      </div>
    );
  }

  // File Space Unavailable State
  if (pageState === "file-space-unavailable") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">存储空间</h1>
              <p className="text-neutral-600 text-sm">
                存储空间当前不可用，需要先开通存储空间
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/resources">前往计算资源</Link>
            </Button>
          </div>
        </div>

        <Card className="border border-amber-200 bg-amber-50">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">存储空间未开通</h3>
                <p className="text-sm text-amber-800 mb-4">
                  当前存储空间未开通或不可写。前往计算资源页确认资源状态，或到套餐与购买页开通存储空间。
                </p>
                <Button asChild>
                  <Link to="/packages">前往套餐与购买</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Ready State
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <input
        ref={uploadFileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => handleUploadFileSelected(event.target.files?.[0] || null)}
      />
      {/* Header - Workspace Summary */}
      <div className="mb-8 pb-8 border-b border-neutral-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-3">存储空间</h1>
            <p className="text-neutral-600 text-sm">
              查看存储容量、已用空间、输入文件、输出文件和保留期
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleDownloadAllResults}
              disabled={!viewState.hasDownloadableOutputFiles || pendingAction === "download-all"}
              title={model.fileSpaceActionMessage || "创建全部结果下载通道"}
            >
              <Download className="w-4 h-4 mr-2" />
              下载全部结果
            </Button>
            {renderOplEntryButton({ className: "gap-2", showArrow: true })}
          </div>
        </div>
      </div>
      {actionMessage && (
        <Card className="border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-700">{actionMessage}</Card>
      )}

      {/* Workspace Info Card */}
      <Card className="border border-neutral-200 mb-6">
        <div className="p-5 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">当前存储空间</h2>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              可用
            </Badge>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-neutral-600 mb-1">绑定 OPL workspace</div>
              <div className="font-semibold text-neutral-900">{model.workspaceTitle}</div>
              <div className="text-xs text-neutral-500 mt-1">创建于 {model.createdAt}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 mb-1">存储空间</div>
              <div className="font-semibold text-neutral-900">{model.fileSpaceUsed} / {model.fileSpaceTotal}</div>
              <Progress value={model.fileSpacePercent} className="h-1.5 mt-2" />
              <div className="text-xs text-neutral-500 mt-1">{model.fileSpaceRetentionLabel}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 mb-1">绑定状态</div>
              <div className="font-semibold text-neutral-900">{model.status}</div>
              <div className="text-xs text-neutral-500 mt-1">存储空间可读写</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 mb-1">最近回流</div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-neutral-900">{model.latestBackflow}</span>
              </div>
              <div className="text-xs text-neutral-500 mt-1">输出结果已同步</div>
            </div>
          </div>
        </div>
      </Card>

      {/* File Tabs - Main Section */}
      <Card className="border border-neutral-200 mb-6">
        <Tabs defaultValue="input" className="w-full">
          <div className="border-b border-neutral-200">
            <div className="p-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-neutral-100">
                  <TabsTrigger value="input">输入文件</TabsTrigger>
                  <TabsTrigger value="output">输出文件</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <Input
                      placeholder="搜索文件..."
                      className="pl-9 w-64 h-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleUploadClick}
                    disabled={!model.uploadEnabled || pendingAction === "upload"}
                    title={model.fileSpaceActionMessage || "创建文件上传通道"}
                  >
                    <Upload className="w-4 h-4" />
                    上传文件
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!model.fileSpaceBulkDeleteEnabled}
                    title={model.fileSpaceBulkDeleteEnabled ? "删除后进入存储空间保护期" : model.fileSpaceSelectionLabel}
                  >
                    批量删除
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <TabsContent value="input" className="m-0">
            <div className="p-5">
              <div className="text-sm text-neutral-600 mb-4">
                共 {model.inputFiles.length} 个文件，占用 {model.fileSpaceUsed} · {model.fileSpaceSelectionLabel}
              </div>
              <div className="space-y-2">
                {viewState.filteredInputFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-3 flex-1">
                      {getFileIcon(file.type)}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-neutral-900 text-sm">
                          {file.name}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {file.size} · 上传于 {file.updated}
                        </div>
                        {file.isRetentionProtected && (
                          <div className="truncate text-xs text-amber-700">
                            {file.retentionStatusLabel} · {file.retentionUntilLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {file.selected ? "已选择" : file.type.toUpperCase()}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadFile(file)}
                        disabled={!file.canDownload || pendingAction === file.id}
                        title={file.downloadUnavailableReason || "创建文件下载通道"}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled
                        title="更多文件操作请在 OPL 内完成"
                        aria-label="更多文件操作暂未接入"
                      >
                        <MoreVertical className="w-4 h-4 text-neutral-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="output" className="m-0">
            <div className="p-5">
              <div className="text-sm text-neutral-600 mb-4">
                共 {model.outputFiles.length} 个结果文件 · {model.fileSpaceRetentionLabel}
              </div>
              <div className="space-y-2">
                {viewState.filteredOutputFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-3 flex-1">
                      {getFileIcon(file.type)}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-neutral-900 text-sm">
                          {file.name}
                        </div>
                        <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-500">
                          <span className="truncate">{file.size} · 生成于 {file.updated}</span>
                          {file.taskName && (
                            <>
                              <span>·</span>
                              <span className="truncate text-blue-600">来自 {file.taskName}</span>
                            </>
                          )}
                        </div>
                        {file.isRetentionProtected && (
                          <div className="truncate text-xs text-amber-700">
                            {file.retentionStatusLabel} · {file.retentionUntilLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {file.isRetentionProtected ? "保护期" : file.type.toUpperCase()}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadFile(file)}
                        disabled={!file.canDownload || pendingAction === file.id}
                        title={file.downloadUnavailableReason || "创建结果下载通道"}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                      {file.taskId && (
                        <Button asChild size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Link to="/billing" aria-label={`查看 ${file.taskName || file.name} 的用量明细`}>
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* File Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">输入文件</span>
            <Upload className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.inputFiles.length}</div>
          <div className="text-xs text-neutral-500 mt-1">占用 {model.fileSpaceUsed}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">输出文件</span>
            <FileText className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.outputFiles.length}</div>
          <div className="text-xs text-neutral-500 mt-1">结果文件</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">存储空间</span>
            <HardDrive className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.fileSpacePercent}%</div>
          <div className="text-xs text-neutral-500 mt-1">{model.fileSpaceUsed} / {model.fileSpaceTotal}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">最近回流</span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.latestBackflow}</div>
          <div className="text-xs text-neutral-500 mt-1">自动同步中</div>
        </Card>
      </div>
    </div>
  );
}
