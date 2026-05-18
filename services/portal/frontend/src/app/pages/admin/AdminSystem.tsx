import { Save, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Separator } from "../../components/ui/separator";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Link } from "react-router";
import { loadAdminSystemModel, usePortalQuery } from "../../data/portalAdapters";

export function AdminSystem() {
  const query = usePortalQuery(loadAdminSystemModel, []);

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">正常</Badge>;
      case "degraded":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">降级</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">失败</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取站点设置...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const { siteName, homeTitle, registrationEnabled, serviceStatus, adminReadOnlyMessage } = query.data;

  return (
    <div className="p-6 space-y-6">
      {/* 站点设置区 */}
      <Card>
        <CardHeader>
          <CardTitle>站点设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-neutral-50 border-neutral-200">
            <AlertCircle className="h-4 w-4 text-neutral-600" />
            <AlertDescription className="text-neutral-700">{adminReadOnlyMessage}</AlertDescription>
          </Alert>

          {/* 基本设置 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">站点名称</Label>
              <Input
                id="siteName"
                value={siteName}
                placeholder="输入站点名称"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteLogo">站点 Logo</Label>
              <div className="flex gap-3">
                <Input
                  id="siteLogo"
                  placeholder="Logo URL"
                  disabled
                />
                <Button variant="outline" disabled title={adminReadOnlyMessage}>上传</Button>
              </div>
              <p className="text-xs text-neutral-500">
                建议尺寸: 200x60 像素
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="homeTitle">首页文案 / 副标题</Label>
              <Input
                id="homeTitle"
                value={homeTitle}
                placeholder="输入首页描述文案"
                readOnly
              />
            </div>
          </div>

          <Separator />

          {/* 功能开关 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-neutral-900">功能开关</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="registration">用户注册</Label>
                <p className="text-sm text-neutral-500">
                  允许新用户自主注册账号
                </p>
              </div>
              <Switch
                id="registration"
                checked={registrationEnabled}
                disabled
              />
            </div>
          </div>

          <Separator />

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button
              disabled
              title={adminReadOnlyMessage}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 服务状态摘要区 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>服务状态摘要</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/ops">查看详细状态</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 服务状态概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md border border-neutral-200 bg-neutral-50">
              <div className="text-xs text-neutral-500 mb-1">服务总数</div>
              <div className="text-2xl font-semibold text-neutral-900">
                {serviceStatus.totalServices}
              </div>
            </div>

            <div className="p-4 rounded-md border border-orange-200 bg-orange-50">
              <div className="text-xs text-orange-600 mb-1">降级服务</div>
              <div className="text-2xl font-semibold text-orange-600">
                {serviceStatus.degradedServices}
              </div>
            </div>

            <div className="p-4 rounded-md border border-red-200 bg-red-50">
              <div className="text-xs text-red-600 mb-1">失败服务</div>
              <div className="text-2xl font-semibold text-red-600">
                {serviceStatus.failedServices}
              </div>
            </div>
          </div>

          {/* 关键链路摘要 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-900">关键链路状态</h3>
            <div className="space-y-2">
              {serviceStatus.keyRoutes.map((route) => (
                <div
                  key={route.rowKey}
                  className="flex items-center justify-between p-3 rounded-md border border-neutral-200 bg-neutral-50"
                >
                  <span className="text-sm text-neutral-900">{route.name}</span>
                  {getServiceStatusBadge(route.status)}
                </div>
              ))}
            </div>
          </div>

          {/* 安全检查摘要 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-900">安全检查摘要</h3>
            <div className="flex items-center gap-4 p-4 rounded-md border border-neutral-200 bg-neutral-50">
              <div className="flex-1">
                <div className="text-sm text-neutral-600">
                  通过 {serviceStatus.securityChecks.passed} / {serviceStatus.securityChecks.total}
                </div>
                <div className="mt-2 h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${(serviceStatus.securityChecks.passed / serviceStatus.securityChecks.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
              {serviceStatus.securityChecks.failed > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {serviceStatus.securityChecks.failed} 项失败
                </Badge>
              )}
            </div>
          </div>

          {/* 性能状态摘要 */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-neutral-900">性能状态摘要</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-md border border-neutral-200 bg-neutral-50">
                <div className="text-xs text-neutral-500 mb-1">平均响应时间</div>
                <div className="text-lg font-semibold text-neutral-900">
                  {serviceStatus.performance.avgResponseTime}ms
                </div>
              </div>
              <div className="p-4 rounded-md border border-neutral-200 bg-neutral-50">
                <div className="text-xs text-neutral-500 mb-1">错误率</div>
                <div className="text-lg font-semibold text-green-600">
                  {serviceStatus.performance.errorRate}%
                </div>
              </div>
            </div>
          </div>

          {/* 提示信息 */}
          {(serviceStatus.failedServices > 0 || serviceStatus.degradedServices > 0) && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                当前有 {serviceStatus.failedServices + serviceStatus.degradedServices} 个服务异常，请前往{" "}
                <Link to="/admin/ops" className="underline font-medium">服务状态页</Link> 查看详情
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
