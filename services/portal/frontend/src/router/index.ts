import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { fetchCurrentUser, type CurrentUserPayload } from "@/api/portal/commercial";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/overview" },
  { path: "/home", redirect: "/overview" },
  { path: "/login", redirect: "/overview" },
  { path: "/register", redirect: "/overview" },
  { path: "/portal", redirect: "/overview" },
  { path: "/overview", component: () => import("@/views/overview/OverviewView.vue") },
  { path: "/packages", component: () => import("@/views/packages/PackagesView.vue") },
  { path: "/resources", component: () => import("@/views/resources/ResourcesView.vue") },
  { path: "/workspace", component: () => import("@/views/workspace/WorkspaceView.vue") },
  { path: "/opl-launch", component: () => import("@/views/opl/OplLaunchView.vue") },
  { path: "/advanced/servers", component: () => import("@/views/servers/ServersView.vue"), meta: { requiresAdmin: true } },
  { path: "/billing", component: () => import("@/views/billing/BillingView.vue") },
  { path: "/trace", component: () => import("@/views/trace/TraceView.vue") },
  { path: "/admin/dashboard", component: () => import("@/views/admin/AdminDashboardView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/users", component: () => import("@/views/admin/AdminUsersView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/trace", component: () => import("@/views/admin/AdminTraceView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/user", component: () => import("@/views/admin/AdminUserPortraitView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/groups", component: () => import("@/views/admin/AdminGroupsView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/workspace", component: () => import("@/views/admin/AdminWorkspacePortraitView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/run", component: () => import("@/views/admin/AdminRunPortraitView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/billing-ops", component: () => import("@/views/admin/AdminBillingOpsView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/alerts", component: () => import("@/views/admin/AdminAlertsView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/usage", component: () => import("@/views/admin/AdminUsageView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/system", component: () => import("@/views/admin/AdminSystemView.vue"), meta: { requiresAdmin: true } },
  { path: "/admin/ops", component: () => import("@/views/admin/AdminOpsView.vue"), meta: { requiresAdmin: true, requiresOpsSurface: true } },
  { path: "/admin/sandboxes", component: () => import("@/views/admin/AdminSandboxesView.vue"), meta: { requiresAdmin: true, requiresOpsSurface: true } },
  { path: "/admin/audit", component: () => import("@/views/admin/AdminAuditView.vue"), meta: { requiresAdmin: true } }
];

let currentUserPromise: Promise<CurrentUserPayload | null> | null = null;

async function loadCurrentUser() {
  if (!currentUserPromise) {
    currentUserPromise = fetchCurrentUser().catch(() => null);
  }
  return currentUserPromise;
}

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to) => {
  if (!to.matched.some((record) => record.meta.requiresAdmin)) {
    return true;
  }
  const user = await loadCurrentUser();
  if (user?.role === "admin") {
    if (to.matched.some((record) => record.meta.requiresOpsSurface) && !user.productProfile?.opsSurfaceEnabled) {
      return "/admin/system";
    }
    return true;
  }
  return "/overview";
});

export default router;
