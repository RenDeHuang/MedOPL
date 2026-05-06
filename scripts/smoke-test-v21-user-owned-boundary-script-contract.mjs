import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(os.tmpdir(), `v21-user-owned-boundaries-${process.pid}`);
const sentruxRulesPath = path.join(repoRoot, ".sentrux", "rules.toml");

function layerSection(rulesSource) {
  const boundaryStart = rulesSource.indexOf("[[boundaries]]");
  return boundaryStart >= 0 ? rulesSource.slice(0, boundaryStart) : rulesSource;
}

function expectBoundary(rulesSource, from, to) {
  assert.match(
    rulesSource,
    new RegExp(`from = "${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[\\s\\S]*?to = "${to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
    `missing_sentux_boundary:${from}->${to}`,
  );
}

async function put(relativePath, content) {
  const target = path.join(fixtureRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

function expectViolation(payload, file, token) {
  assert(
    payload.violations.some((item) =>
      item.rule === "retired_stack_token_detected"
      && item.file === file
      && item.token === token),
    `missing_retired_stack_violation:${file}:${token}`,
  );
}

const rulesSource = await readFile(sentruxRulesPath, "utf8");
const layersSource = layerSection(rulesSource);

assert.doesNotMatch(
  layersSource,
  /"adapters\/resource-provisioner\/src\/.*"/,
  "resource_provisioner_must_not_live_in_v21_active_layers",
);
assert.doesNotMatch(
  layersSource,
  /"adapters\/med-autoscience-runner\/src\/\*"/,
  "med_runner_must_not_live_in_v21_active_layers",
);

for (const from of [
  "services/portal/src/*",
  "services/portal/frontend/src/*",
  "services/opl-runtime-bridge/src/*",
  "services/opl-web-gateway/src/*",
  "adapters/billing-aggregator/src/*",
]) {
  expectBoundary(rulesSource, from, "adapters/resource-provisioner/src/*");
  expectBoundary(rulesSource, from, "adapters/med-autoscience-runner/src/*");
}

await rm(fixtureRoot, { recursive: true, force: true });

await put("services/opl-runtime-bridge/src/runtime-bridge-runs.mjs", `
export async function submitRuntimeRun() {
  await fetch("/portal/internal/resource-orders/prepare-run");
  return provision({});
}
`);
await put("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", `
export function buildStatusPayload() {
  return {
    runtime: {
      runnerUrl: "https://runner.example",
      namespace: k8sNamespace,
      runnerImage: "runner:test",
    },
  };
}
`);
await put("services/portal/src/routes/portal-api-costs.routes.mjs", `
export function adapterRunCostPayload({ adapterCost, runId }) {
  return {
    note: adapterCost.status === "pending" ? "run 成本已记录为 pending，等待 OpenCost/云账单对账" : "run 成本来自 Portal OPL adapter",
    runId,
  };
}
`);
await put("services/portal/src/app/portal-page-payload-helpers.mjs", `
export function buildBillingRunCosts({ filteredRuns = [], filteredItems = [] }) {
  return filteredRuns.map((run) => {
    const related = filteredItems.find((item) => item?.name?.includes(run.runId));
    const pricingSource = related ? "OpenCost aggregated" : "metering pending";
    return { pricingSource };
  });
}
`);
await put("services/portal/src/app/portal-admin-api-payloads.mjs", `
function defaultUrls(urls = {}) {
  return {
    minioConsoleUrl: urls.minioConsoleUrl || "",
  };
}
`);
await put("services/portal/src/app/portal-admin-overview-payloads.mjs", `
export function buildAdminSummaries({ minioSummary }) {
  return {
    storageStatus: minioSummary.available,
    storageSource: "user_owned_storage",
    pendingSource: "user_owned_local_metering",
    note: "MinIO sync pending，默认使用用户自有资源计量。",
  };
}
`);
await put("services/portal/src/app/portal-server-plan-runtime-handler.mjs", `
export function buildFreezePolicy() {
  return { pendingSource: "user_owned_local_metering" };
}
`);
await put("services/portal/src/app/portal-feature-runtime-handlers.mjs", `
export function createPortalFeatureRuntimeHandlers({ productRuntimeMode = "user_owned" }) {
  return productRuntimeMode;
}
`);
await put("services/portal/src/routes/resource-order.routes.mjs", `
export function retiredResourceOrders() {
  return { use: "/portal/api/user-owned-resources" };
}
`);
await put("services/portal/src/routes/resource-order-internal.routes.mjs", `
export function retiredInternalResourceOrders() {
  return { use: "/portal/api/user-owned-resources" };
}
`);
await put("services/portal/src/routes/resource-order-provisioning-service.mjs", `
export function retiredProvisioningResourceOrders() {
  return { use: "/portal/api/user-owned-resources" };
}
`);
await put("services/portal/src/routes/resource-order-public-delete.routes.mjs", `
export function retiredDeleteResourceOrders() {
  return { use: "/portal/api/user-owned-resources/unbind" };
}
`);
await put("services/portal/frontend/src/api/portal/resources.ts", `
export async function fetchMyResources() {
  return apiClient.get("/user-owned-resources");
}
`);
await put("services/portal/frontend/src/views/resources/ResourcesView.vue", `
<template>
  <div>开通运行节点，接入运行代理</div>
</template>
`);
await put("services/portal/src/app/portal-admin-overview-runtime-payloads.mjs", `
export function createPortalAdminOverviewPayloadBuilder({ fetchWorkspaceMinioState, fetchMinioSummary }) {
  return async function buildAdminOverviewPayload() {
    const minio = await fetchWorkspaceMinioState();
    return { fetchMinioSummary, minio, status: "user_owned_storage" };
  };
}
`);
await put("services/portal/src/integrations/opl-adapter-client.mjs", `
export function createOplAdapterClient({ adapterUrl, timeoutMs }) {
  async function fetchJson(pathname) {
    try {
      const response = await fetch(new URL(pathname, adapterUrl), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      return response.json();
    } catch {}
    return null;
  }

  return { fetchJson };
}
`);
await put("compose.product.yaml", `
services:
  portal:
    environment:
      PRODUCT_RUNTIME_MODE: user_owned
`);
await put("docs/plan/2026-05-05-OPL-v21-User-Owned-Runtime-Refactor-Checklist.md", `
# v21 checklist

本文中历史出现的 user-owned 下一轮代码迁移应改成 platform_provisioned。

- [x] 新增 \`PRODUCT_RUNTIME_MODE=user_owned\`。
- [ ] 将 \`PRODUCT_RUNTIME_MODE=user_owned\` 迁移为 \`platform_provisioned\`。
`);
await put("docs/superpowers/plans/2026-05-06-opl-v21-phase-0.5-and-phase-1.md", `
# v21 stale plan

**Goal:** Reconcile existing v21 work with the new v21 rule that \`user_owned\` is the only product runtime mode.

- \`PRODUCT_RUNTIME_MODE=user_owned\` is the only v21 product runtime mode.
- OPL Full Runtime requires WorkspaceResourceBinding, user CVM Runtime Agent, user storage, and weekly protection freeze.
`);
await put("docs/reports/2026-05-06-OPL-v21-Phase2-9-Local-Acceptance-Report.md", `
# v21 stale report

- 用户自有 CVM / 存储 / workspace binding 模型已落地。
- 真实用户 CVM 上 Runtime Agent 安装、注册、断连恢复和版本升级。
`);

const result = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "check-v21-user-owned-runtime-boundaries.mjs"),
], {
  cwd: fixtureRoot,
  encoding: "utf8",
});

