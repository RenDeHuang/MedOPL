import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const activeCodeRoots = [
  "services/portal/src",
  "services/portal/frontend/src",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];

const currentNarrativeRoots = [
  "docs/active",
  "docs/specs",
  "docs/product",
  "docs/runtime",
  "docs/policies",
  "docs/delivery",
  "docs/source",
  "docs/public",
  "docs/references",
  "docs/history",
];

const currentNarrativeFiles = [
  "README.md",
  "docs/README.md",
  "DESIGN.md",
  "scripts/v22-workflow-gate.mjs",
];

const allowedTokenGuardianScripts = new Set([
  "tests/health/health-check-v22-zero-compat-active-surface-gate.mjs",
  "tests/health/health-check-v22-archive-smoke-contract-physical-retirement-gate.mjs",
  "tests/health/health-check-v22-contract-conflict-boundary.mjs",
  "tests/contract/contract-test-v22-goal-state-consistency.mjs",
  "tests/contract/contract-test-v22-product-goal-harness.mjs",
  "tests/contract/contract-test-v22-default-entry-narrative-gate.mjs",
  "tests/contract/contract-test-v22-agent-verify-entrypoint.mjs",
  "tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs",
  "tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs",
  "tests/contract/contract-test-v22-env-template-default-entry.mjs",
  "tests/contract/contract-test-v22-product-goal-execution-order.mjs",
  "tests/contract/contract-test-v22-repo-zoning-boundary.mjs",
  "scripts/v22-workflow-gate.mjs",
]);

const oldRouteFieldPatterns = [
  /\bresourceOrderId\b/gu,
  /\bresource_order_id\b/gu,
  /\blegacyResourceOrderId\b/gu,
  /\bresource_orders\b/gu,
  /\bresource-order\b/giu,
  /\buser_owned(?:_runtime|_runtime_dispatch)?\b/gu,
  /\buser-owned(?:-runtime)?\b/giu,
  /\bUSER_OWNED_RUNTIME_AGENT_REQUIRED\b/gu,
  /\bUSER_OWNED_RUNTIME_DISPATCH\b/gu,
];

const retiredActiveTokenPatterns = [
  /\bresource_order_prepare\b/gu,
  /\bRESOURCE_ORDER_PREPARE_FAILED\b/gu,
  /\bopencost-pending\b/gu,
];

const residualExecutableScriptNamePatterns = [
  /(?:^|-)live(?:-|\.mjs$)/u,
  /(?:^|-)canary(?:-|\.mjs$)/u,
  /authorized-deploy/u,
  /authorized-resource-lifecycle/u,
  /real-live/u,
  /live-runner/u,
  /live-bridge/u,
  /live-diagnostics/u,
];

