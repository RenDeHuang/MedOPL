import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/", redirect: "/overview" },
  { path: "/overview", component: () => import("@/views/overview/OverviewView.vue") },
  { path: "/workspace", component: () => import("@/views/workspace/WorkspaceView.vue") },
  { path: "/billing", component: () => import("@/views/billing/BillingView.vue") },
  { path: "/trace", component: () => import("@/views/trace/TraceView.vue") },
  { path: "/admin/dashboard", component: () => import("@/views/admin/AdminDashboardView.vue") },
  { path: "/admin/users", component: () => import("@/views/admin/AdminUsersView.vue") },
  { path: "/admin/trace", component: () => import("@/views/admin/AdminTraceView.vue") },
  { path: "/admin/user", component: () => import("@/views/admin/AdminUserPortraitView.vue") },
  { path: "/admin/groups", component: () => import("@/views/admin/AdminGroupsView.vue") },
  { path: "/admin/workspace", component: () => import("@/views/admin/AdminWorkspacePortraitView.vue") },
  { path: "/admin/run", component: () => import("@/views/admin/AdminRunPortraitView.vue") },
  { path: "/admin/billing-ops", component: () => import("@/views/admin/AdminBillingOpsView.vue") },
  { path: "/admin/alerts", component: () => import("@/views/admin/AdminAlertsView.vue") },
  { path: "/admin/usage", component: () => import("@/views/admin/AdminUsageView.vue") },
  { path: "/admin/system", component: () => import("@/views/admin/AdminSystemView.vue") },
  { path: "/admin/ops", component: () => import("@/views/admin/AdminOpsView.vue") },
  { path: "/admin/sandboxes", component: () => import("@/views/admin/AdminSandboxesView.vue") },
  { path: "/admin/audit", component: () => import("@/views/admin/AdminAuditView.vue") }
];

export default createRouter({
  history: createWebHistory("/portal/app/"),
  routes
});
