import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
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
import { Input } from "../components/ui/input";
import { loadWorkspaceModel, usePortalQuery } from "../data/portalAdapters";
import { Link } from "react-router";

type PageState = "ready" | "empty-inputs" | "empty-outputs" | "file-space-unavailable" | "archived";

interface FileItem {
  name: string;
  size: string;
  type: string;
  updated: string;
  taskId?: string;
  taskName?: string;
}

const mockInputFiles: FileItem[] = [
  { name: "protein_sequence.fasta", size: "2.4 MB", type: "fasta", updated: "2 小时前" },
  { name: "gene_data.csv", size: "8.1 MB", type: "csv", updated: "2 小时前" },
  { name: "literature_refs.pdf", size: "5.2 MB", type: "pdf", updated: "3 天前" },
  { name: "sample_images.zip", size: "142 MB", type: "zip", updated: "3 天前" },
  { name: "metadata.json", size: "124 KB", type: "json", updated: "1 周前" },
];

const mockOutputFiles: FileItem[] = [
  {
    name: "analysis_result_20240517.json",
    size: "3.2 MB",
    type: "json",
    updated: "2 小时前",
    taskId: "session-20240517-001",
    taskName: "蛋白质结构分析",
  },
  {
    name: "protein_structure.pdb",
    size: "1.8 MB",
    type: "pdb",
    updated: "2 小时前",
    taskId: "session-20240517-001",
    taskName: "蛋白质结构分析",
  },
  {
    name: "alignment_output.txt",
    size: "856 KB",
    type: "txt",
    updated: "5 小时前",
    taskId: "session-20240517-002",
    taskName: "基因序列比对",
  },
  {
    name: "visualization.png",
    size: "2.1 MB",
    type: "png",
    updated: "5 小时前",
    taskId: "session-20240517-003",
    taskName: "文献数据提取",
  },
];

function getFileIcon(type: string) {
  if (type === "png" || type === "jpg") return <Image className="w-4 h-4 text-neutral-400" />;
  if (type === "pdf") return <FileText className="w-4 h-4 text-neutral-400" />;
  return <File className="w-4 h-4 text-neutral-400" />;
}

