import { useState, type MouseEvent } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Zap,
  Search,
  FolderOpen,
  ExternalLink,
  Filter,
  ArrowRight
} from "lucide-react";
import { loadTasksResultsModel, usePortalQuery, type OplArtifactView, type TaskItem } from "../data/portalAdapters";
import { Link, useNavigate } from "react-router";

type TaskStatus = "running" | "completed" | "failed" | "waiting";
type PageState = "ready" | "empty" | "filtered-empty" | "degraded" | "loading";

type Task = TaskItem;

function getStatusBadge(status: TaskStatus) {
  const variants: Record<TaskStatus, { variant: string; icon: JSX.Element; text: string }> = {
    running: {
      variant: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <PlayCircle className="w-3 h-3" />,
      text: "运行中",
    },
    completed: {
      variant: "bg-green-50 text-green-700 border-green-200",
      icon: <CheckCircle2 className="w-3 h-3" />,
      text: "已完成",
    },
    failed: {
      variant: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle className="w-3 h-3" />,
      text: "失败",
    },
    waiting: {
      variant: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <Clock className="w-3 h-3" />,
      text: "等待中",
    },
  };

  const config = variants[status];

  return (
    <Badge variant="outline" className={`${config.variant} gap-1`}>
      {config.icon}
      {config.text}
    </Badge>
  );
}

