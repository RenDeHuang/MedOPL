import { Outlet, Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  ListChecks,
  Receipt,
  Play,
  HelpCircle
} from "lucide-react";
import { cn } from "./ui/utils";
import { UserMenu } from "./UserMenu";
import { AnnouncementButton } from "./AnnouncementButton";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

// 普通用户导航
const navigation = [
  { name: "总览", path: "/overview", icon: LayoutDashboard },
  { name: "运行环境", path: "/resources", icon: Server },
  { name: "工作空间", path: "/workspace", icon: FolderOpen },
  { name: "任务与结果", path: "/trace", icon: ListChecks },
  { name: "账单与审计", path: "/billing", icon: Receipt },
  { name: "进入 OPL", path: "/opl-launch", icon: Play },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-200 bg-white flex flex-col">
        {/* Logo */}
        <div className="h-14 border-b border-neutral-200 flex items-center px-4">
          <h1 className="font-semibold text-neutral-900">MedOPL Portal</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-200">
          <div className="px-3 py-2 text-xs text-neutral-500">
            工作台版本 v1.2.0
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              {getPageTitle(location.pathname)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">帮助</span>
            </Button>
            <AnnouncementButton />
            <Separator orientation="vertical" className="h-6 mx-2" />
            <UserMenu />
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
    "/resources": "运行环境",
    "/workspace": "工作空间",
    "/trace": "任务与结果",
    "/billing": "账单与审计",
    "/opl-launch": "进入 OPL",
  };
  return routes[pathname] || "MedOPL Portal";
}