const forbiddenDefaultReferencePatterns = [
  /scripts\/smoke-test-v(?:19|20|21)[^"'\s)]*/u,
  /scripts\/live-test-[^"'\s)]*/u,
  /scripts\/check-v(?:18|20|21)[^"'\s)]*/u,
  /scripts\/(?:start|install)-opencost[^"'\s)]*/u,
  /scripts\/.*resource-provisioner[^"'\s)]*/u,
  /scripts\/.*med-autoscience-runner[^"'\s)]*/u,
  /scripts\/.*authorized-deploy[^"'\s)]*/u,
  /scripts\/.*authorized-resource-lifecycle[^"'\s)]*/u,
  /scripts\/.*real-live[^"'\s)]*/u,
  /scripts\/.*live-runner[^"'\s)]*/u,
  /scripts\/.*live-bridge[^"'\s)]*/u,
  /scripts\/.*live-diagnostics[^"'\s)]*/u,
];

const compatibilityCompletionPatterns = [
  /\bkeep_tombstone\b/iu,
  /\barchive_reference\b/iu,
  /\bGateway alias\b/iu,
  /Runtime Bridge \/ Runtime Agent 合同包/iu,
  /portal-legacy-redirect\.routes\.mjs[^.\n]*(?:路径迁移壳|兼容|compat)/iu,
  /旧 workspace redirects[^.\n]*(?:兼容|compat)/iu,
  /旧入口兼容参考/iu,
  /runtime-bridge-managed-runs\.mjs[^.\n]*(?:compatibility fence|兼容)/iu,
  /\bmanaged_runtime\b[^.\n]*(?:兼容|compat)/iu,
  /## Legacy 本地 MVP regression alias[\s\S]{0,5200}\bfake-live\b/iu,
  /## Legacy 本地 MVP regression alias[\s\S]{0,5200}\bfake Product API\b/iu,
  /## Legacy 本地 MVP regression alias[\s\S]{0,5200}\bfake Runtime Agent relay\b/iu,
  /## Legacy 本地 MVP regression alias[\s\S]{0,5200}scripts\/smoke-test-v22-real-opl-file-run-artifact-runtime-agent-api-loop\.mjs/iu,
  /## Legacy 本地 MVP regression alias[\s\S]{0,5200}scripts\/smoke-test-v22-portal-opl-api-runtime-loop\.mjs/iu,
  /adapters\/billing-aggregator\/\*\*[^.\n]*(?:active|retain|retention|可保留|保留|active reason)/iu,
  /deploy\/local\/dockerfiles\/[^.\n]*(?:active|retain|retention|evidence surface|可保留|保留|active reason)/iu,
  /active v22 retention truth:[^\n]*(?:adapters\/billing-aggregator|deploy\/local\/dockerfiles)/iu,
  /must_retain_active_v22_paths[\s\S]{0,800}(?:adapters\/billing-aggregator|deploy\/local\/dockerfiles)/iu,
  /old deploy\/adapters\/infra assets[^.\n]*(?:unless proven active|active v22 surface)/iu,
];

function normalizeRepoPath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function lineOf(source, index) {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

function contextAround(source, index, radius = 180) {
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + radius));
}

function isNegativeRetirementContext(context) {
  return /(?:must not|不得|禁止|delete|deleted|retired|physical|forbidden|must_be_deleted|must_not|not retain|not include|not restore|不能|不保留|不再|退役|删除|已删除|清退|fail-closed)/iu.test(context);
}

function asGlobalPattern(pattern) {
  if (pattern.global) return pattern;
  return new RegExp(pattern.source, `${pattern.flags}g`);
}

function isTextFile(filePath) {
  return /\.(?:mjs|js|ts|tsx|vue|json|md|yaml|yml|ps1|cmd|html|css)$/iu.test(filePath);
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(rootPath) {
  const absoluteRoot = path.join(repoRoot, rootPath);
  if (!(await exists(rootPath))) return [];
  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = normalizeRepoPath(path.join(rootPath, entry.name));
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".runtime", "dist", "coverage"].includes(entry.name)) continue;
      files.push(...await listFiles(repoPath));
    } else if (entry.isFile()) {
      files.push(repoPath);
    }
  }
  return files;
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function pushPatternFindings(findings, { type, file, source, patterns, detail }) {
  for (const pattern of patterns) {
    for (const match of source.matchAll(asGlobalPattern(pattern))) {
      if (isNegativeRetirementContext(contextAround(source, match.index ?? 0))) continue;
      findings.push({
        type,
        file,
        line: lineOf(source, match.index ?? 0),
        match: match[0],
        detail,
      });
    }
  }
}

async function assertNoActiveCodeLegacyFields(findings) {
  const files = (await Promise.all(activeCodeRoots.map(listFiles))).flat().filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "active_code_legacy_compat_field",
      file,
      source,
      patterns: oldRouteFieldPatterns,
      detail: "Active Portal/Gateway/Runtime Bridge code must not accept, map, persist, or publish retired user-owned/resource-order fields or runtime aliases.",
    });
  }
}

async function assertNoRetiredActiveTokens(findings) {
  const files = (await Promise.all(activeCodeRoots.map(listFiles))).flat().filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "active_code_retired_token",
      file,
      source,
      patterns: retiredActiveTokenPatterns,
      detail: "Active Portal/Gateway/Runtime Bridge source must physically retire resource_order_prepare, RESOURCE_ORDER_PREPARE_FAILED, and opencost-pending.",
    });
  }
}

async function assertRuntimeBridgeDoesNotAcceptLaunchTokenQuery(findings) {
  const files = (await listFiles("services/opl-runtime-bridge/src")).filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    for (const pattern of [
      /url\.searchParams\.get\(["']launch_token["']\)/gu,
      /searchParams\.get\(["']launch_token["']\)/gu,
      /input\.launchToken\s*\|\|\s*input\.launch_token/gu,
    ]) {
      for (const match of source.matchAll(pattern)) {
        if (isNegativeRetirementContext(contextAround(source, match.index ?? 0))) continue;
        findings.push({
          type: "runtime_bridge_launch_token_query_acceptance",
          file,
          line: lineOf(source, match.index ?? 0),
          match: match[0],
          detail: "Runtime Bridge active path must use Authorization/header-bound launch token flow, not launch_token query.",
        });
      }
    }
  }
}

async function assertPortalRuntimeEnvironmentNoRetiredUi(findings) {
  const file = "services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx";
  if (!(await exists(file))) return;
  const source = await readRepoFile(file);
  for (const pattern of [
    /\bactivateCustomLabPackage\b/gu,
    /selectedPlan\s*={0,2}\s*["']custom["']/gu,
    /selectedPlan\s*===\s*["']custom["']/gu,
    /setSelectedPlan\(["']custom["']\)/gu,
    /¥[\s\S]{0,120}\/\s*小时/gu,
    /price[\s\S]{0,120}小时/giu,
  ]) {
    for (const match of source.matchAll(pattern)) {
      findings.push({
        type: "portal_runtime_environment_retired_ui",
        file,
        line: lineOf(source, match.index ?? 0),
        match: match[0],
        detail: "Portal RuntimeEnvironment MVP must expose only starter/pro active plans and no hard-coded formal hourly selling price.",
      });
    }
  }
}

async function assertNoActiveCustomPackageSurface(findings) {
  const files = (await Promise.all(activeCodeRoots.map(listFiles))).flat().filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "active_custom_package_surface",
      file,
      source,
      patterns: [
        /\bactivateCustomLabPackage\b/gu,
        /\/lab-packages\/custom/gu,
        /\bnormalizeCustomLabPackageSpec\b/gu,
        /\bcustomLabPackageFromSpec\b/gu,
        /\bcustomOptions\b/gu,
        /packageId\s*:\s*["']custom["']/gu,
        /\bid\s*:\s*["']custom["'][\s\S]{0,200}自定义套餐/gu,
        /自定义套餐/gu,
      ],
      detail: "MVP active source must not expose custom package route/action/catalog/generator; custom stays future-authorized only.",
    });
  }
}

async function assertNoActiveAddonPackageSurface(findings) {
  const files = (await Promise.all(activeCodeRoots.map(listFiles))).flat().filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "active_addon_package_surface",
      file,
      source,
      patterns: [
        /\/lab-storage\/addons/gu,
        /\bpurchaseLabStorageAddon\b/gu,
        /\blabStorageAddonPublicView\b/gu,
        /\bLAB_STORAGE_ADDON_SIZES_GB\b/gu,
        /\bstorage_addon_purchased\b/gu,
      ],
      detail: "MVP active source must not expose add-on storage/compute package route/action; add-ons stay future-authorized only.",
    });
  }
}

async function assertNoFrontendFormalHourlyPrice(findings) {
  const files = (await listFiles("services/portal/frontend/src")).filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "frontend_formal_hourly_price_surface",
      file,
      source,
      patterns: [
        /\bpricePerHour\b/gu,
        /\bpricePerDay\b/gu,
        /\bhourlyPrice\b/gu,
        /\/\s*小时/gu,
        /¥[\s\S]{0,80}小时/gu,
      ],
      detail: "Portal ordinary UI must show pending approval / price unset language, not formal hourly selling prices.",
    });
  }
}

async function assertNoImplicitDefaultWorkspacePositivePath(findings) {
  const scopedFiles = [
    "services/portal/src/domain/lab-entitlements.mjs",
    "services/portal/src/domain/lab-subscriptions.mjs",
    "services/portal/src/routes/lab-package.routes.mjs",
    "services/portal/src/routes/opl.routes.mjs",
    "services/portal/src/routes/workspace.routes.mjs",
    "services/portal/src/routes/workspace-storage-route-handlers.mjs",
    "services/portal/src/routes/portal-api.routes.mjs",
    "services/portal/src/app/portal-auth-runtime-handler.mjs",
    "services/portal/src/app/portal-server-plan-runtime-handler.mjs",
    "services/portal/src/app/portal-http-dispatcher.mjs",
    "services/portal/src/app/portal-workspace-runtime.mjs",
    "services/portal/src/app/portal-page-workspace-payloads.mjs",
    "services/portal/src/state/portal-store-migration-users-groups.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store-migrations.mjs",
    "services/portal/src/state/portal-store-migration-admin-seed.mjs",
    "services/portal/src/state/portal-store-postgres-write-snapshot-helpers.mjs",
    "services/portal/src/state/portal-store-migration-taskspaces.mjs",
    "services/portal/src/state/portal-store-postgres-lab-persistence.mjs",
    "services/portal/src/migrate-schema.mjs",
    "services/portal/src/portal-cloud-operation-worker.mjs",
    "services/portal/src/domain/user-credit-provider-key-flow.mjs",
    "services/portal/src/domain/lab-billing-policy.mjs",
    "services/portal/src/domain/portal-cloud-operation-production.mjs",
    "services/opl-runtime-bridge/src/state-store.mjs",
    "services/opl-runtime-bridge/src/state-store-identity.mjs",
    "services/opl-runtime-bridge/src/state-store-record-field-groups.mjs",
    "services/opl-runtime-bridge/src/state-store-runtime-records.mjs",
    "services/opl-runtime-bridge/src/state-store-workspace-records.mjs",
    "services/opl-runtime-bridge/src/state-store-run-records.mjs",
    "services/opl-runtime-bridge/src/runtime-bridge-messages.mjs",
    "services/opl-runtime-bridge/src/runtime-bridge-launch.mjs",
    "tests/regression/runtime-bridge/regression-test-v22-portal-runtime-bridge-api-local-flow.mjs",
    "tests/fixtures/v22/agent-verify-manifest.json",
  ];
  for (const file of scopedFiles) {
    if (!(await exists(file))) continue;
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "implicit_default_workspace_positive_path",
      file,
      source,
      patterns: [
        /workspaceId\s*=\s*["']default["']/gu,
        /workspaceId\s*\|\|\s*["']default["']/gu,
        /workspaceId\s*\?\?\s*["']default["']/gu,
        /searchParams\.get\(["']workspaceId["']\)\s*\|\|\s*["']default["']/gu,
        /payload\.workspaceId\s*\|\|\s*payload\.task\s*\|\|\s*["']default["']/gu,
        /payload\.workspaceId\s*\|\|\s*["']default["']/gu,
        /input\.workspaceId\s*\|\|\s*input\.workspace_id\s*\|\|\s*["']default["']/gu,
        /body\.task\s*\|\|\s*body\.workspaceId\s*\|\|\s*user\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /url\.searchParams\.get\(["']task["']\)\s*\|\|\s*user\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /payload\.task\s*\|\|\s*payload\.workspaceId\s*\|\|\s*payload\.taskSlug\s*\|\|\s*["']default["']/gu,
        /payload\.task\s*\|\|\s*user\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /form\.task\s*\|\|\s*user\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /form\.task\s*\|\|\s*["']default["']/gu,
        /url\.searchParams\.get\(["']task["']\)\s*\|\|\s*["']default["']/gu,
        /task\s*\|\|\s*user\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /currentTaskSlug\s*:\s*["']default["']/gu,
        /currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /ensureTaskSpace\([^,\n]+,\s*[^,\n]+,\s*["']default["']/gu,
        /findTaskSpace\([^,\n]+,\s*[^,\n]+,\s*user\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /user\.currentTaskSlug\s*=\s*fallback\?\.slug\s*\|\|\s*["']default["']/gu,
        /row\.currentTaskSlug\s*\|\|\s*["']default["']/gu,
        /item\.slug\s*\|\|\s*["']default["']/gu,
        /taskSpace\.slug\s*\|\|\s*["']default["']/gu,
        /workspaceId\s*\|\|\s*["']default["']/gu,
        /input\.workspaceId\s*\|\|\s*input\.workspaceSlug\s*\|\|\s*["']default["']/gu,
        /workspaceSessionScopeFields\([^)]*,\s*["']default["']\s*\)/gu,
        /defaultWorkspaceId\b/gu,
        /String\(\s*value\s*\|\|\s*["']default["']\s*\)/gu,
        /taskSlug\s*\|\|\s*["']default["']/gu,
        /subscription\.workspaceId\s*\|\|\s*["']default["']/gu,
        /input\.workspaceId\s*\|\|\s*input\.workspace_id\s*\|\|\s*["']default["']/gu,
        /context\.workspaceId\s*\|\|\s*["']default["']/gu,
        /firstNonEmpty\(\[\s*runtimeSession\.workspaceId,\s*["']default["']\s*\]\)/gu,
        /replace\(\/\^-\\\+\|-\\\+\$\/g,\s*["']["']\)\s*\|\|\s*["']default["']/gu,
      ],
      detail: "Active lab package/resource entitlement code must require an explicit workspaceId; workspaceId=\"default\" cannot remain a happy-path fallback.",
    });
  }
}

async function assertNoOrdinaryUserInternalPayloadHelpers(findings) {
  const scopedFiles = [
    "services/portal/src/domain/managed-environment-open-flow.mjs",
    "services/portal/src/domain/opl-work-flow.mjs",
    "services/portal/src/domain/portal-api-payloads.mjs",
    "services/portal/src/app/portal-page-overview-payloads.mjs",
    "services/portal/src/app/portal-page-workspace-payloads.mjs",
    "services/portal/src/domain/managed-resource-binding-plan-view.mjs",
    "services/portal/src/routes/portal-api-runs.routes.mjs",
  ];
  for (const file of scopedFiles) {
    if (!(await exists(file))) continue;
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "ordinary_user_internal_payload_helper",
      file,
      source,
      patterns: [
        /\bresourceBindingPublicView\b/gu,
        /\bfreezePublicView\b/gu,
        /\bresourceBindingPayload\b/gu,
        /resourceBinding\s*:\s*state\.resourceBinding/gu,
        /freeze\s*:\s*state\.freeze/gu,
        /resourceBindingId:\s*text\(file\.resourceBindingId\)/gu,
        /resourceBindingId:\s*text\(trace\.resourceBindingId\)/gu,
        /auditTag:\s*text\(trace\.auditTag/gu,
        /runId:\s*text\(item\.runId\)/gu,
        /resourceBindingId:\s*text\(item\.resourceBindingId\)/gu,
        /billingAttributionId:\s*text\(item\.billingAttributionId\)/gu,
        /accountId:\s*text\(item\.accountId\)/gu,
        /serverPlanId:\s*text\(item\.serverPlanId\)/gu,
        /resourceBindingId:\s*text\(file\.resourceBindingId\)/gu,
        /resourceBindingId:\s*text\(session\.resourceBindingId\)/gu,
        /resourceBindingId:\s*text\(run\.resourceBindingId\)/gu,
        /runId:\s*text\(run\.runId\)/gu,
        /auditTag:\s*text\(metadata\.auditTag\)/gu,
        /resourceBindingId:\s*bindingId\(/gu,
        /billingAttributionId:\s*billingAttributionId\(/gu,
        /accountId:\s*accountId\(/gu,
        /serverPlanId:\s*serverPlanId\(/gu,
        /resourceBindingId:\s*text\(binding\.resourceBindingId/gu,
        /resourcePlanId:\s*text\(resourcePlan\.resourcePlanId/gu,
      ],
      detail: "Ordinary Portal payload helpers must use a public whitelist and keep internal ids in backend/admin surfaces only.",
    });
  }
}

function assertNoOrdinaryPublicPayloadInternals(value, label) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    "tenantId",
    "resourceBindingId",
    "billingAttributionId",
    "accountId",
    "billingAccountId",
    "serverPlanId",
    "runId",
    "planId",
    "implementationKind",
    "cloudResourceId",
    "cvmInstanceId",
    "bucketName",
    "bucketId",
    "credentialsSecretRef",
    "rootPrefix",
    "storageBucketId",
    "computeInstanceId",
    "protectionPolicyId",
    "resourcePlanId",
    "storagePlanId",
    "auditTag",
    "costAllocationTag",
  ]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, `${label}_must_not_expose_internal_field:${forbidden}`);
  }
  for (const forbiddenValue of [
    "tenant-zero-compat",
    "rb-zero-compat",
    "billing-zero-compat",
    "server-plan-zero-compat",
    "cloud-resource-zero-compat",
    "ins-zero-compat",
    "bucket-zero-compat",
    "secret-ref-zero-compat",
    "users/user-zero-compat/workspaces/workspace-zero-compat/",
    "audit-zero-compat",
    "cost-zero-compat",
  ]) {
    assert.equal(serialized.includes(forbiddenValue), false, `${label}_must_not_expose_internal_value:${forbiddenValue}`);
  }
}

async function assertPlatformProvisionedResourcesPublicPayloadIsWhitelisted() {
  const moduleUrl = pathToFileURL(path.join(repoRoot, "services/portal/src/state/portal-platform-provisioned-resource-store.mjs")).href;
  const { createPortalPlatformProvisionedResourceStore } = await import(moduleUrl);
  const store = createPortalPlatformProvisionedResourceStore({ writeDb: async () => {} });
  const user = {
    id: "user-zero-compat",
    tenantId: "tenant-zero-compat",
  };
  const db = {
    userComputeInstances: [{
      id: "compute-zero-compat",
      ownerUserId: user.id,
      ownerTenantId: user.tenantId,
      provider: "tencent-cloud",
      region: "na-siliconvalley",
      zone: "na-siliconvalley-1",
      cloudResourceId: "cloud-resource-zero-compat",
      serverPlanId: "server-plan-zero-compat",
      cvmInstanceId: "ins-zero-compat",
      instanceId: "ins-zero-compat",
      instanceType: "S2.MEDIUM4",
      publicEndpoint: "public-zero-compat",
      privateEndpoint: "private-zero-compat",
      runtimeAgentId: "runtime-agent-zero-compat",
      status: "active",
    }],
    userStorageBuckets: [{
      id: "storage-zero-compat",
      ownerUserId: user.id,
      ownerTenantId: user.tenantId,
      provider: "cos",
      cloudResourceId: "cloud-resource-zero-compat",
      region: "na-siliconvalley",
      bucketName: "bucket-zero-compat",
      bucketId: "bucket-zero-compat",
      credentialsSecretRef: "secret-ref-zero-compat",
      rootPrefix: "users/user-zero-compat/workspaces/workspace-zero-compat/",
      storageCapacityGb: 100,
      status: "active",
    }],
    workspaceResourceBindings: [{
      id: "rb-zero-compat",
      resourceBindingId: "rb-zero-compat",
      ownerUserId: user.id,
      ownerTenantId: user.tenantId,
      tenantId: user.tenantId,
      userId: user.id,
      workspaceId: "workspace-zero-compat",
      computeInstanceId: "compute-zero-compat",
      storageBucketId: "storage-zero-compat",
      rootPrefix: "users/user-zero-compat/workspaces/workspace-zero-compat/",
      billingAttributionId: "billing-zero-compat",
      accountId: "tenant-zero-compat",
      serverPlanId: "server-plan-zero-compat",
      auditTag: "audit-zero-compat",
      costAllocationTag: "cost-zero-compat",
      status: "active",
    }],
    weeklyProtectionFreezes: [{
      id: "freeze-zero-compat",
      ownerUserId: user.id,
      ownerTenantId: user.tenantId,
      resourceBindingId: "rb-zero-compat",
      workspaceId: "workspace-zero-compat",
      computeInstanceId: "compute-zero-compat",
      storageBucketId: "storage-zero-compat",
      protectionPolicyId: "protection-zero-compat",
      usageMode: "full_runtime",
      weeklyAmount: 0,
      frozenAmount: 0,
      consumedAmount: 0,
      remainingAmount: 0,
      releasedAmount: 0,
      status: "active",
    }],
  };

  const payload = store.listOwnerScopedResources(db, user);
  assert.equal(Array.isArray(payload.items), true, "platform_resources_public_payload_items_required");
  assert.equal(payload.items[0]?.workspaceId, "workspace-zero-compat", "platform_resources_public_payload_workspace_required");
  assert.equal(payload.items[0]?.computeResource?.instanceType, "S2.MEDIUM4", "platform_resources_public_payload_compute_summary_required");
  assert.equal(payload.items[0]?.fileSpace?.storageCapacityGb, 100, "platform_resources_public_payload_file_space_summary_required");
  assertNoOrdinaryPublicPayloadInternals(payload, "platform_provisioned_resources_public_payload");
}

async function assertFrontendOrdinaryTypesDoNotExposeInternalResourceFields() {
  const files = [
    "services/portal/frontend/src/api/portal/billing.ts",
    "services/portal/frontend/src/api/portal/opl.ts",
    "services/portal/frontend/src/api/portal/resources.ts",
    "services/portal/frontend/src/api/portal/overview.ts",
    "services/portal/frontend/src/api/portal/server-plans.ts",
    "services/portal/frontend/src/api/portal/sessions.ts",
    "services/portal/frontend/src/api/portal/traces.ts",
    "services/portal/frontend/src/api/portal/workspace.ts",
  ];
  for (const file of files) {
    const source = await readRepoFile(file);
    for (const forbidden of [
      "tenantId",
      "resourceBindingId",
      "billingAttributionId",
      "accountId",
      "serverPlanId",
      "runId",
      "fetchOplRunStatus",
      "fetchOplRunArtifacts",
      "selectServerPlan",
      "cloudResourceId",
      "cvmInstanceId",
      "bucketName",
      "bucketId",
      "credentialsSecretRef",
      "rootPrefix",
      "storageBucketId",
      "computeInstanceId",
      "protectionPolicyId",
      "resourcePlanId",
      "storagePlanId",
      "UserOwned",
      "createStorageOrder",
      "createComputeInstance",
      "deleteComputeInstance",
      "ensureProtectionFreeze",
    ]) {
      assert.equal(source.includes(forbidden), false, `${file}_must_not_expose_internal_resource_field_or_legacy_client:${forbidden}`);
    }
  }
}

async function assertScriptLegacyTokensOnlyInGuardianGates(findings) {
  const files = (await listFiles("scripts")).filter(isTextFile);
  for (const file of files) {
    const source = await readRepoFile(file);
    const isGuardian = allowedTokenGuardianScripts.has(file);
    for (const pattern of oldRouteFieldPatterns) {
      for (const match of source.matchAll(pattern)) {
        if (isGuardian) continue;
        if (isNegativeRetirementContext(contextAround(source, match.index ?? 0))) continue;
        findings.push({
          type: "script_legacy_token_outside_retirement_gate",
          file,
          line: lineOf(source, match.index ?? 0),
          match: match[0],
          detail: "Scripts may mention retired user-owned/resource-order tokens only inside strict/retire/zero-compat forbidden-token gates.",
        });
      }
    }
  }
}

async function assertDefaultSmokeDoesNotUseRetiredOplLaunchFixtures(findings) {
  const { isSmokeClassifiedIn } = await import(pathToFileURL(path.join(repoRoot, "scripts/v22-test-classification.mjs")).href);
  const files = (await listFiles("scripts")).filter((file) => /^scripts\/smoke-test-v22-.*\.mjs$/u.test(file));
  for (const file of files) {
    if (!isSmokeClassifiedIn(file)) continue;
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "default_smoke_retired_opl_launch_fixture",
      file,
      source,
      patterns: [
        /searchParams\.get\(["']launch_token["']\)/gu,
        /url\.searchParams\.get\(["']launch_token["']\)/gu,
        /workspaceId\s*:\s*["']default["']/gu,
        /task\s*:\s*["']default["']/gu,
        /payload\.task\s*\|\|\s*["']default["']/gu,
      ],
      detail: "Default v22 smoke must not keep launch_token query or workspaceId=\"default\" as an OPL happy-path fixture.",
    });
  }
}

async function assertNoResidualAdapterDeployInfra(findings) {
  for (const rootPath of ["adapters", "deploy", "infra"]) {
    const files = await listFiles(rootPath);
    for (const file of files) {
      findings.push({
        type: "residual_adapter_deploy_infra_surface",
        file,
        line: 1,
        match: rootPath,
        detail: "Zero-compat monolith active repo must not keep adapters/deploy/infra as default executable context.",
      });
    }
  }
}

async function assertNoResidualLiveCanaryRunnerScripts(findings) {
  const files = await listFiles("scripts");
  for (const file of files) {
    const name = path.basename(file);
    if (!name.startsWith("smoke-test-v22-") && !name.startsWith("v22-")) continue;
    if (residualExecutableScriptNamePatterns.some((pattern) => pattern.test(name))) {
      findings.push({
        type: "residual_live_canary_authorized_executable_surface",
        file,
        line: 1,
        match: name,
        detail: "Live/canary/authorized runner scripts must be deleted or migrated to non-live local v22 gates; future external operations stay contract-only until separately authorized.",
      });
    }
  }
}

async function assertDefaultSuitesAndWorkflowDoNotReferenceResiduals(findings) {
  const files = [
    "README.md",
    "docs/product/README.md",
    "docs/runtime/README.md",
    "tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    "scripts/v22-verify.mjs",
    "scripts/v22-workflow-gate.mjs",
    "tests/contract/contract-test-v22-agent-verify-entrypoint.mjs",
  ];

  for (const file of files) {
    if (!(await exists(file))) continue;
    const source = await readRepoFile(file);
    for (const pattern of forbiddenDefaultReferencePatterns) {
      for (const match of source.matchAll(asGlobalPattern(pattern))) {
        const context = contextAround(source, match.index ?? 0, 220);
        if (isNegativeRetirementContext(context)) continue;
        findings.push({
          type: "default_suite_or_workflow_residual_reference",
          file,
          line: lineOf(source, match.index ?? 0),
          match: match[0],
          detail: "Default suite, workflow, README, and agent verify must not reference old smoke/live/check/provisioner/deploy runner paths as current verification truth.",
        });
      }
    }
  }
}

async function assertCurrentNarrativeDoesNotRetainCompatibility(findings) {
  const files = [
    ...currentNarrativeFiles,
    ...(await Promise.all(currentNarrativeRoots.map(listFiles))).flat().filter((file) => /\.(?:md|json)$/iu.test(file)),
  ];
  for (const file of files) {
    const source = await readRepoFile(file);
    pushPatternFindings(findings, {
      type: "current_narrative_compatibility_completion_state",
      file,
      source,
      patterns: compatibilityCompletionPatterns,
      detail: "Current README/product/architecture/contracts/recovery truth must not retain tombstone/archive/compat/adapter/deploy/live/canary surfaces as completion state or default context.",
    });
  }
}

async function assertRuntimeBridgeContractPackageNaming() {
  const contractIndex = await readRepoFile("docs/specs/README.md");
  assert(contractIndex.includes("### Runtime Bridge 合同包"), "contract_index_must_use_runtime_bridge_contract_package_title");
  assert.equal(
    contractIndex.includes("### Runtime Bridge / Runtime Agent 合同包"),
    false,
    "contract_index_must_not_use_adapter_contract_package_title",
  );
  assert(
    contractIndex.includes("这是 v22 active Runtime Bridge 主线服务，不是旧 adapters/* 兼容层"),
    "contract_index_must_explain_runtime_bridge_is_not_adapter_compat_layer",
  );
}

async function main() {
  const findings = [];

  await assertNoActiveCodeLegacyFields(findings);
  await assertNoRetiredActiveTokens(findings);
  await assertRuntimeBridgeDoesNotAcceptLaunchTokenQuery(findings);
  await assertPortalRuntimeEnvironmentNoRetiredUi(findings);
  await assertNoActiveCustomPackageSurface(findings);
  await assertNoActiveAddonPackageSurface(findings);
  await assertNoFrontendFormalHourlyPrice(findings);
  await assertNoImplicitDefaultWorkspacePositivePath(findings);
  await assertNoOrdinaryUserInternalPayloadHelpers(findings);
  await assertPlatformProvisionedResourcesPublicPayloadIsWhitelisted();
  await assertFrontendOrdinaryTypesDoNotExposeInternalResourceFields();
  await assertScriptLegacyTokensOnlyInGuardianGates(findings);
  await assertDefaultSmokeDoesNotUseRetiredOplLaunchFixtures(findings);
  await assertNoResidualAdapterDeployInfra(findings);
  await assertNoResidualLiveCanaryRunnerScripts(findings);
  await assertDefaultSuitesAndWorkflowDoNotReferenceResiduals(findings);
  await assertCurrentNarrativeDoesNotRetainCompatibility(findings);
  await assertRuntimeBridgeContractPackageNaming();

  findings.sort((left, right) =>
    `${left.type}:${left.file}:${left.line}`.localeCompare(`${right.type}:${right.file}:${right.line}`),
  );

  assert.deepEqual(findings, [], `zero_compat_active_surface_findings:${JSON.stringify(findings, null, 2)}`);

  console.log(JSON.stringify({
    ok: true,
    gate: "v22_zero_compat_active_surface",
    checked: {
      activeCodeRoots,
      currentNarrativeRoots,
      currentNarrativeFiles,
      residualExecutableScriptNamePatterns: residualExecutableScriptNamePatterns.map((pattern) => pattern.source),
    },
  }, null, 2));
}

await main();