export function TasksResults() {
  const navigate = useNavigate();
  const query = usePortalQuery(loadTasksResultsModel, []);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingArtifactTask, setPendingArtifactTask] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取任务与结果数据...</Card>
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
  const tasks = model.tasks;
  const workspaceOptions = model.workspaceOptions;

  async function handleViewArtifact(task: Task) {
    setActionMessage("");
    setPendingArtifactTask(task.id);
    try {
      const artifact: OplArtifactView = await model.resolveTraceArtifact(task);
      setActionMessage(`${artifact.name || artifact.artifactRef} 已确认回流，类型 ${artifact.contentType || artifact.kind}，大小 ${artifact.sizeBytes} B。`);
      return true;
    } catch {
      setActionMessage(task.artifactActionMessage || "当前任务结果暂不可读取，请稍后重试。");
      return false;
    } finally {
      setPendingArtifactTask(null);
    }
  }

  async function handleOpenResult(event: MouseEvent<HTMLAnchorElement>, task: Task) {
    event.preventDefault();
    if (pendingArtifactTask) return;
    const resolved = await handleViewArtifact(task);
    if (resolved || task.outputFileRef) {
      navigate("/workspace");
    }
  }

  // Filter tasks based on current filters
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = selectedStatus === "all" || task.status === selectedStatus;
    const matchesWorkspace = selectedWorkspace === "all" || task.workspace === selectedWorkspace;
    const matchesSearch = searchQuery === "" ||
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesWorkspace && matchesSearch;
  });

  const runningCount = tasks.filter((t) => t.status === "running").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;
  const totalOutputFiles = tasks.reduce((sum, t) => sum + t.outputFiles, 0);
  const totalCost = tasks.reduce((sum, t) => sum + Number(t.cost.replace("¥ ", "")), 0);

  const hasFilters = selectedStatus !== "all" || selectedWorkspace !== "all" || searchQuery !== "";
  const isFilteredEmpty = hasFilters && filteredTasks.length === 0;
  const isEmpty = tasks.length === 0;

  // Empty State
  if (isEmpty) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-3">任务与结果</h1>
          <p className="text-neutral-600 text-sm">
            查看任务状态、输出文件、费用估算与结果链路
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂无任务记录</h3>
          <p className="text-sm text-neutral-600 mb-6 max-w-md text-center">
            进入 OPL 开始任务后，任务记录和输出结果将在此显示
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/opl-launch">进入 OPL</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/workspace">查看工作空间</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Filtered Empty State
  if (isFilteredEmpty) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-3">任务与结果</h1>
          <p className="text-neutral-600 text-sm">
            查看任务状态、输出文件、费用估算与结果链路
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">运行中</span>
              <PlayCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{runningCount}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">已完成</span>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{completedCount}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">失败</span>
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{failedCount}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">输出文件</span>
              <FileText className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{totalOutputFiles}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">今日费用</span>
              <span className="text-xs text-neutral-500">估算</span>
            </div>
            <div className="text-2xl font-semibold text-neutral-900">¥ {totalCost.toFixed(2)}</div>
          </Card>
        </div>

        {/* Filter Section */}
        <Card className="border border-neutral-200 mb-8">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">筛选</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="搜索任务或会话..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="running">运行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="waiting">等待中</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger>
                  <SelectValue placeholder="工作空间" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部工作空间</SelectItem>
                  {workspaceOptions.map((workspace) => (
                    <SelectItem key={workspace} value={workspace}>{workspace}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select defaultValue="7days">
                <SelectTrigger>
                  <SelectValue placeholder="时间范围" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">今天</SelectItem>
                  <SelectItem value="7days">最近 7 天</SelectItem>
                  <SelectItem value="30days">最近 30 天</SelectItem>
                  <SelectItem value="all">全部</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">当前筛选无结果</h3>
          <p className="text-sm text-neutral-600 mb-6">
            尝试调整筛选条件或清空筛选
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedStatus("all");
              setSelectedWorkspace("all");
              setSearchQuery("");
            }}
          >
            清空筛选
          </Button>
        </div>
      </div>
    );
  }

  // Ready State
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 pb-8 border-b border-neutral-200">
        <h1 className="text-2xl font-semibold text-neutral-900 mb-3">任务与结果</h1>
        <p className="text-neutral-600 text-sm">
          查看任务状态、输出文件、费用估算与结果链路
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">运行中</span>
            <PlayCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{runningCount}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">已完成</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{completedCount}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">失败</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{failedCount}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">输出文件</span>
            <FileText className="w-4 h-4 text-neutral-600" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{totalOutputFiles}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">今日费用</span>
            <span className="text-xs text-neutral-500">估算</span>
          </div>
          <div className="text-2xl font-semibold text-neutral-900">¥ {totalCost.toFixed(2)}</div>
        </Card>
      </div>

      {/* Filter Section */}
      <Card className="border border-neutral-200 mb-6">
        <div className="p-5 border-b border-neutral-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-neutral-600" />
            <h2 className="font-semibold text-neutral-900">筛选</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="搜索任务或会话..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="running">运行中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
                <SelectItem value="waiting">等待中</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
              <SelectTrigger>
                <SelectValue placeholder="工作空间" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部工作空间</SelectItem>
                {workspaceOptions.map((workspace) => (
                  <SelectItem key={workspace} value={workspace}>{workspace}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="7days">
              <SelectTrigger>
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">今天</SelectItem>
                <SelectItem value="7days">最近 7 天</SelectItem>
                <SelectItem value="30days">最近 30 天</SelectItem>
                <SelectItem value="all">全部</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tasks Table */}
      {actionMessage && (
        <Card className="border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-700">{actionMessage}</Card>
      )}

      <Card className="border border-neutral-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>任务 / 会话</TableHead>
                <TableHead>工作空间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>输出文件</TableHead>
                <TableHead>资源用量</TableHead>
                <TableHead>费用估算</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-neutral-900">{task.name}</div>
                      <div className="text-xs text-neutral-500">{task.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm text-neutral-900">{task.workspace}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>
                    {task.outputFiles > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-neutral-400" />
                          <span className="text-sm text-neutral-900">
                            {task.outputFiles} 个文件
                          </span>
                        </div>
                        {task.outputFileNames && task.outputFileNames.length > 0 && (
                          <div className="text-xs text-neutral-500 max-w-xs truncate">
                            {task.outputFileNames[0]}
                            {task.outputFileNames.length > 1 && ` +${task.outputFileNames.length - 1}`}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm text-neutral-900">{task.resourceUsage}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      运行 {task.runtimeTraceStatus || "未返回"} · 产物 {task.artifactTraceStatus || "未返回"}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-neutral-900">
                    {task.cost}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-600">
                    <div>{task.startTime}</div>
                    <div className="text-xs text-neutral-500">{task.duration}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    {task.outputFiles > 0 ? (
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title={task.artifactActionMessage || "读取 OPL artifact 投影"}
                      >
                        <Link
                          to="/workspace"
                          onClick={(event) => handleOpenResult(event, task)}
                          aria-disabled={pendingArtifactTask === task.id}
                        >
                          查看结果
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="ghost" className="gap-1">
                        <Link
                          to="/trace"
                          onClick={() => setActionMessage(task.artifactActionMessage || "当前任务还没有回流的结果文件。")}
                          title="当前任务还没有回流的结果文件"
                        >
                          查看详情
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between text-sm">
          <span className="text-neutral-600">显示 {filteredTasks.length} 个任务</span>
          <div className="text-neutral-500">最后更新于 2 分钟前</div>
        </div>
      </Card>
    </div>
  );
}
