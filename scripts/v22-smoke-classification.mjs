export const SMOKE_CATEGORIES = Object.freeze([
  "default/local-contract",
  "portal-local",
  "opl-local",
  "cloud-future-authorized",
  "archive/retired",
]);

export const SMOKE_EVAL_TIERS = Object.freeze([
  "health-check",
  "smoke-golden",
  "contract-local",
  "local-regression",
  "future-authorized",
  "retired",
]);

export const SMOKE_EVAL_SURFACES = Object.freeze([
  "control-plane",
  "portal",
  "opl",
  "runtime-bridge",
  "cloud",
  "archive",
]);

export const SMOKE_EVAL_ENTRY_KINDS = Object.freeze([
  "atomic",
  "suite-wrapper",
  "gate-self-test",
]);

export const SMOKE_EVAL_AUTHORIZATIONS = Object.freeze([
  "none",
  "future-authorized",
]);

export const DEFAULT_SMOKE_CATEGORIES = Object.freeze([
  "default/local-contract",
  "portal-local",
  "opl-local",
]);

export const HEALTH_CHECK_MAX = 6;
export const SMOKE_GOLDEN_MIN = 8;
export const SMOKE_GOLDEN_MAX = 15;

export const SMOKE_CLASSIFICATION = Object.freeze({
  "scripts/smoke-test-v22-admin-ops-console-boundary.mjs": "portal-local",
  "scripts/smoke-test-v22-admin-ops-console-readonly-mvp.mjs": "portal-local",
  "scripts/smoke-test-v22-admin-ops-disabled-product-state.mjs": "portal-local",
  "scripts/smoke-test-v22-agent-verify-entrypoint.mjs": "default/local-contract",
  "scripts/smoke-test-v22-agent-run-record-gate.mjs": "default/local-contract",
  "scripts/smoke-test-v22-agent-workflow-cloud-onboarding.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs": "default/local-contract",
  "scripts/smoke-test-v22-autonomous-goal-runner.mjs": "default/local-contract",
  "scripts/smoke-test-v22-authorized-tencent-create-release-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-authorized-tencent-create-release-execution-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-authorized-tencent-create-release-implementation-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-authorized-tencent-deploy-execution-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-contract-eval-compaction.mjs": "default/local-contract",
  "scripts/smoke-test-v22-contract-smoke-eval-index-compaction.mjs": "default/local-contract",
  "scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs": "default/local-contract",
  "scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs": "default/local-contract",
  "scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs": "default/local-contract",
  "scripts/smoke-test-v22-cloud-cleanup-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-connection-runnable-path.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-onboarding-absorption-sequence.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-onboarding-board-status.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-onboarding-workflow-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-resource-contract-suite.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-cloud-resource-isolation-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-contract-conflict-boundary.mjs": "default/local-contract",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs": "default/local-contract",
  "scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs": "default/local-contract",
  "scripts/smoke-test-v22-discovery-governance-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-env-template-default-entry.mjs": "default/local-contract",
  "scripts/smoke-test-v22-gflabtoken-entry-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-goal-state-consistency.mjs": "default/local-contract",
  "scripts/smoke-test-v22-golden-smoke-suite.mjs": "default/local-contract",
  "scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs": "portal-local",
  "scripts/smoke-test-v22-long-term-governance-surfaces.mjs": "default/local-contract",
  "scripts/smoke-test-v22-managed-environment-open-flow.mjs": "portal-local",
  "scripts/smoke-test-v22-managed-resource-binding-plan-view.mjs": "portal-local",
  "scripts/smoke-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs": "default/local-contract",
  "scripts/smoke-test-v22-mvp-contract-suite.mjs": "default/local-contract",
  "scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-mvp-user-loop-contract.mjs": "default/local-contract",
  "scripts/smoke-test-v22-observability-billing-narrative-boundary.mjs": "portal-local",
  "scripts/smoke-test-v22-opl-acp-runtime-bridge.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-deployment-ownership-release-plan-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-opl-dual-entry-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-gateway-upstream-proxy-local.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-runtime-bridge-bootstrap.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-runtime-e2e-local-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-web-gateway-direct-entry.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-web-gateway-launch.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-web-gateway-native-login.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-web-gateway-websocket-reset-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-opl-work-message-file-run-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-package-d-deploy-dry-run-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-package-d-image-push-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-package-d-opl-deploy-discovery-status.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-admin-shared-helper-structure.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-api-auth-boundary.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-auth-landing-route.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-cloud-operation-runner-loop.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-cloud-operation-test-api-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-contract-role-consolidation.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-cost-balance-trace-linkage.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-dev-server-auth-proxy.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-figma-make-admin-readiness.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-figma-make-interaction-readiness.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-figma-make-ui-implementation-contract.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-file-space-management.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-frontend-api-surface-alignment.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-frontend-surface-composables.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-local-api-action-browser.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-local-api-action-closure.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-mobile-table-usability.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-mobile-usability.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-opl-api-runtime-loop.mjs": "opl-local",
  "scripts/smoke-test-v22-portal-opl-connection-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-portal-opl-context-backflow-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-package-surface-isolation.mjs": "portal-local",
  "scripts/smoke-test-v22-post-absorb-portal-opl-truth.mjs": "default/local-contract",
  "scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-portal-role-surface-boundaries.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-runtime-bridge-api-local-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-portal-runtime-startup-config.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-runtime-suite.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-session-trace-view.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-storage-mode-local-closure.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-trace-file-linkage.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-ui-design-quality-audit.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-web-route-alignment.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-workbench-management-ui-api.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-workbench-management-ui-browser.mjs": "portal-local",
  "scripts/smoke-test-v22-portal-workbench-management-ui-composition-contract.mjs": "portal-local",
  "scripts/smoke-test-v22-pricing-plan-contract.mjs": "default/local-contract",
  "scripts/smoke-test-v22-product-goal-execution-order.mjs": "default/local-contract",
  "scripts/smoke-test-v22-product-goal-harness.mjs": "default/local-contract",
  "scripts/smoke-test-v22-production-cloud-topology-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-program-board.mjs": "default/local-contract",
  "scripts/smoke-test-v22-provider-secret-boundary-contract.mjs": "opl-local",
  "scripts/smoke-test-v22-real-opl-capability-contract-gate.mjs": "opl-local",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-contract-gate.mjs": "opl-local",
  "scripts/smoke-test-v22-real-opl-file-run-artifact-gates.mjs": "opl-local",
  "scripts/smoke-test-v22-real-opl-provider-message-contract-gate.mjs": "opl-local",
  "scripts/smoke-test-v22-real-opl-webui-runtime-bridge-flow.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-real-resource-contract-alignment.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs": "default/local-contract",
  "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs": "portal-local",
  "scripts/smoke-test-v22-repo-governance-physical-compaction.mjs": "default/local-contract",
  "scripts/smoke-test-v22-repo-zoning-boundary.mjs": "default/local-contract",
  "scripts/smoke-test-v22-resource-plan-contract.mjs": "default/local-contract",
  "scripts/smoke-test-v22-retire-legacy-resource-user-surface.mjs": "portal-local",
  "scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-runtime-bridge-state-store-atomic-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-runtime-gate-contract.mjs": "default/local-contract",
  "scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs": "default/local-contract",
  "scripts/smoke-test-v22-saas-portal-opl-ops-surface-contract.mjs": "portal-local",
  "scripts/smoke-test-v22-smoke-classification-gate.mjs": "default/local-contract",
  "scripts/smoke-test-v22-smoke-eval-boundary.mjs": "default/local-contract",
  "scripts/smoke-test-v22-tencent-deploy-execution-config-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-dry-run-resource-plan-provider.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-official-sdk-provider-strategy-contract.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-adapter-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-boundary.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-bridge-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-diagnostics-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-local-guard.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-loader.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-real-sdk-client.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-runner-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-sdk-client.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-inventory-tc3-modules.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-readonly-quote-provider-boundary.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-resource-lifecycle-baseline-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-resource-lifecycle-config-local-gate.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs": "cloud-future-authorized",
  "scripts/smoke-test-v22-truth-freeze-physical-retirement.mjs": "default/local-contract",
  "scripts/smoke-test-v22-user-credit-provider-key-flow.mjs": "opl-local",
  "scripts/smoke-test-v22-workflow-gate.mjs": "default/local-contract",
  "scripts/smoke-test-v22-workspace-storage-public-response.mjs": "portal-local",
  "scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs": "default/local-contract",
});

