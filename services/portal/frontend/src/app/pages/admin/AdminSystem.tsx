import { useEffect, useState } from "react";
import { Alert, AlertDescription, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Separator, Switch } from "../../components/ui/core";
import { Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import {
  normalizePortalAdminActionError,
  updateAdminSiteSettings,
  useAdminSystemModel,
} from "../../data/portalAdminOpsModel";

export function AdminSystem() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [siteName, setSiteName] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const query = useAdminSystemModel(refreshVersion);

  useEffect(() => {
    if (query.status !== "ready") return;
    setSiteName(query.data.siteName);
    setSiteLogo(query.data.siteLogo);
    setSiteSubtitle(query.data.siteSubtitle || query.data.homeTitle);
    setRegistrationEnabled(query.data.registrationEnabled);
  }, [query]);

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

  const { serviceStatus, adminReadOnlyMessage } = query.data;

  const refreshSystem = () => setRefreshVersion((value) => value + 1);

  const submitSettings = async () => {
    const nextSiteName = siteName.trim();
    const nextSiteSubtitle = siteSubtitle.trim();
    const nextSiteLogo = siteLogo.trim();
    if (!nextSiteName) {
      setActionSuccess("");
      setActionError("请输入站点名称。");
      return;
    }
    if (!nextSiteSubtitle) {
      setActionSuccess("");
      setActionError("请输入首页文案 / 副标题。");
      return;
    }

    setIsSaving(true);
    setActionError("");
    setActionSuccess("");
    try {
      await updateAdminSiteSettings({
        siteName: nextSiteName,
        siteLogo: nextSiteLogo,
        siteSubtitle: nextSiteSubtitle,
        homeContent: nextSiteSubtitle,
        allowRegistration: registrationEnabled,
        redirectTo: "/admin/system",
      });
      setActionSuccess("站点设置已保存。");
      refreshSystem();
    } catch (error) {
      setActionError(normalizePortalAdminActionError(error, "保存失败，请稍后重试。"));
    } finally {
      setIsSaving(false);
    }
  };

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
                name="siteName"
                value={siteName}
                placeholder="输入站点名称"
                onChange={(event) => setSiteName(event.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteLogo">站点 Logo</Label>
              <div className="flex gap-3">
                <Input
                  id="siteLogo"
                  name="siteLogo"
                  value={siteLogo}
                  placeholder="Logo URL"
                  onChange={(event) => setSiteLogo(event.target.value)}
                  disabled={isSaving}
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
                name="homeTitle"
                value={siteSubtitle}
                placeholder="输入首页描述文案"
                onChange={(event) => setSiteSubtitle(event.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <Separator />

          {/* 功能开关 */}
          <div className="space-y-4">
            <div className="text-sm font-medium text-neutral-900">功能开关</div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="registration">用户注册</Label>
                <p className="text-sm text-neutral-500">
                  允许新用户自主注册账号
                </p>
              </div>
              <Switch
                id="registration"
                name="registration"
                checked={registrationEnabled}
                onCheckedChange={setRegistrationEnabled}
                disabled={isSaving}
              />
            </div>
          </div>

          <Separator />

          {(actionError || actionSuccess) && (
            <Alert className={actionError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}>
              <AlertCircle className={`h-4 w-4 ${actionError ? "text-red-600" : "text-green-600"}`} />
              <AlertDescription className={actionError ? "text-red-700" : "text-green-700"}>
                {actionError || actionSuccess}
              </AlertDescription>
            </Alert>
          )}

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button
              disabled={isSaving}
              onClick={submitSettings}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 服务状态摘要区 */}
      <Card
        data-ui-pattern="state-feedback"
        role="status"
        aria-live="polite"
        aria-label="服务状态摘要状态：已汇总"
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>服务状态摘要</CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 data-ui-signal="status-icon" aria-hidden="true" className="w-3 h-3" />
                <span data-ui-signal="status-label">已汇总</span>
              </Badge>
            </div>
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
            <div className="text-sm font-medium text-neutral-900">关键链路状态</div>
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
            <div className="text-sm font-medium text-neutral-900">安全检查摘要</div>
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
            <div className="text-sm font-medium text-neutral-900">性能状态摘要</div>
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
