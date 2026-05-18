import { Activity, CheckCircle, AlertCircle, XCircle, Server, Database, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { loadAdminOpsModel, usePortalQuery } from "../../data/portalAdapters";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  uptime: string;
  lastCheck: string;
}

// 服务状态页 - 管理员分面之一
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

      {/* 服务可用性摘要 */}
      <Card>
        <CardHeader>
          <CardTitle>服务状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
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
