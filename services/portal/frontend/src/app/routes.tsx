import { Navigate, createBrowserRouter } from "react-router";

type PageModule = Record<string, React.ComponentType>;

const pageModules = import.meta.glob<PageModule>("./pages/**/*.tsx");
const shellModules = import.meta.glob<PageModule>("./components/Layout.tsx");

function pageRoute(modulePath: string, exportName: string) {
  return async () => {
    const loadModule = pageModules[modulePath];
    if (!loadModule) throw new Error(`portal_route_module_missing:${modulePath}`);
    const module = await loadModule();
    const Component = module[exportName];
    if (!Component) throw new Error(`portal_route_component_missing:${exportName}`);
    return { Component };
  };
}

const overviewRoute = pageRoute("./pages/Overview.tsx", "Overview");
const runtimeEnvironmentRoute = pageRoute("./pages/RuntimeEnvironment.tsx", "RuntimeEnvironment");
const workspaceRoute = pageRoute("./pages/Workspace.tsx", "Workspace");
const tasksResultsRoute = pageRoute("./pages/TasksResults.tsx", "TasksResults");
const billingAuditRoute = pageRoute("./pages/BillingAudit.tsx", "BillingAudit");
const oplEntryRoute = pageRoute("./pages/OPLEntry.tsx", "OPLEntry");
const adminDashboardRoute = pageRoute("./pages/admin/AdminDashboard.tsx", "AdminDashboard");
const adminUsersRoute = pageRoute("./pages/admin/AdminUsers.tsx", "AdminUsers");
const adminAlertsRoute = pageRoute("./pages/admin/AdminAlerts.tsx", "AdminAlerts");
const adminBillingOpsRoute = pageRoute("./pages/admin/AdminBillingOps.tsx", "AdminBillingOps");
const adminAuditRoute = pageRoute("./pages/admin/AdminAudit.tsx", "AdminAudit");
const adminSystemRoute = pageRoute("./pages/admin/AdminSystem.tsx", "AdminSystem");
const adminOpsRoute = pageRoute("./pages/admin/AdminOps.tsx", "AdminOps");

const layoutRoute = async () => {
  const loadModule = shellModules["./components/Layout.tsx"];
  if (!loadModule) throw new Error("portal_route_module_missing:layout");
  const module = await loadModule();
  const Component = module.Layout;
  if (!Component) throw new Error("portal_route_component_missing:Layout");
  return { Component };
};

export const router = createBrowserRouter([
  {
    path: "/",
    lazy: layoutRoute,
    hydrateFallbackElement: <div className="min-h-screen bg-white" />,
    children: [
      // Redirect root to overview
      { index: true, element: <Navigate to="/overview" replace /> },

      // 普通用户路由
      { path: "overview", lazy: overviewRoute },
      { path: "resources", lazy: runtimeEnvironmentRoute },
      { path: "workspace", lazy: workspaceRoute },
      { path: "trace", lazy: tasksResultsRoute },
      { path: "billing", lazy: billingAuditRoute },
      { path: "opl-launch", lazy: oplEntryRoute },
      { path: "portal/opl", element: <Navigate to="/opl-launch" replace /> },

      // 管理台路由
      { path: "admin/dashboard", lazy: adminDashboardRoute },
      { path: "admin/users", lazy: adminUsersRoute },
      { path: "admin/alerts", lazy: adminAlertsRoute },
      { path: "admin/billing-ops", lazy: adminBillingOpsRoute },
      { path: "admin/audit", lazy: adminAuditRoute },
      { path: "admin/system", lazy: adminSystemRoute },
      { path: "admin/ops", lazy: adminOpsRoute },
    ],
  },
]);
