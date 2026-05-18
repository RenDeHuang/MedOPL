import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Input } from "../components/ui/input";
import {
  Settings,
  Users,
  Server,
  Shield,
  Search,
  MoreVertical,
  TrendingUp,
  Database,
  Activity,
  AlertCircle,
} from "lucide-react";

export function AdminConsole() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header - 主结论和主 CTA */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h1 className="text-2xl font-semibold text-neutral-900">
                管理员控制台
              </h1>
            </div>
            <p className="text-neutral-600 text-sm max-w-2xl">
              管理所有用户、服务实例、资源配额和系统配置。当前平台运行正常，共有 156 个活跃用户。
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" />
            系统配置
          </Button>
        </div>
      </div>

      {/* Platform Overview Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">活跃用户</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">156</div>
          <div className="text-xs text-neutral-500 mt-1">较上月 +12%</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">运行实例</span>
            <Server className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">89</div>
          <div className="text-xs text-neutral-500 mt-1">峰值 124</div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">资源使用率</span>
            <Activity className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">68%</div>
          <div className="text-xs text-neutral-500 mt-1">
            <Progress value={68} className="h-1 mt-2" />
          </div>
        </Card>

        <Card className="p-4 border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">本月收入</span>
            <TrendingUp className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-semibold text-neutral-900">¥ 45.2K</div>
          <div className="text-xs text-neutral-500 mt-1">预计 ¥52K</div>
        </Card>
      </div>

      {/* User Management Section */}
      <Card className="border border-neutral-200 mb-6">
        <div className="p-5 border-b border-neutral-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">用户管理</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="搜索用户或邮箱..."
                  className="pl-9 w-64 h-9"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  用户
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  服务状态
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  套餐
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  资源使用
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  账户余额
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  注册时间
                </th>
                <th className="text-right py-3 px-5 text-xs font-medium text-neutral-600">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {[
                {
                  name: "张医生",
                  email: "zhang@hospital.edu.cn",
                  status: "running",
                  plan: "标准版",
                  cpu: "8核16G",
                  usage: 72,
                  balance: "¥ 1,234.50",
                  registered: "2024-03-15",
                },
                {
                  name: "李教授",
                  email: "li@university.edu.cn",
                  status: "running",
                  plan: "专业版",
                  cpu: "16核32G",
                  usage: 45,
                  balance: "¥ 856.20",
                  registered: "2024-02-08",
                },
                {
                  name: "王研究员",
                  email: "wang@institute.cn",
                  status: "stopped",
                  plan: "标准版",
                  cpu: "8核16G",
                  usage: 0,
                  balance: "¥ 2,100.00",
                  registered: "2024-04-22",
                },
                {
                  name: "赵博士",
                  email: "zhao@lab.edu.cn",
                  status: "running",
                  plan: "标准版",
                  cpu: "8核16G",
                  usage: 88,
                  balance: "¥ 156.80",
                  balanceWarning: true,
                  registered: "2024-01-30",
                },
              ].map((user, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="py-3 px-5">
                    <div>
                      <div className="text-sm font-medium text-neutral-900">
                        {user.name}
                      </div>
                      <div className="text-xs text-neutral-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <Badge
                      variant="outline"
                      className={
                        user.status === "running"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-neutral-100 text-neutral-600 border-neutral-200"
                      }
                    >
                      {user.status === "running" ? "运行中" : "已停止"}
                    </Badge>
                  </td>
                  <td className="py-3 px-5">
                    <div className="text-sm text-neutral-900">{user.plan}</div>
                    <div className="text-xs text-neutral-500">{user.cpu}</div>
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2">
                      <Progress value={user.usage} className="h-1.5 w-20" />
                      <span className="text-xs text-neutral-600">{user.usage}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          user.balanceWarning
                            ? "text-orange-600 font-semibold"
                            : "text-neutral-900"
                        }`}
                      >
                        {user.balance}
                      </span>
                      {user.balanceWarning && (
                        <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-sm text-neutral-600">
                      {user.registered}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button className="text-neutral-400 hover:text-neutral-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-neutral-200 flex items-center justify-between text-sm">
          <span className="text-neutral-600">显示 1-4 / 共 156 个用户</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              上一页
            </Button>
            <Button variant="outline" size="sm">
              下一页
            </Button>
          </div>
        </div>
      </Card>

      {/* Two Column Layout - Resource Pool & System Health */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Resource Pool */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">资源池概览</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600">CPU 核心</span>
                <span className="text-sm font-semibold text-neutral-900">
                  712 / 1024
                </span>
              </div>
              <Progress value={69.5} className="h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600">内存</span>
                <span className="text-sm font-semibold text-neutral-900">
                  1.4 TB / 2 TB
                </span>
              </div>
              <Progress value={70} className="h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-neutral-600">存储空间</span>
                <span className="text-sm font-semibold text-neutral-900">
                  8.2 TB / 20 TB
                </span>
              </div>
              <Progress value={41} className="h-1.5" />
            </div>
            <div className="pt-3 border-t border-neutral-200">
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <Database className="w-3.5 h-3.5" />
                <span>预计可支持 68 个新实例</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Global Audit Log */}
        <Card className="border border-neutral-200">
          <div className="p-5 border-b border-neutral-200">
            <h2 className="font-semibold text-neutral-900">全局审计日志</h2>
          </div>
          <div className="p-5 space-y-3">
            {[
              {
                action: "用户 zhang@hospital.edu.cn 启动服务实例",
                time: "2 分钟前",
                type: "info",
              },
              {
                action: "用户 zhao@lab.edu.cn 余额不足预警",
                time: "15 分钟前",
                type: "warning",
              },
              {
                action: "管理员修改了标准版套餐配额",
                time: "1 小时前",
                type: "admin",
              },
              {
                action: "用户 wang@institute.cn 释放了计算资源",
                time: "2 小时前",
                type: "info",
              },
              {
                action: "系统完成定时备份任务",
                time: "3 小时前",
                type: "system",
              },
            ].map((log, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                    log.type === "warning"
                      ? "bg-orange-500"
                      : log.type === "admin"
                      ? "bg-blue-500"
                      : "bg-neutral-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-neutral-900">{log.action}</div>
                  <div className="text-xs text-neutral-500">{log.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* System Configuration */}
      <Card className="border border-neutral-200">
        <div className="p-5 border-b border-neutral-200">
          <h2 className="font-semibold text-neutral-900">套餐配置</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  套餐名称
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  CPU/内存
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  存储空间
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  价格
                </th>
                <th className="text-left py-3 px-5 text-xs font-medium text-neutral-600">
                  使用用户数
                </th>
                <th className="text-right py-3 px-5 text-xs font-medium text-neutral-600">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {[
                {
                  name: "标准版",
                  cpu: "8核 16GB",
                  storage: "100 GB",
                  price: "¥ 12.00/小时",
                  users: 98,
                },
                {
                  name: "专业版",
                  cpu: "16核 32GB",
                  storage: "200 GB",
                  price: "¥ 18.00/小时",
                  users: 42,
                },
                {
                  name: "旗舰版",
                  cpu: "32核 64GB",
                  storage: "500 GB",
                  price: "¥ 28.00/小时",
                  users: 16,
                },
              ].map((plan, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="py-3 px-5">
                    <span className="text-sm font-medium text-neutral-900">
                      {plan.name}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-sm text-neutral-900">{plan.cpu}</span>
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-sm text-neutral-900">{plan.storage}</span>
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-sm font-semibold text-neutral-900">
                      {plan.price}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className="text-sm text-neutral-600">{plan.users} 人</span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <Button variant="outline" size="sm">
                      编辑配置
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