export const HEALTH_CHECK_SCRIPTS = Object.freeze([
  "scripts/smoke-test-v22-archive-smoke-contract-physical-retirement-gate.mjs",
  "scripts/smoke-test-v22-contract-conflict-boundary.mjs",
  "scripts/smoke-test-v22-smoke-classification-gate.mjs",
  "scripts/smoke-test-v22-smoke-eval-boundary.mjs",
  "scripts/smoke-test-v22-workflow-gate.mjs",
  "scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs",
]);

export const SMOKE_GOLDEN_SCRIPTS = Object.freeze([
  "scripts/smoke-test-v22-managed-environment-open-flow.mjs",
  "scripts/smoke-test-v22-mvp-managed-opl-loop-contract.mjs",
  "scripts/smoke-test-v22-mvp-user-loop-contract.mjs",
  "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs",
  "scripts/smoke-test-v22-portal-opl-connection-contract.mjs",
  "scripts/smoke-test-v22-pricing-plan-contract.mjs",
  "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
  "scripts/smoke-test-v22-resource-plan-contract.mjs",
  "scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "scripts/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs",
  "scripts/smoke-test-v22-user-credit-provider-key-flow.mjs",
]);

export const SMOKE_SUITE_ENTRYPOINTS = Object.freeze([
  "scripts/smoke-test-v22-cloud-resource-contract-suite.mjs",
  "scripts/smoke-test-v22-golden-smoke-suite.mjs",
  "scripts/smoke-test-v22-mvp-contract-suite.mjs",
  "scripts/smoke-test-v22-portal-runtime-suite.mjs",
]);

