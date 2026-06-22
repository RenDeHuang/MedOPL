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
  ChevronUp
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
  { name: "计算资源", path: "/resources", icon: Server },
  { name: "存储空间", path: "/workspace", icon: FolderOpen },
  { name: "费用与用量", path: "/billing", icon: Receipt },
  { name: "进入 OPL", path: "/opl-launch", icon: Play },
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
    <div className="flex h-screen flex-col md:flex-row bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-200 bg-white flex flex-col md:flex-none">
        {/* Logo */}
        <div className="h-14 border-b border-neutral-200 flex items-center px-3">
          <Link
            to="/overview"
            className="inline-flex min-h-11 min-w-11 cursor-pointer items-center rounded-md px-2 font-semibold text-neutral-900 transition-[color,background-color,box-shadow] hover:bg-neutral-100 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0"
          >
            MedOPL Portal
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex-none md:flex-1 p-3 space-y-3 md:space-y-1 overflow-y-auto">
          <nav aria-label="主要资源导航" data-ui-pattern="mobile-nav-scroll-hint" className="relative -mx-1 px-1 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-6 after:bg-gradient-to-l after:from-white after:to-transparent md:after:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 pr-6 md:block md:space-y-1 md:overflow-visible md:pb-0 md:pr-0">
            {userNavigation.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-[color,background-color,box-shadow,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0 md:shrink",
                    isActive
                      ? "bg-primary text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
            </div>
          </nav>

          {/* RoleContext 不是安全边界；真实 admin 权限由 Go /api/admin/* 后端校验。 */}
          {isAdmin && (
            <>
              <Separator className="my-3" />
              <section className="space-y-1">
                <button
                  onClick={() => setAdminExpanded(!adminExpanded)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-xs font-semibold text-neutral-500 transition-[color,background-color,box-shadow,transform] hover:bg-neutral-100 hover:text-neutral-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0"
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
                    <div className="flex gap-2 overflow-x-auto pb-1 pr-6 md:block md:space-y-1 md:overflow-visible md:pb-0 md:pr-0">
                    {adminNavigation.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-[color,background-color,box-shadow,transform] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:active:translate-y-0 md:shrink",
                            isActive
                              ? "bg-primary text-white"
                              : "text-neutral-700 hover:bg-neutral-100"
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
        <div className="hidden md:block p-3 border-t border-neutral-200">
          <div className="px-3 py-2 text-xs text-neutral-500">
            Portal UI
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between gap-3 px-3 sm:px-6">
          <div className="min-w-0 flex items-center gap-4">
            <h1 className="truncate text-lg font-semibold text-neutral-900">
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
    "/resources": "计算资源",
    "/workspace": "存储空间",
    "/billing": "费用与用量",
    "/packages": "套餐与购买",
    "/opl-launch": "进入 OPL",
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
