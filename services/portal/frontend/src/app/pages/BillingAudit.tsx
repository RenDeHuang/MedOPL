import { useState } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
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
  Wallet,
  TrendingDown,
  AlertCircle,
  Download,
  DollarSign,
  Zap,
  Server,
  HardDrive,
  FolderOpen,
  CheckCircle2,
  Shield,
  Clock,
  PlayCircle,
  XCircle,
} from "lucide-react";
import { loadBillingAuditModel, usePortalQuery } from "../data/portalAdapters";

type PageState = "ready" | "empty-ledger" | "no-current-cost";

interface BillingRecord {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: string;
  status: string;
}

interface WorkspaceCost {
  workspace: string;
  tasks: number;
  compute: number;
  storage: number;
  total: number;
}

interface TaskCost {
  id: string;
  name: string;
  workspace: string;
  status: string;
  cost: number;
  time: string;
}

function getTaskStatusIcon(status: string) {
  switch (status) {
    case "running":
      return <PlayCircle className="w-4 h-4 text-blue-600" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className="w-4 h-4 text-neutral-400" />;
  }
}

function triggerCsvDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function BillingAudit() {
  const query = usePortalQuery(loadBillingAuditModel, []);
  const [timeRange, setTimeRange] = useState("7days");
  const [exportNotice, setExportNotice] = useState("");

  if (query.status === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card className="border border-neutral-200 p-6 text-sm text-neutral-600">正在读取账单与审计数据...</Card>
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
  const pageState: PageState = model.billingRecords.length === 0 ? "empty-ledger" : "ready";
  const canExportBilling = model.billingRecords.length > 0;

  const exportBillingRecords = () => {
    if (!canExportBilling) {
      setExportNotice("当前时间窗口没有可导出的账单流水。");
      return;
    }
    setExportNotice("");
    triggerCsvDownload("/portal/billing/export.csv");
  };

  // Empty Ledger State
  if (pageState === "empty-ledger") {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="mb-8 pb-8 border-b border-neutral-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h1 className="text-2xl font-semibold text-neutral-900">账单与审计</h1>
                <Badge variant="outline" className="bg-neutral-100 text-neutral-600 border-neutral-200">
                  核对已接入
                </Badge>
              </div>
              <p className="text-neutral-600 text-sm">
                查看余额、冻结金额、消费明细和审计状态
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={exportBillingRecords} title="当前时间窗口没有可导出的账单流水">
              <Download className="w-4 h-4" />
              导出账单
            </Button>
          </div>
        </div>

        {exportNotice && (
          <div role="status" className="mb-6 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            {exportNotice}
          </div>
        )}

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
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
            <div className="text-xl font-semibold text-neutral-900">¥ 0.00</div>
          </Card>
          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">当前窗口</div>
            <div className="text-xl font-semibold text-neutral-900">¥ 0.00</div>
          </Card>
          <Card className="p-4 border border-neutral-200">
            <div className="text-sm text-neutral-600 mb-1">流水记录</div>
            <div className="text-xl font-semibold text-neutral-900">0</div>
          </Card>
        </div>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <Wallet className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">暂无账户流水</h3>
          <p className="text-sm text-neutral-600 mb-6">
            当前时间窗口内没有账户流水记录
          </p>
        </div>
      </div>
    );
  }

  // Ready State
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Hero - Billing Status and Financial Summary */}
      <div className="mb-8 pb-8 border-b border-neutral-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h1 className="text-2xl font-semibold text-neutral-900">账单与审计</h1>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                核对已接入
              </Badge>
            </div>
            <p className="text-neutral-600 text-sm">
              余额充足，扣费正常，账单透明可追溯
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={exportBillingRecords}>
              <Download className="w-4 h-4" />
              导出明细
            </Button>
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="mb-8">
        <h2 className="font-semibold text-neutral-900 mb-4">资金摘要</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">余额</span>
              <Wallet className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.balance}</div>
            <div className="text-xs text-neutral-500 mt-1">总余额</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">可用余额</span>
              <DollarSign className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.availableBalance}</div>
            <div className="text-xs text-neutral-500 mt-1">扣除冻结</div>
          </Card>

          <Card className="p-4 border border-orange-200 bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-orange-700">冻结金额</span>
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-semibold text-orange-700">{model.frozenAmount}</div>
            <div className="text-xs text-orange-600 mt-1">18 小时后解冻</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">今日消费</span>
              <TrendingDown className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.todayCost}</div>
            <div className="text-xs text-neutral-500 mt-1">费用估算</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">累计消费</span>
              <TrendingDown className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.totalCost}</div>
            <div className="text-xs text-neutral-500 mt-1">本月</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-600">账户流水</span>
              <Wallet className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-semibold text-neutral-900">{model.billingRecords.length}</div>
            <div className="text-xs text-neutral-500 mt-1">本月记录数</div>
          </Card>
        </div>
      </div>

      {/* Cost Breakdown and Filters */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h2 className="font-semibold text-neutral-900">费用拆分与趋势</h2>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-600">计算费用</span>
            </div>
            <div className="text-xl font-semibold text-neutral-900 mb-1">{model.computeCost}</div>
            <div className="text-xs text-neutral-500">76% 总成本</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-600">文件空间</span>
            </div>
            <div className="text-xl font-semibold text-neutral-900 mb-1">{model.storageCost}</div>
            <div className="text-xs text-neutral-500">24% 总成本</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-600">总成本</span>
            </div>
            <div className="text-xl font-semibold text-neutral-900 mb-1">{model.totalCost}</div>
            <div className="text-xs text-neutral-500">本月累计</div>
          </Card>

          <Card className="p-4 border border-neutral-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-neutral-400" />
              <span className="text-sm text-neutral-600">核对状态</span>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              已核对
            </Badge>
            <div className="text-xs text-neutral-500 mt-1">实时同步</div>
          </Card>
        </div>
      </div>

      {/* Workspace and Task Costs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Workspace Costs */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">工作空间费用</h2>
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {model.workspaceCosts.map((ws, i) => (
                <div key={i} className="p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-neutral-900 text-sm mb-1">{ws.workspace}</div>
                      <div className="text-xs text-neutral-500">{ws.tasks} 个任务</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-neutral-900">¥ {ws.total.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
                    <span>计算 ¥{ws.compute.toFixed(2)}</span>
                    <span>存储 ¥{ws.storage.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Task Costs */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">任务费用</h2>
            </div>
          </div>
          <div className="p-5">
            <div className="space-y-3">
              {model.taskCosts.map((task, i) => (
                <div key={i} className="p-3 rounded-md border border-neutral-200 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getTaskStatusIcon(task.status)}
                      <div className="flex-1">
                        <div className="font-medium text-neutral-900 text-sm mb-1">{task.name}</div>
                        <div className="text-xs text-neutral-500">{task.workspace}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-neutral-900">¥ {task.cost.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-600 mt-2 pt-2 border-t border-neutral-100">
                    {task.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Account Ledger and Audit Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Ledger - 2 columns */}
        <Card className="border border-neutral-200 lg:col-span-2">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">账户流水</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.billingRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm text-neutral-600">
                      {record.date}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {record.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-900">
                      {record.description}
                    </TableCell>
                    <TableCell className="font-medium text-neutral-900">
                      {record.amount}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-neutral-600">{record.status}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="p-4 border-t border-neutral-200 text-sm text-neutral-600 text-center">
            显示最近 100 条流水 · 保留 1 年
          </div>
        </Card>

        {/* Audit Status - 1 column */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-neutral-600" />
              <h2 className="font-semibold text-neutral-900">审计状态</h2>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="text-sm text-neutral-600 mb-2">审计模式</div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                标准审计
              </Badge>
            </div>

            <div>
              <div className="text-sm text-neutral-600 mb-2">操作日志</div>
              <div className="font-semibold text-neutral-900">保留 90 天</div>
              <div className="text-xs text-neutral-500 mt-1">最近操作 2 分钟前</div>
            </div>

            <div>
              <div className="text-sm text-neutral-600 mb-2">账单记录</div>
              <div className="font-semibold text-neutral-900">保留 1 年</div>
              <div className="text-xs text-neutral-500 mt-1">156 条记录</div>
            </div>

            <div>
              <div className="text-sm text-neutral-600 mb-2">扣费状态</div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                正常扣费
              </Badge>
              <div className="text-xs text-neutral-500 mt-1">最近扣费 2 分钟前</div>
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Clock className="w-3.5 h-3.5" />
                <span>下次冻结 18 小时后</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