export function Workspace() {
  const query = usePortalQuery(loadWorkspaceModel, []);
  const [searchQuery, setSearchQuery] = useState("");

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取工作空间数据...</Card>
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

  const filteredInputFiles = model.inputFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOutputFiles = model.outputFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Empty Inputs State
  if (pageState === "empty-inputs") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">工作空间</h1>
              <p className="text-neutral-600 text-sm">
                当前工作空间可用，文件空间正常，可以上传输入文件或进入 OPL
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/opl-launch" title="上传请进入 OPL 工作台">
                  <Upload className="w-4 h-4 mr-2" />
                  上传文件
                </Link>
              </Button>
              <Button asChild className="gap-2">
                <Link to="/opl-launch">
                  进入 OPL
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Workspace Info */}
        <Card className="border border-neutral-200 mb-6">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-neutral-600" />
                <h2 className="font-semibold text-neutral-900">当前工作空间</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                可用
              </Badge>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-neutral-600 mb-1">工作空间名称</div>
                <div className="font-semibold text-neutral-900">生物信息学实验</div>
                <div className="text-xs text-neutral-500 mt-1">创建于 2024-04-15</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">文件空间</div>
                <div className="font-semibold text-neutral-900">10.3 GB / 100 GB</div>
                <div className="text-xs text-neutral-500 mt-1">剩余 89.7 GB</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">工作空间状态</div>
                <div className="font-semibold text-neutral-900">正常运行</div>
                <div className="text-xs text-neutral-500 mt-1">文件空间可读写</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">最近回流</div>
                <div className="font-semibold text-neutral-900">5 小时前</div>
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
            <Button asChild>
              <Link to="/opl-launch" title="上传请进入 OPL 工作台">
                <Upload className="w-4 h-4 mr-2" />
                上传文件
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/opl-launch">进入 OPL</Link>
            </Button>
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
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">工作空间</h1>
              <p className="text-neutral-600 text-sm">
                当前工作空间可用，可以查看任务与结果或进入 OPL
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/trace">查看任务与结果</Link>
              </Button>
              <Button asChild className="gap-2">
                <Link to="/opl-launch">
                  进入 OPL
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Workspace Info */}
        <Card className="border border-neutral-200 mb-6">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-neutral-600" />
                <h2 className="font-semibold text-neutral-900">当前工作空间</h2>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                可用
              </Badge>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-neutral-600 mb-1">工作空间名称</div>
                <div className="font-semibold text-neutral-900">生物信息学实验</div>
                <div className="text-xs text-neutral-500 mt-1">创建于 2024-04-15</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">文件空间</div>
                <div className="font-semibold text-neutral-900">18.2 GB / 100 GB</div>
                <div className="text-xs text-neutral-500 mt-1">剩余 81.8 GB</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">工作空间状态</div>
                <div className="font-semibold text-neutral-900">正常运行</div>
                <div className="text-xs text-neutral-500 mt-1">文件空间可读写</div>
              </div>
              <div>
                <div className="text-sm text-neutral-600 mb-1">输入文件</div>
                <div className="font-semibold text-neutral-900">127 个文件</div>
                <div className="text-xs text-neutral-500 mt-1">占用 18.2 GB</div>
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
            在 OPL 中完成任务后，输出结果将自动回流到工作空间
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link to="/trace">查看任务与结果</Link>
            </Button>
            <Button asChild>
              <Link to="/opl-launch">进入 OPL</Link>
            </Button>
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
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">工作空间</h1>
              <p className="text-neutral-600 text-sm">
                文件空间当前不可用，需要先开通文件空间
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/resources">前往运行环境</Link>
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
                <h3 className="font-semibold text-amber-900 mb-2">文件空间未开通</h3>
                <p className="text-sm text-amber-800 mb-4">
                  当前文件空间未开通或不可写。前往运行环境与资源页开通文件空间后，即可上传文件和查看结果。
                </p>
                <Button asChild>
                  <Link to="/resources">前往运行环境与资源</Link>
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
      {/* Header - Workspace Summary */}
      <div className="mb-8 pb-8 border-b border-neutral-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-3">工作空间</h1>
            <p className="text-neutral-600 text-sm">
              查看输入文件、输出文件、结果回流和文件空间状态
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled title="结果下载请在 OPL 工作台或任务详情中完成">
              <Download className="w-4 h-4 mr-2" />
              下载全部结果
            </Button>
            <Button asChild className="gap-2">
              <Link to="/opl-launch">
                进入 OPL
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Workspace Info Card */}
      <Card className="border border-neutral-200 mb-6">
        <div className="p-5 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">当前工作空间</h2>
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
              <div className="text-sm text-neutral-600 mb-1">工作空间名称</div>
              <div className="font-semibold text-neutral-900">{model.workspaceTitle}</div>
              <div className="text-xs text-neutral-500 mt-1">创建于 {model.createdAt}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 mb-1">文件空间</div>
              <div className="font-semibold text-neutral-900">{model.fileSpaceUsed} / {model.fileSpaceTotal}</div>
              <Progress value={model.fileSpacePercent} className="h-1.5 mt-2" />
            </div>
            <div>
              <div className="text-sm text-neutral-600 mb-1">工作空间状态</div>
              <div className="font-semibold text-neutral-900">{model.status}</div>
              <div className="text-xs text-neutral-500 mt-1">文件空间可读写</div>
            </div>
            <div>
              <div className="text-sm text-neutral-600 mb-1">最近回流</div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-neutral-900">2 小时前</span>
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
                  <Button asChild size="sm" className="gap-2">
                    <Link to="/opl-launch" title="上传请进入 OPL 工作台">
                      <Upload className="w-4 h-4" />
                      上传文件
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <TabsContent value="input" className="m-0">
            <div className="p-5">
              <div className="text-sm text-neutral-600 mb-4">
                共 {model.inputFiles.length} 个文件，占用 {model.fileSpaceUsed}
              </div>
              <div className="space-y-2">
                {filteredInputFiles.map((file, i) => (
                  <div
                    key={i}
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
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {file.type.toUpperCase()}
                      </Badge>
                      <Button size="sm" variant="ghost" disabled title="文件下载请在 OPL 工作台或任务详情中完成">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled
                        title="更多文件操作请在 OPL 工作台完成"
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
                共 {model.outputFiles.length} 个结果文件
              </div>
              <div className="space-y-2">
                {filteredOutputFiles.map((file, i) => (
                  <div
                    key={i}
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
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {file.type.toUpperCase()}
                      </Badge>
                      <Button size="sm" variant="outline" disabled title="结果下载请在 OPL 工作台或任务详情中完成">
                        <Download className="w-4 h-4 mr-1" />
                        下载
                      </Button>
                      {file.taskId && (
                        <Button asChild size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Link to="/trace" aria-label={`查看 ${file.taskName || file.name} 的任务记录`}>
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
            <span className="text-sm text-neutral-600">文件空间</span>
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
          <div className="text-2xl font-semibold text-neutral-900">2 小时前</div>
          <div className="text-xs text-neutral-500 mt-1">自动同步中</div>
        </Card>
      </div>
    </div>
  );
}