const HEALTH_CHECK_SET = new Set(HEALTH_CHECK_SCRIPTS);
const SMOKE_GOLDEN_SET = new Set(SMOKE_GOLDEN_SCRIPTS);
const RUNTIME_BRIDGE_SURFACE_SET = new Set([
  "scripts/smoke-test-v22-opl-acp-runtime-bridge.mjs",
  "scripts/smoke-test-v22-opl-runtime-bridge-bootstrap.mjs",
  "scripts/smoke-test-v22-portal-runtime-bridge-api-local-flow.mjs",
  "scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "scripts/smoke-test-v22-runtime-bridge-state-store-atomic-flow.mjs",
  "scripts/smoke-test-v22-runtime-gate-contract.mjs",
]);

const CONTROL_PLANE_SURFACE_SET = new Set([
  ...HEALTH_CHECK_SCRIPTS,
  ...SMOKE_SUITE_ENTRYPOINTS,
  "scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
  "scripts/smoke-test-v22-autonomous-goal-runner.mjs",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs",
  "scripts/smoke-test-v22-env-template-default-entry.mjs",
  "scripts/smoke-test-v22-goal-state-consistency.mjs",
  "scripts/smoke-test-v22-long-term-governance-surfaces.mjs",
  "scripts/smoke-test-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.mjs",
  "scripts/smoke-test-v22-post-20fe9ac-agent-workflow-truth-and-repo-classification.mjs",
  "scripts/smoke-test-v22-truth-repo-narrative-reference-unification.mjs",
  "scripts/smoke-test-v22-product-goal-execution-order.mjs",
  "scripts/smoke-test-v22-product-goal-harness.mjs",
  "scripts/smoke-test-v22-program-board.mjs",
  "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
  "scripts/smoke-test-v22-repo-zoning-boundary.mjs",
  "scripts/smoke-test-v22-smoke-eval-physical-compaction.mjs",
]);

const SURFACE_CONTRACT_REFS = Object.freeze({
  "control-plane": Object.freeze(["docs/recovery/v22-agent-verify-manifest.json"]),
  portal: Object.freeze([
    "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
    "docs/contracts/v22-portal-user-surface-boundary.md",
  ]),
  opl: Object.freeze([
    "docs/contracts/v22-portal-opl-connection-boundary.md",
    "docs/contracts/v22-opl-work-message-file-run-boundary.md",
  ]),
  "runtime-bridge": Object.freeze([
    "docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
  ]),
  cloud: Object.freeze(["docs/contracts/v22-cloud-onboarding-workflow-boundary.md"]),
  archive: Object.freeze(["docs/recovery/archive-policy.md"]),
});

