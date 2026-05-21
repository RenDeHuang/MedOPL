import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertNotIncludes(source, expected, label) {
  assert.equal(source.includes(expected), false, `${label}_must_not_include:${expected}`);
}

const backendSource = await readFile("services/portal/src/app/portal-admin-api-payloads.mjs", "utf8");
const adapterSource = await readFile("services/portal/frontend/src/app/data/portalAdapters.ts", "utf8");
const opsSurfaceSource = await readFile("services/portal/frontend/src/app/data/portalAdminOpsSurface.ts", "utf8");
const adminOpsSource = await readFile("services/portal/frontend/src/app/pages/admin/AdminOps.tsx", "utf8");

for (const expected of [
  "boundaries",
  "accountOperations",
  "workspaceOperations",
  "currentRuns",
  "fileSpaceOperations",
  "costReconciliation",
  "auditAndAnnouncements",
]) {
  assertIncludes(backendSource, expected, "admin_ops_backend_projection");
}

for (const expected of [
  "ops.accountOperations?.accounts",
  "ops.workspaceOperations?.workspaces",
  "ops.currentRuns?.items",
  "ops.fileSpaceOperations?.items",
  "ops.costReconciliation?.costAllocationTags",
  "ops.auditAndAnnouncements?.exceptions",
  "localOperationRows",
  "opsExceptionRows",
  "futureAuthorizedActions",
]) {
  assertIncludes(opsSurfaceSource, expected, "admin_ops_adapter_must_keep_local_projection");
}

assertIncludes(adapterSource, 'from "./portalAdminOpsSurface"', "portal_adapters_must_delegate_admin_ops_surface");

for (const expected of [
  "本地运维投影",
  "审计支撑的运营异常",
  "Future-authorized 操作边界",
  "真实云资源操作未授权",
  "真实扣费未授权",
  "真实资源释放未授权",
]) {
  assertIncludes(adminOpsSource, expected, "admin_ops_page_must_render_projection_boundary");
}

for (const forbidden of [
  "kubectl",
  "kubeconfig",
  "SecretId",
  "SecretKey",
  "真实云执行",
  "立即释放云资源",
]) {
  assertNotIncludes(adapterSource, forbidden, "admin_ops_adapter_must_not_expose_cloud_action");
  assertNotIncludes(opsSurfaceSource, forbidden, "admin_ops_surface_must_not_expose_cloud_action");
  assertNotIncludes(adminOpsSource, forbidden, "admin_ops_page_must_not_expose_cloud_action");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_admin_ops_local_projection_view",
  checked: [
    "backend_ops_projection_exists",
    "frontend_adapter_keeps_local_projection",
    "admin_ops_page_renders_audit_exception_and_future_authorized_boundaries",
  ],
}, null, 2));
