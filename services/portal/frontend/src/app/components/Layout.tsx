import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  ShoppingCart,
  Receipt,
  Play,
  HelpCircle,
  Users,
  Bell as BellIcon,
  DollarSign,
  FileText,
  Settings,
  Activity,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { Button, Separator, cn } from "./ui/core";
import { UserMenu } from "./UserMenu";
import { AnnouncementButton } from "./AnnouncementButton";
import { useRole } from "../contexts/RoleContext";
import {
  useAnnouncementModel,
  useCurrentUserModel,
} from "../data/portalLayoutModel";

// 普通用户导航
const userNavigation = [
  { name: "资源总览", path: "/overview", icon: LayoutDashboard },
  { name: "套餐与购买", path: "/packages", icon: ShoppingCart },
  { name: "计算资源", path: "/compute", icon: Server },
  { name: "存储空间", path: "/storage", icon: FolderOpen },
  { name: "费用与用量", path: "/usage", icon: Receipt },
  { name: "进入 OPL", path: "/opl", icon: Play },
];

// 管理台导航
const adminNavigation = [
  { name: "管理总览", path: "/admin/dashboard", icon: LayoutDashboard },
  { name: "用户管理", path: "/admin/users", icon: Users },
  { name: "公告与待处理事项", path: "/admin/alerts", icon: BellIcon },
  { name: "账单处理", path: "/admin/billing-ops", icon: DollarSign },
  { name: "审计记录", path: "/admin/audit", icon: FileText },
  { name: "站点设置", path: "/admin/system", icon: Settings },
  { name: "服务状态", path: "/admin/ops", icon: Activity },
];

export function Layout() {
  const location = useLocation();
  const [adminExpanded, setAdminExpanded] = useState(true);
  const { role: userRole } = useRole();
  const currentUser = useCurrentUserModel();
  const announcements = useAnnouncementModel();
  const isAdmin = userRole === "admin";

  return (
    <div data-ui-template="commercial-launch-shell" className="flex h-screen flex-col md:flex-row bg-slate-50">
      {/* Sidebar */}
      <aside className="w-full md:w-56 border-b border-slate-200 bg-white md:flex-none md:border-b-0 md:border-r">
        {/* Logo */}
        <div className="flex h-14 items-center border-b border-slate-200 px-4">
          <Link
            to="/overview"
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-slate-900 transition-[color,background-color,box-shadow] hover:text-primary active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <Zap className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-none">MedOPL</span>
              <span className="mt-0.5 block text-[10px] font-medium leading-none text-slate-500">资源控制面板</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-none space-y-3 overflow-y-auto p-3 md:flex-1 md:space-y-1">
          <nav aria-label="主要资源导航" data-ui-pattern="mobile-nav-scroll-hint" className="relative -mx-1 px-1 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-6 after:bg-gradient-to-l after:from-white after:to-transparent md:after:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 pr-6 md:block md:space-y-0.5 md:overflow-visible md:pb-0 md:pr-0">
            {userNavigation.map((item) => {
              const isActive = location.pathname === item.path;
              const isOpl = item.path === "/opl";
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-[color,background-color,box-shadow,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0 md:shrink",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : isOpl
                        ? "font-medium text-teal-700 hover:bg-teal-50"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                  {isOpl && !isActive && <ArrowUpRight className="ml-auto hidden h-3 w-3 opacity-70 md:block" />}
                </Link>
              );
            })}
            </div>
          </nav>

          {/* RoleContext 不是安全边界；真实 admin 权限由 Go /api/admin/* 后端校验。 */}
          {isAdmin && (
            <>
              <Separator className="my-3 bg-slate-200" />
              <section className="space-y-1">
                <button
                  onClick={() => setAdminExpanded(!adminExpanded)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition-[color,background-color,box-shadow,transform] hover:bg-slate-100 hover:text-slate-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0"
                >
                  <span>管理台</span>
                  {adminExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
                {adminExpanded && (
                  <nav aria-label="管理台导航" data-ui-pattern="mobile-nav-scroll-hint" className="relative -mx-1 px-1 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-6 after:bg-gradient-to-l after:from-white after:to-transparent md:after:hidden">
                    <div className="flex gap-2 overflow-x-auto pb-1 pr-6 md:block md:space-y-0.5 md:overflow-visible md:pb-0 md:pr-0">
                    {adminNavigation.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-[color,background-color,box-shadow,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0 md:shrink",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <item.icon className="w-4 h-4" />
                          {item.name}
                        </Link>
                      );
                    })}
                    </div>
                  </nav>
                )}
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="hidden border-t border-slate-200 p-3 md:block">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            商业资源控制面
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-sm sm:px-6">
          <div className="min-w-0 flex items-center gap-4">
            <h1 className="truncate text-base font-semibold text-slate-900">
              {getPageTitle(location.pathname)}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" className="gap-2" disabled title="帮助中心暂未接入">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">帮助</span>
            </Button>
            <AnnouncementButton announcements={announcements.status === "ready" ? announcements.data.announcements : []} />
            <Separator orientation="vertical" className="h-6 mx-1 sm:mx-2" />
            <UserMenu {...(currentUser.status === "ready" ? currentUser.data : {})} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Helper function to get page title
function getPageTitle(pathname: string): string {
  const routes: Record<string, string> = {
    "/overview": "总览",
    "/compute": "计算资源",
    "/storage": "存储空间",
    "/usage": "费用与用量",
    "/packages": "套餐与购买",
    "/opl": "进入 OPL",
    "/admin/dashboard": "管理总览",
    "/admin/users": "用户管理",
    "/admin/alerts": "公告与待处理事项",
    "/admin/billing-ops": "账单处理",
    "/admin/audit": "审计记录",
    "/admin/system": "站点设置",
    "/admin/ops": "服务状态",
  };
  return routes[pathname] || "MedOPL Portal";
}
