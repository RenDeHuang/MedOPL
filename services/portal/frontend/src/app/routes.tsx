import { Navigate, createBrowserRouter } from "react-router";
import { journeysForRoute } from "./registry/portalJourneyRegistry";

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
const packagesPurchaseRoute = pageRoute("./pages/PackagesPurchase.tsx", "PackagesPurchase");
const runtimeEnvironmentRoute = pageRoute("./pages/RuntimeEnvironment.tsx", "RuntimeEnvironment");
const workspaceRoute = pageRoute("./pages/Workspace.tsx", "Workspace");
const billingAuditRoute = pageRoute("./pages/BillingAudit.tsx", "BillingAudit");
const oplEntryRoute = pageRoute("./pages/OPLEntry.tsx", "OPLEntry");
const authEntryRoute = pageRoute("./pages/AuthEntry.tsx", "AuthEntry");
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
    path: "/login",
    lazy: authEntryRoute,
    hydrateFallbackElement: <div className="min-h-screen bg-slate-50" />,
  },
  {
    path: "/",
    lazy: layoutRoute,
    hydrateFallbackElement: <div className="min-h-screen bg-white" />,
    children: [
      // Redirect root to overview
      { index: true, element: <Navigate to="/overview" replace /> },

      // 普通用户路由
      { path: "overview", lazy: overviewRoute },
      { path: "packages", lazy: packagesPurchaseRoute, handle: { journeys: journeysForRoute("/packages") } },
      { path: "compute", lazy: runtimeEnvironmentRoute, handle: { journeys: journeysForRoute("/compute") } },
      { path: "storage", lazy: workspaceRoute, handle: { journeys: journeysForRoute("/storage") } },
      { path: "usage", lazy: billingAuditRoute, handle: { journeys: journeysForRoute("/usage") } },
      { path: "opl", lazy: oplEntryRoute, handle: { journeys: journeysForRoute("/opl") } },

      // 管理台路由
      { path: "admin/dashboard", lazy: adminDashboardRoute },
      { path: "admin/users", lazy: adminUsersRoute, handle: { journeys: journeysForRoute("/admin/users") } },
      { path: "admin/alerts", lazy: adminAlertsRoute },
      { path: "admin/billing-ops", lazy: adminBillingOpsRoute },
      { path: "admin/audit", lazy: adminAuditRoute },
      { path: "admin/system", lazy: adminSystemRoute },
      { path: "admin/ops", lazy: adminOpsRoute },
    ],
  },
]);
