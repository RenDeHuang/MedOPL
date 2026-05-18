import { createBrowserRouter, redirect } from "react-router";
import { Layout } from "./components/Layout";
import { Overview } from "./pages/Overview";
import { RuntimeEnvironment } from "./pages/RuntimeEnvironment";
import { Workspace } from "./pages/Workspace";
import { TasksResults } from "./pages/TasksResults";
import { BillingAudit } from "./pages/BillingAudit";
import { OPLEntry } from "./pages/OPLEntry";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminAlerts } from "./pages/admin/AdminAlerts";
import { AdminBillingOps } from "./pages/admin/AdminBillingOps";
import { AdminAudit } from "./pages/admin/AdminAudit";
import { AdminSystem } from "./pages/admin/AdminSystem";
import { AdminOps } from "./pages/admin/AdminOps";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      // Redirect root to overview
      { index: true, loader: () => redirect("/overview") },

      // 普通用户路由
      { path: "overview", Component: Overview },
      { path: "resources", Component: RuntimeEnvironment },
      { path: "workspace", Component: Workspace },
      { path: "trace", Component: TasksResults },
      { path: "billing", Component: BillingAudit },
      { path: "opl-launch", Component: OPLEntry },

      // 管理台路由
      { path: "admin/dashboard", Component: AdminDashboard },
      { path: "admin/users", Component: AdminUsers },
      { path: "admin/alerts", Component: AdminAlerts },
      { path: "admin/billing-ops", Component: AdminBillingOps },
      { path: "admin/audit", Component: AdminAudit },
      { path: "admin/system", Component: AdminSystem },
      { path: "admin/ops", Component: AdminOps },
    ],
  },
]);
