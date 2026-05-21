import { Activity, CheckCircle, AlertCircle, XCircle, Server, Database, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { loadAdminOpsModel, usePortalQuery } from "../../data/portalAdapters";

interface ServiceStatus {
  rowKey: string;
  name: string;
  status: string;
  uptime: string;
  lastCheck: string;
}

interface LocalOperationRow {
  rowKey: string;
  type: string;
  label: string;
  owner: string;
  workspace: string;
  status: string;
  auditState: string;
}

interface OpsExceptionRow {
  rowKey: string;
  type: string;
  accountId: string;
  workspaceId: string;
  occurredAt: string;
}

interface FutureAuthorizedAction {
  rowKey: string;
  name: string;
  status: string;
  reason: string;
}

export function AdminOps() {
  const query = usePortalQuery(loadAdminOpsModel, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              正常
            </Badge>
          </div>
        );
      case "degraded":
        return (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              降级
            </Badge>
          </div>
        );
      case "down":
        return (
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              不可用
            </Badge>
          </div>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取服务状态...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const {
    opsSurfaceEnabled,
    disabledTitle,
    disabledMessage,
    platformMetrics,
    services,
    localOperationRows = [],
    opsExceptionRows = [],
    costAllocationRows = [],
    futureAuthorizedActions = [],
    opsSummary = {
      accountCount: 0,
      workspaceCount: 0,
      currentRunCount: 0,
      exceptionCount: 0,
      estimatedCost: "¥ 0.00",
      frozenAmount: "¥ 0.00",
      tPlus1Status: "未开始",
    },
    adminReadOnlyMessage,
  } = query.data;

  if (opsSurfaceEnabled === false) {
    return (
      <div className="p-6 space-y-6">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertCircle className="w-5 h-5" />
              {disabledTitle || "平台托管运维入口未启用"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-orange-800">
            <p>{disabledMessage || "未启用平台托管运维入口。"}</p>
            <p>
              当前管理台保留服务状态页面入口，但默认后端 API 会返回
              <span className="font-medium"> ops_surface_disabled </span>
              产品态；请在启用运维 surface 后再查看底层服务探针、运行环境和外部组件状态。
            </p>
            <p className="text-orange-700">{adminReadOnlyMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 平台主要链路状态 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              总请求数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">
              {platformMetrics.totalRequests.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              平均响应时间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">
              {platformMetrics.avgResponseTime}ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Server className="w-4 h-4" />
              活跃连接
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">
              {platformMetrics.activeConnections}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              错误率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-green-600">
              {platformMetrics.errorRate}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 本地运维投影 */}
      <Card>
        <CardHeader>
          <CardTitle>本地运维投影</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-sm">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-neutral-500">账号</div>
              <div className="text-lg font-semibold text-neutral-900">{opsSummary.accountCount}</div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-neutral-500">工作空间</div>
              <div className="text-lg font-semibold text-neutral-900">{opsSummary.workspaceCount}</div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-neutral-500">运行中任务</div>
              <div className="text-lg font-semibold text-neutral-900">{opsSummary.currentRunCount}</div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-neutral-500">T+1 对账</div>
              <div className="text-lg font-semibold text-neutral-900">{opsSummary.tPlus1Status}</div>
            </div>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>对象</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>工作空间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>审计状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localOperationRows.slice(0, 12).map((item: LocalOperationRow) => (
                  <TableRow key={item.rowKey}>
                    <TableCell>{item.type}</TableCell>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{item.owner}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{item.workspace}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell className="text-sm text-neutral-600">{item.auditState}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 审计支撑的运营异常 */}
      <Card>
        <CardHeader>
          <CardTitle>审计支撑的运营异常</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-neutral-600">
            当前异常数 {opsSummary.exceptionCount}；估算费用 {opsSummary.estimatedCost}，冻结金额 {opsSummary.frozenAmount}。
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {opsExceptionRows.slice(0, 6).map((item: OpsExceptionRow) => (
              <div key={item.rowKey} className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                <div className="font-medium">{item.type}</div>
                <div>账号 {item.accountId || "未返回"} · 工作空间 {item.workspaceId || "未返回"}</div>
                <div className="text-orange-700">{item.occurredAt}</div>
              </div>
            ))}
            {opsExceptionRows.length === 0 && (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500">
                当前没有本地异常事件。
              </div>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            分账标签 {costAllocationRows.length} 条，只用于本地归因核对，不代表真实扣费已执行。
          </div>
        </CardContent>
      </Card>

      {/* Future-authorized 操作边界 */}
      <Card>
        <CardHeader>
          <CardTitle>Future-authorized 操作边界</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-sm text-neutral-600">
            真实云资源操作未授权、真实扣费未授权、真实资源释放未授权均保持 disabled/future-authorized 状态。
          </div>
          <div className="space-y-3">
            {futureAuthorizedActions.map((item: FutureAuthorizedAction) => (
              <div key={item.rowKey} className="flex items-start justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div>
                  <div className="font-medium text-neutral-900">{item.name}</div>
                  <div className="text-sm text-neutral-600">{item.reason}</div>
                </div>
                <Badge variant="outline">{item.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 服务可用性摘要 */}
      <Card>
        <CardHeader>
          <CardTitle>服务状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service: ServiceStatus) => (
              <div
                key={service.rowKey}
                className="flex items-center justify-between p-4 rounded-md border border-neutral-200 bg-neutral-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Database className="w-5 h-5 text-neutral-600" />
                    <span className="font-medium text-neutral-900">{service.name}</span>
                    {getStatusBadge(service.status)}
                  </div>
                  <div className="flex gap-6 text-sm text-neutral-600">
                    <div>
                      <span className="text-neutral-500">可用率:</span>{" "}
                      <span className="font-medium">{service.uptime}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">最后检查:</span>{" "}
                      <span>{service.lastCheck}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 说明 */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-neutral-500">
            <p className="mb-2">
              此页面仅展示服务层状态摘要,不提供云资源直接操作能力。
            </p>
            <p>
              {adminReadOnlyMessage}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