assert.equal(result.status, 1, `expected boundary script to fail, got ${result.status}: ${result.stdout}`);
const payload = JSON.parse(result.stdout);

expectViolation(payload, "services/opl-runtime-bridge/src/runtime-bridge-runs.mjs", "/portal/internal/resource-orders/prepare-run");
expectViolation(payload, "services/opl-runtime-bridge/src/runtime-bridge-runs.mjs", "provision");
expectViolation(payload, "services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", "runnerUrl");
expectViolation(payload, "services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", "k8sNamespace");
expectViolation(payload, "services/opl-runtime-bridge/src/runtime-bridge-launch.mjs", "runnerImage");
expectViolation(payload, "services/portal/src/routes/portal-api-costs.routes.mjs", "OpenCost");
expectViolation(payload, "services/portal/src/app/portal-page-payload-helpers.mjs", "OpenCost aggregated");
expectViolation(payload, "services/portal/src/app/portal-admin-api-payloads.mjs", "minioConsoleUrl");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-payloads.mjs", "minioSummary");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-payloads.mjs", "用户自有资源");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-payloads.mjs", "user_owned_storage");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-payloads.mjs", "user_owned_local_metering");
expectViolation(payload, "services/portal/src/app/portal-server-plan-runtime-handler.mjs", "user_owned_local_metering");
expectViolation(payload, "services/portal/src/app/portal-feature-runtime-handlers.mjs", "productRuntimeMode user_owned default");
expectViolation(payload, "services/portal/src/routes/resource-order.routes.mjs", "primary user-owned resource pointer");
expectViolation(payload, "services/portal/src/routes/resource-order-internal.routes.mjs", "primary user-owned resource pointer");
expectViolation(payload, "services/portal/src/routes/resource-order-provisioning-service.mjs", "primary user-owned resource pointer");
expectViolation(payload, "services/portal/src/routes/resource-order-public-delete.routes.mjs", "primary user-owned resource pointer");
expectViolation(payload, "services/portal/frontend/src/api/portal/resources.ts", "frontend primary user-owned API path");
expectViolation(payload, "services/portal/frontend/src/views/resources/ResourcesView.vue", "运行节点");
expectViolation(payload, "services/portal/frontend/src/views/resources/ResourcesView.vue", "运行代理");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs", "fetchWorkspaceMinioState");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs", "fetchMinioSummary");
expectViolation(payload, "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs", "user_owned_storage");
expectViolation(payload, "services/portal/src/integrations/opl-adapter-client.mjs", "catch {}");
expectViolation(payload, "services/portal/src/integrations/opl-adapter-client.mjs", "fetchJson return null");
expectViolation(payload, "compose.product.yaml", "PRODUCT_RUNTIME_MODE=user_owned");
expectViolation(payload, "docs/plan/2026-05-05-OPL-v21-User-Owned-Runtime-Refactor-Checklist.md", "next migration to platform_provisioned");
expectViolation(payload, "docs/plan/2026-05-05-OPL-v21-User-Owned-Runtime-Refactor-Checklist.md", "new PRODUCT_RUNTIME_MODE=user_owned");
expectViolation(payload, "docs/plan/2026-05-05-OPL-v21-User-Owned-Runtime-Refactor-Checklist.md", "unchecked platform_provisioned migration");
expectViolation(payload, "docs/superpowers/plans/2026-05-06-opl-v21-phase-0.5-and-phase-1.md", "user_owned is only product runtime mode");
expectViolation(payload, "docs/superpowers/plans/2026-05-06-opl-v21-phase-0.5-and-phase-1.md", "user CVM Runtime Agent");
expectViolation(payload, "docs/reports/2026-05-06-OPL-v21-Phase2-9-Local-Acceptance-Report.md", "用户自有 CVM");
expectViolation(payload, "docs/reports/2026-05-06-OPL-v21-Phase2-9-Local-Acceptance-Report.md", "真实用户 CVM");

await rm(fixtureRoot, { recursive: true, force: true });
