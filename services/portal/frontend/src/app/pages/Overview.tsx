import { useOverviewModel } from "../data/portalOverviewModel";
import { Badge, Button, Card, Progress } from "../components/ui/core";
import { Link } from "react-router";
import {
  CheckCircle2,
  ArrowRight,
  Server,
  HardDrive,
  Clock,
  Zap,
  FileText,
  AlertCircle,
  DollarSign,
  PlayCircle,
  CheckCircle,
  XCircle,
  FolderOpen,
  TrendingUp,
  Shield,
  ExternalLink,
} from "lucide-react";

type ServiceStatus = "ready" | "restricted" | "unprovisioned" | "degraded";

export function Overview() {
  const query = useOverviewModel();

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取 Portal 总览数据...</Card>
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
  const serviceStatus: ServiceStatus = model.serviceStatus;

  // Unprovisioned State
  if (serviceStatus === "unprovisioned") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Hero - Service Status */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200">
                  托管科研工作台
                </Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  待开通
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">
                选择套餐开通服务
              </h1>
              <p className="text-neutral-600 text-sm max-w-2xl">
                开通运行环境后即可使用托管科研工作台，文件和任务结果将自动保存
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to="/resources">
                选择套餐
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        <Card className="border border-blue-200 bg-blue-50">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">运行环境未开通</h3>
                <p className="text-sm text-blue-800 mb-4">
                  前往运行环境页面选择适合的套餐配置，开通后即可进入 OPL 开始科研工作。
                </p>
                <Button asChild>
                  <Link to="/resources">前往运行环境</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Restricted State
  if (serviceStatus === "restricted") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Hero - Service Status */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200">
                  托管科研工作台
                </Badge>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  受限
                </Badge>
              </div>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3">
                工作台受限，请处理余额
              </h1>
              <p className="text-neutral-600 text-sm max-w-2xl">
                当前余额不足或冻结金额异常，部分功能受限，处理后即可恢复正常使用
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link to="/billing">
                处理余额
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Financial Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">余额</span>
              <DollarSign className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.balance}</div>
            <div className="text-xs text-neutral-500 mt-1">总余额</div>
          </Card>

          <Card className="p-4 border border-orange-200 bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-orange-700">可用余额</span>
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-semibold text-orange-700">{model.availableBalance}</div>
            <div className="text-xs text-orange-600 mt-1">余额偏低</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">冻结金额</span>
              <Zap className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-orange-600">{model.frozenAmount}</div>
            <div className="text-xs text-neutral-500 mt-1">预扣计费</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">今日消费</span>
              <TrendingUp className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.todayCost}</div>
            <div className="text-xs text-neutral-500 mt-1">费用估算</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">累计消费</span>
              <TrendingUp className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.historicalCost}</div>
            <div className="text-xs text-neutral-500 mt-1">本月</div>
          </Card>
        </div>

        <Card className="border border-orange-200 bg-orange-50">
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">余额不足预警</h3>
                <p className="text-sm text-orange-800 mb-4">
                  当前可用余额不足，可能影响任务执行和资源使用。建议尽快充值以确保服务正常运行。
                </p>
                <Button asChild>
                  <Link to="/billing">前往账单与审计</Link>
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
      {/* Hero - Service Status and Main Action */}
      <div className="mb-8 pb-8 border-b border-neutral-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200">
                托管科研工作台
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                可用
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-3">
              工作台运行正常，可以开始使用
            </h1>
            <p className="text-neutral-600 text-sm max-w-2xl">
              运行环境已就绪，计算资源和文件空间正常，可以直接进入 OPL 开始科研工作
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link to="/opl-launch">
              进入 OPL
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Current Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">套餐</span>
            <Server className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.planName}</div>
          <div className="text-xs text-neutral-500 mt-1">{model.planSpec}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">文件空间</span>
            <HardDrive className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.storageUsed}</div>
          <div className="text-xs text-neutral-500 mt-1">/ {model.storageTotal} ({model.storagePercent}%)</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">可用余额</span>
            <DollarSign className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.availableBalance}</div>
          <div className="text-xs text-neutral-500 mt-1">冻结 {model.frozenAmount}</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">运行状态</span>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              正常
            </Badge>
          </div>
          <div className="text-2xl font-semibold text-neutral-900">{model.runtimeDays}</div>
          <div className="text-xs text-neutral-500 mt-1">已运行时长</div>
        </Card>
      </div>

      {/* Financial and Task Summary */}
      <div className="mb-8">
        <h2 className="font-semibold text-neutral-900 mb-4">资金与任务摘要</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">余额</div>
            <div className="text-xl font-semibold text-neutral-900">{model.balance}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">可用余额</div>
            <div className="text-xl font-semibold text-neutral-900">{model.availableBalance}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">冻结金额</div>
            <div className="text-xl font-semibold text-orange-600">{model.frozenAmount}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">今日消费</div>
            <div className="text-xl font-semibold text-neutral-900">{model.todayCost}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">累计消费</div>
            <div className="text-xl font-semibold text-neutral-900">{model.historicalCost}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">会话数</div>
            <div className="text-xl font-semibold text-neutral-900">{model.workspaceCount}</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">任务数</div>
            <div className="text-xl font-semibold text-neutral-900">{model.runCount}</div>
          </Card>
        </div>
      </div>

      {/* Runtime Environment and Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Runtime Environment Summary */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">运行环境</h2>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-neutral-600 hover:text-neutral-900">
                <Link to="/resources">
                  查看详情
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-600">当前套餐</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-neutral-900">{model.planName}</div>
                <div className="text-xs text-neutral-500">{model.planSpec}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-600">文件空间</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-neutral-900">{model.storageUsed} / {model.storageTotal}</div>
                <Progress value={model.storagePercent} className="h-1 w-24 mt-1" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-600">计费状态</span>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                正常
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-neutral-400" />
                <span className="text-sm text-neutral-600">审计状态</span>
              </div>
              <span className="text-sm font-medium text-neutral-900">标准审计</span>
            </div>

            <div className="pt-3 border-t border-neutral-200">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Clock className="w-3.5 h-3.5" />
                <span>{model.runtimeDays} · {model.pricingStatus}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Tasks */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">最近任务</h2>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-neutral-600 hover:text-neutral-900">
                <Link to="/trace">
                  查看全部
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {model.recentTasks.map((task, i) => (
              <div key={i} className="flex items-center justify-between py-2 hover:bg-neutral-50 rounded px-2 -mx-2 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  {task.status === "running" && (
                    <PlayCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                  {task.status === "completed" && (
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  )}
                  {task.status === "failed" && (
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-neutral-900 truncate">{task.name}</div>
                    <div className="text-xs text-neutral-500">
                      {task.time}
                      {task.files > 0 && ` · ${task.files} 个输出文件`}
                    </div>
                  </div>
                </div>
                {task.files > 0 && (
                  <Button asChild variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Link to="/workspace">查看结果</Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Package and Workspace Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Package Summary */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">套餐摘要</h2>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-neutral-600 hover:text-neutral-900">
                <Link to="/resources">
                  更改套餐
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600">当前套餐</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {model.planName}
                </Badge>
              </div>
              <div className="text-2xl font-semibold text-neutral-900 mb-1">
                {model.priceLabel}
              </div>
              <div className="text-xs text-neutral-500">{model.pricingStatus}</div>
            </div>

            <div className="space-y-3 pt-4 border-t border-neutral-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">计算资源</span>
                <span className="font-medium text-neutral-900">{model.planSpec}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">文件空间</span>
                <span className="font-medium text-neutral-900">{model.storageTotal}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">并发能力</span>
                <span className="font-medium text-neutral-900">{model.concurrent} 个任务</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200 text-xs text-neutral-600">
              支持增加计算资源和扩容文件空间
            </div>
          </div>
        </Card>

        {/* Workspace Summary */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900">工作空间摘要</h2>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-neutral-600 hover:text-neutral-900">
                <Link to="/workspace">
                  查看详情
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FolderOpen className="w-4 h-4 text-neutral-600" />
                <span className="text-sm text-neutral-600">当前工作空间</span>
              </div>
              <div className="font-semibold text-neutral-900 mb-1">{model.workspaceTitle}</div>
              <div className="text-xs text-neutral-500">创建于 2024-04-15</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-xs text-neutral-600">输入文件</span>
                </div>
                <div className="font-semibold text-neutral-900">{model.inputFiles} 个</div>
                <div className="text-xs text-neutral-500 mt-0.5">18.2 GB</div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-xs text-neutral-600">输出文件</span>
                </div>
                <div className="font-semibold text-neutral-900">{model.outputFiles} 个</div>
                <div className="text-xs text-neutral-500 mt-0.5">10.3 GB</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Clock className="w-3.5 h-3.5" />
                <span>最近回流 2 小时前 · 自动同步中</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
