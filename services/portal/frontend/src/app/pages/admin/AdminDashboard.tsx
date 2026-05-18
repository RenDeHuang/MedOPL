import { Users, FolderOpen, ListChecks, AlertCircle, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Link } from "react-router";
import { loadAdminDashboardModel, usePortalQuery } from "../../data/portalAdapters";

export function AdminDashboard() {
  const query = usePortalQuery(loadAdminDashboardModel, []);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">紧急</Badge>;
      case "warning":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">警告</Badge>;
      default:
        return <Badge variant="outline">提示</Badge>;
    }
  };

  if (query.status === "loading") {
    return <div className="p-6"><Card className="p-6 text-sm text-neutral-600">正在读取管理总览...</Card></div>;
  }

  if (query.status === "error") {
    return <div className="p-6"><Card className="p-6 border-red-200 bg-red-50 text-sm text-red-700">{query.error}</Card></div>;
  }

  const { stats, pendingItems } = query.data;

  return (
    <div className="p-6 space-y-6">
      {/* 平台运营摘要 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Users className="w-4 h-4" />
              今日活跃用户
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">{stats.activeUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              当前工作空间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">{stats.totalWorkspaces}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              当前运行任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">{stats.runningTasks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              今日消费总额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-neutral-900">¥{stats.todayRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              冻结金额
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-orange-600">¥{stats.frozenAmount.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              待处理事项
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">{stats.pendingItems}</div>
          </CardContent>
        </Card>
      </div>

      {/* 待处理事项摘要 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>待处理事项</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/alerts">查看全部</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingItems.length === 0 && (
              <div className="p-3 rounded-md border border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
                当前没有待处理事项
              </div>
            )}
            {pendingItems.map((item) => (
              <div key={item.rowKey} className="flex items-start justify-between p-3 rounded-md border border-neutral-200 bg-neutral-50">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(item.severity)}
                    <span className="text-sm font-medium text-neutral-900">{item.message}</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {item.user && `用户: ${item.user}`}
                    {item.user && item.workspace && " • "}
                    {item.workspace && `工作空间: ${item.workspace}`}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/alerts">处理</Link>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 快速入口 */}
      <Card>
        <CardHeader>
          <CardTitle>快速入口</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/admin/users">
                <Users className="w-4 h-4" />
                用户管理
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/admin/billing-ops">
                <DollarSign className="w-4 h-4" />
                账单处理
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/admin/audit">
                <Activity className="w-4 h-4" />
                审计记录
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link to="/admin/alerts">
                <AlertCircle className="w-4 h-4" />
                公告管理
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