export function smokeCategoryOf(scriptPath) {
  return SMOKE_CLASSIFICATION[normalizeSmokeScriptPath(scriptPath)] || "";
}

export function smokeEvalMetadataOf(scriptPath) {
  const normalized = normalizeSmokeScriptPath(scriptPath);
  const category = smokeCategoryOf(normalized);
  const tier = smokeEvalTierOf(normalized, category);
  const surface = smokeEvalSurfaceOf(normalized, category);
  const contractRefs = [
    "docs/contracts/v22-smoke-eval-boundary.md",
    ...(SURFACE_CONTRACT_REFS[surface] || []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const entryKind = smokeEvalEntryKindOf(normalized);
  const authorization = smokeEvalAuthorizationOf(category);
  return Object.freeze({
    scriptPath: normalized,
    category,
    tier,
    surface,
    entryKind,
    authorization,
    contractRefs: Object.freeze(contractRefs),
  });
}

export function listClassifiedSmokeScripts({ categories = SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return Object.entries(SMOKE_CLASSIFICATION)
    .filter(([, category]) => allowed.has(category))
    .map(([scriptPath]) => scriptPath)
    .sort();
}

export function listSmokeEvalScripts({ tiers = SMOKE_EVAL_TIERS, surfaces = SMOKE_EVAL_SURFACES } = {}) {
  const allowedTiers = new Set(tiers);
  const allowedSurfaces = new Set(surfaces);
  return Object.keys(SMOKE_CLASSIFICATION)
    .filter((scriptPath) => {
      const metadata = smokeEvalMetadataOf(scriptPath);
      return allowedTiers.has(metadata.tier) && allowedSurfaces.has(metadata.surface);
    })
    .sort();
}

export function isSmokeClassifiedIn(scriptPath, { categories = DEFAULT_SMOKE_CATEGORIES } = {}) {
  const normalized = normalizeSmokeScriptPath(scriptPath);
  const allowed = new Set(categories);
  return allowed.has(smokeCategoryOf(normalized));
}

function smokeEvalTierOf(scriptPath, category) {
  if (category === "archive/retired") return "retired";
  if (category === "cloud-future-authorized") return "future-authorized";
  if (HEALTH_CHECK_SET.has(scriptPath)) return "health-check";
  if (SMOKE_GOLDEN_SET.has(scriptPath)) return "smoke-golden";
  if (category === "default/local-contract") return "contract-local";
  if (category === "portal-local" || category === "opl-local") return "local-regression";
  return "";
}

function smokeEvalSurfaceOf(scriptPath, category) {
  if (category === "archive/retired") return "archive";
  if (category === "cloud-future-authorized") return "cloud";
  if (RUNTIME_BRIDGE_SURFACE_SET.has(scriptPath)) return "runtime-bridge";
  if (CONTROL_PLANE_SURFACE_SET.has(scriptPath)) return "control-plane";
  if (category === "portal-local") return "portal";
  if (category === "opl-local") return "opl";
  if (category === "default/local-contract") return "control-plane";
  return "";
}

function smokeEvalEntryKindOf(scriptPath) {
  if (SMOKE_SUITE_ENTRYPOINTS.includes(scriptPath)) return "suite-wrapper";
  if (scriptPath === "scripts/smoke-test-v22-workflow-gate.mjs") return "gate-self-test";
  return "atomic";
}

function smokeEvalAuthorizationOf(category) {
  if (category === "cloud-future-authorized") return "future-authorized";
  return "none";
}

function normalizeSmokeScriptPath(scriptPath) {
  const value = String(scriptPath || "").trim();
  if (!value) return "";
  const withPrefix = value.startsWith("scripts/") ? value : `scripts/${value}`;
  return withPrefix.endsWith(".mjs") ? withPrefix : `${withPrefix}.mjs`;
}
