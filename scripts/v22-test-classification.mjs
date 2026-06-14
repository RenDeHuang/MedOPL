import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

export const SMOKE_CATEGORIES = Object.freeze(["default/local-contract", "portal-local", "opl-local", "real-cloud-readiness", "cloud-future-authorized"]);
export const SMOKE_EVAL_TIERS = Object.freeze(["health-check", "smoke-golden", "contract-local", "local-regression", "real-cloud-readiness", "future-authorized"]);
export const SMOKE_EVAL_SURFACES = Object.freeze(["control-plane", "portal", "opl", "runtime-bridge", "cloud"]);
export const SMOKE_EVAL_ENTRY_KINDS = Object.freeze(["atomic", "suite-wrapper", "gate-self-test"]);
export const SMOKE_EVAL_AUTHORIZATIONS = Object.freeze(["none", "future-authorized"]);
export const SMOKE_EVAL_LIFECYCLE_ROLES = Object.freeze(["current-owner", "negative-retirement-guard", "suite-wrapper", "real-cloud-readiness-boundary", "future-authorized-boundary"]);
export const TEST_LANES = Object.freeze(["health", "smoke", "contract", "regression-portal", "regression-opl", "regression-runtime-bridge", "real-cloud-readiness", "future-authorized"]);
export const DEFAULT_SMOKE_CATEGORIES = Object.freeze(["default/local-contract", "portal-local", "opl-local"]);
export const HEALTH_CHECK_MAX = 10;
export const SMOKE_GOLDEN_MIN = 8;
export const SMOKE_GOLDEN_MAX = 15;
export const TEST_LIFECYCLE_CLEANUP_POLICY = Object.freeze({
  directCleanup: true,
  activeTestRequiresLaneOwner: true,
  activeTestRequiresCurrentOwnerSurface: true,
  historyKeepsSummaryOnly: true,
  gitHistoryKeepsDetails: true,
  duplicateAggregateAction: "merge-or-delete",
  lifecycleRoleAuthority: "TEST_LANE_REGISTRY",
});

const HEALTH_FILES = Object.freeze(["tests/health/health-check-v22-contract-conflict-boundary.mjs","tests/health/health-check-v22-line-budget-gate.mjs","tests/health/health-check-v22-repo-bloat-audit-gate.mjs","tests/health/health-check-v22-repo-hygiene-gate.mjs","tests/health/health-check-v22-smoke-classification-gate.mjs","tests/health/health-check-v22-smoke-eval-boundary.mjs","tests/health/health-check-v22-workflow-command-reference-gate.mjs","tests/health/health-check-v22-workflow-gate.mjs","tests/health/health-check-v22-zero-compat-active-surface-gate.mjs"]);
const SMOKE_FILES = Object.freeze(["tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs","tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs","tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs","tests/smoke/smoke-test-v22-portal-files-billing-trace-flow.mjs","tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs","tests/smoke/smoke-test-v22-pricing-plan-contract.mjs","tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs","tests/smoke/smoke-test-v22-resource-plan-contract.mjs","tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs","tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs","tests/smoke/smoke-test-v22-user-credit-provider-key-flow.mjs"]);
const CONTRACT_FILES = Object.freeze(["tests/contract/contract-test-v22-landing-closeout-automation.mjs","tests/contract/contract-test-v22-agent-verify-entrypoint.mjs","tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs","tests/contract/contract-test-v22-backend-go-convergence-program.mjs","tests/contract/contract-test-v22-change-package-lifecycle.mjs","tests/contract/contract-test-v22-commercial-package-model.mjs","tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs","tests/contract/contract-test-v22-go-backend-service-surface.mjs","tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs","tests/contract/contract-test-v22-local-service-orchestration.mjs","tests/contract/contract-test-v22-local-saas-backend-rc.mjs","tests/contract/contract-test-v22-precloud-deployable-rc.mjs","tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs","tests/contract/contract-test-v22-real-cloud-readiness-lane.mjs","tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs","tests/contract/contract-test-v22-current-development-lines.mjs","tests/contract/contract-test-v22-current-state-index-loop.mjs","tests/contract/contract-test-v22-diff-scoped-sensitive-hygiene.mjs","tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs","tests/contract/contract-test-v22-framework-truth-layering.mjs","tests/contract/contract-test-v22-framework-workflow-convergence.mjs","tests/contract/contract-test-v22-product-engineering-loop-index.mjs","tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs","tests/contract/contract-test-v22-golden-smoke-suite.mjs","tests/contract/contract-test-v22-mvp-contract-suite.mjs","tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs","tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs","tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs","tests/contract/contract-test-v22-spec-eval-traceability.mjs","tests/contract/contract-test-v22-test-lane-registry.mjs","tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs","tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs","tests/contract/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs"]);
const REAL_CLOUD_READINESS_FILES = Object.freeze(["tests/future-authorized/cloud/future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs"]);
const FUTURE_AUTHORIZED_FILES = Object.freeze(["tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs","tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs","tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs","tests/future-authorized/cloud/future-authorized-test-v22-cloud-cleanup-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-package-c-postgres-ledger-sink-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs","tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs","tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs"]);
const REGRESSION_PORTAL_FILES = Object.freeze(["tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs","tests/regression/portal/regression-test-v22-portal-contract-role-consolidation.mjs","tests/regression/portal/regression-test-v22-portal-dev-server-auth-proxy.mjs","tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs","tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs","tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs","tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs","tests/regression/portal/regression-test-v22-portal-mobile-table-usability.mjs","tests/regression/portal/regression-test-v22-portal-mobile-usability.mjs","tests/regression/portal/regression-test-v22-portal-package-surface-isolation.mjs","tests/regression/portal/regression-test-v22-portal-role-surface-boundaries.mjs","tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs","tests/regression/portal/regression-test-v22-portal-workbench-management-ui-browser.mjs","tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs","tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs"]);
const REGRESSION_OPL_FILES = Object.freeze(["tests/regression/opl/regression-test-v22-gateway-live-probe.mjs","tests/regression/opl/regression-test-v22-local-portal-gateway-runtime-rc.mjs","tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs","tests/regression/opl/regression-test-v22-opl-web-gateway-direct-entry.mjs","tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs","tests/regression/opl/regression-test-v22-opl-web-gateway-native-login.mjs","tests/regression/opl/regression-test-v22-opl-web-gateway-websocket-reset-contract.mjs","tests/regression/opl/regression-test-v22-opl-work-message-file-run-flow.mjs","tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs"]);
const REGRESSION_RUNTIME_BRIDGE_FILES = Object.freeze(["tests/regression/runtime-bridge/regression-test-v22-opl-acp-runtime-bridge.mjs","tests/regression/runtime-bridge/regression-test-v22-opl-runtime-bridge-bootstrap.mjs","tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-launch-mutation-owner-isolation.mjs","tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs","tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs"]);
const REGISTRY_OVERRIDES = Object.freeze(new Map([
  ["tests/contract/contract-test-v22-landing-closeout-automation.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-agent-verify-entrypoint.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract"]}],
  ["tests/contract/contract-test-v22-ai-mvp-readiness-audit.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-backend-go-convergence-program.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","review"]}],
  ["tests/contract/contract-test-v22-commercial-package-model.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","review"]}],
  ["tests/contract/contract-test-v22-node-portal-backend-physical-removal.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","review"]}],
  ["tests/contract/contract-test-v22-go-backend-service-surface.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract","review"]}],
  ["tests/contract/contract-test-v22-local-portal-opl-delivery-rc.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-local-service-orchestration.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-local-saas-backend-rc.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-precloud-deployable-rc.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-real-cloud-authorization-boundary.mjs", {"surface":"cloud","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-real-cloud-readiness-lane.mjs", {"surface":"cloud","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-sentrux-rules-alignment-boundary.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-current-development-lines.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"atomic","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-current-state-index-loop.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-diff-scoped-sensitive-hygiene.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract"]}],
  ["tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-framework-truth-layering.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-framework-workflow-convergence.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-product-engineering-loop-index.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-full-taxonomy-cleanup.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract"]}],
  ["tests/contract/contract-test-v22-golden-smoke-suite.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"suite-wrapper","verifySuites":["local-contract"]}],
  ["tests/contract/contract-test-v22-mvp-contract-suite.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"suite-wrapper","verifySuites":["local-contract"]}],
  ["tests/contract/contract-test-v22-cleanup-lifecycle-system.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-change-package-lifecycle.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-root-verify-workflow-entrypoints.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-spec-eval-traceability.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-test-lane-registry.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/contract-test-v22-test-lifecycle-cleanup.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract","current","review"]}],
  ["tests/contract/runtime-bridge/contract-test-v22-ai-runtime-contract.mjs", {"surface":"runtime-bridge","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract"]}],
  ["tests/contract/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs", {"surface":"runtime-bridge","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["local-contract"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-contract.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"atomic","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-execution-contract.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"atomic","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-authorized-tencent-create-release-implementation-contract.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"atomic","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-cloud-cleanup-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-production-cloud-topology-contract.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"atomic","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-readiness-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-package-c-live-canary-live-runner-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-package-c-postgres-ledger-sink-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-package-d-in-cluster-runner-manifest-materialization-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-real-opl-webui-runtime-bridge-flow.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"atomic","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-deploy-execution-config-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-resource-lifecycle-dry-run-plan-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tke-bootstrap-preflight-local-gate.mjs", {"surface":"cloud","category":"cloud-future-authorized","entryKind":"gate-self-test","verifySuites":["cloud-future-authorized"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-official-sdk-provider-strategy-contract.mjs", {"surface":"cloud","category":"real-cloud-readiness","entryKind":"atomic","lifecycleRole":"real-cloud-readiness-boundary","verifySuites":["real-cloud-readiness"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-boundary.mjs", {"surface":"cloud","category":"real-cloud-readiness","entryKind":"atomic","lifecycleRole":"real-cloud-readiness-boundary","verifySuites":["real-cloud-readiness"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-live-runner-local-gate.mjs", {"surface":"cloud","category":"real-cloud-readiness","entryKind":"gate-self-test","lifecycleRole":"real-cloud-readiness-boundary","verifySuites":["real-cloud-readiness"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs", {"surface":"cloud","category":"real-cloud-readiness","entryKind":"atomic","lifecycleRole":"real-cloud-readiness-boundary","verifySuites":["real-cloud-readiness"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-inventory-official-sdk-wrapper-local-gate.mjs", {"surface":"cloud","category":"real-cloud-readiness","entryKind":"gate-self-test","lifecycleRole":"real-cloud-readiness-boundary","verifySuites":["real-cloud-readiness"]}],
  ["tests/future-authorized/cloud/future-authorized-test-v22-tencent-tc3-diagnostic-cleanup-plan.mjs", {"surface":"cloud","category":"real-cloud-readiness","entryKind":"atomic","lifecycleRole":"real-cloud-readiness-boundary","verifySuites":["real-cloud-readiness"]}],
  ["tests/health/health-check-v22-contract-conflict-boundary.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"atomic","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-line-budget-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-repo-bloat-audit-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-repo-hygiene-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-smoke-classification-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-smoke-eval-boundary.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"atomic","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-workflow-command-reference-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-workflow-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/health/health-check-v22-zero-compat-active-surface-gate.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"gate-self-test","verifySuites":["health","local-contract"]}],
  ["tests/regression/opl/regression-test-v22-gateway-live-probe.mjs", {"surface":"opl","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-local-portal-gateway-runtime-rc.mjs", {"surface":"opl","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs", {"surface":"opl","category":"opl-local","entryKind":"gate-self-test","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-opl-web-gateway-direct-entry.mjs", {"surface":"opl","category":"opl-local","entryKind":"gate-self-test","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-opl-web-gateway-launch.mjs", {"surface":"opl","category":"opl-local","entryKind":"gate-self-test","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-opl-web-gateway-native-login.mjs", {"surface":"opl","category":"opl-local","entryKind":"gate-self-test","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-opl-web-gateway-websocket-reset-contract.mjs", {"surface":"opl","category":"opl-local","entryKind":"gate-self-test","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-opl-work-message-file-run-flow.mjs", {"surface":"opl","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/opl/regression-test-v22-real-opl-file-run-artifact-gates.mjs", {"surface":"opl","category":"opl-local","entryKind":"gate-self-test","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-admin-ops-console-boundary.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-contract-role-consolidation.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-dev-server-auth-proxy.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-figma-make-interaction-readiness.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-frontend-api-surface-alignment.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-frontend-surface-composables.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-local-api-action-browser.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-mobile-table-usability.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-mobile-usability.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-package-surface-isolation.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-role-surface-boundaries.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-runtime-suite.mjs", {"surface":"portal","category":"portal-local","entryKind":"suite-wrapper","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-portal-workbench-management-ui-browser.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-retire-legacy-resource-user-surface.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/runtime-bridge/regression-test-v22-opl-acp-runtime-bridge.mjs", {"surface":"runtime-bridge","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/runtime-bridge/regression-test-v22-opl-runtime-bridge-bootstrap.mjs", {"surface":"runtime-bridge","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-launch-mutation-owner-isolation.mjs", {"surface":"runtime-bridge","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-local-fake-probe.mjs", {"surface":"runtime-bridge","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/regression/runtime-bridge/regression-test-v22-runtime-bridge-state-store-atomic-flow.mjs", {"surface":"runtime-bridge","category":"opl-local","entryKind":"atomic","verifySuites":["local-regression"]}],
  ["tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-mvp-managed-opl-loop-contract.mjs", {"surface":"opl","category":"opl-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-mvp-user-loop-contract.mjs", {"surface":"control-plane","category":"default/local-contract","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-portal-files-billing-trace-flow.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs", {"surface":"opl","category":"opl-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-pricing-plan-contract.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-resource-plan-contract.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs", {"surface":"runtime-bridge","category":"opl-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs", {"surface":"portal","category":"portal-local","entryKind":"atomic","verifySuites":["smoke"]}],
  ["tests/smoke/smoke-test-v22-user-credit-provider-key-flow.mjs", {"surface":"opl","category":"opl-local","entryKind":"atomic","verifySuites":["smoke"]}],
]));

const LANE_DEFS = Object.freeze([
  { lane: "health", files: HEALTH_FILES, tier: "health-check", authorization: "none" },
  { lane: "smoke", files: SMOKE_FILES, tier: "smoke-golden", authorization: "none" },
  { lane: "contract", files: CONTRACT_FILES, tier: "contract-local", authorization: "none" },
  { lane: "regression-portal", files: REGRESSION_PORTAL_FILES, tier: "local-regression", authorization: "none" },
  { lane: "regression-opl", files: REGRESSION_OPL_FILES, tier: "local-regression", authorization: "none" },
  { lane: "regression-runtime-bridge", files: REGRESSION_RUNTIME_BRIDGE_FILES, tier: "local-regression", authorization: "none" },
  { lane: "real-cloud-readiness", files: REAL_CLOUD_READINESS_FILES, tier: "real-cloud-readiness", authorization: "none" },
  { lane: "future-authorized", files: FUTURE_AUTHORIZED_FILES, tier: "future-authorized", authorization: "future-authorized" },
]);

function normalizeSmokeScriptPath(scriptPath) {
  return String(scriptPath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
}

function listTestFiles(dir = path.join(repoRoot, "tests"), prefix = "tests") {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTestFiles(absolutePath, repoPath));
    if (entry.isFile() && /\.mjs$/u.test(entry.name)) files.push(repoPath);
  }
  return files.sort();
}

function exists(repoPath) {
  try {
    return statSync(path.join(repoRoot, repoPath)).isFile();
  } catch {
    return false;
  }
}

function idForFile(file) {
  return file.replace(/^tests\//u, "").replace(/\.mjs$/u, "").replace(/[^a-zA-Z0-9]+/gu, "-").replace(/^-|-$/gu, "");
}

function entryForFile(file, laneDef) {
  const override = REGISTRY_OVERRIDES.get(file) || {};
  const entryKind = override.entryKind || "atomic";
  const surface = override.surface || "control-plane";
  const ownerSurface = override.ownerSurface || `surface:${surface}`;
  const lifecycleRole = override.lifecycleRole || lifecycleRoleForEntry({ authorization: laneDef.authorization, entryKind });
  return Object.freeze({
    id: idForFile(file),
    file,
    lane: laneDef.lane,
    category: override.category || "default/local-contract",
    tier: laneDef.tier,
    surface,
    entryKind,
    authorization: laneDef.authorization,
    ownerSurface,
    lifecycleRole,
    contracts: Object.freeze(["docs/specs/README.md"]),
    verifySuites: Object.freeze(override.verifySuites || []),
  });
}

function lifecycleRoleForEntry({ authorization, entryKind }) {
  if (authorization === "future-authorized") return "future-authorized-boundary";
  if (entryKind === "suite-wrapper") return "suite-wrapper";
  if (entryKind === "gate-self-test") return "negative-retirement-guard";
  return "current-owner";
}

export const TEST_LANE_REGISTRY = Object.freeze(LANE_DEFS.flatMap((laneDef) => laneDef.files.map((file) => entryForFile(file, laneDef))));

const registryByFile = Object.freeze(new Map(TEST_LANE_REGISTRY.map((entry) => [entry.file, entry])));

export const TEST_LANE_SUITES = Object.freeze({
  current: Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("current")).map((entry) => entry.file).sort()),
  health: Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("health")).map((entry) => entry.file).sort()),
  smoke: Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("smoke")).map((entry) => entry.file).sort()),
  "local-contract": Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("local-contract")).map((entry) => entry.file).sort()),
  "local-regression": Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("local-regression")).map((entry) => entry.file).sort()),
  "real-cloud-readiness": Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("real-cloud-readiness")).map((entry) => entry.file).sort()),
  "cloud-future-authorized": Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("cloud-future-authorized")).map((entry) => entry.file).sort()),
  review: Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.includes("review")).map((entry) => entry.file).sort()),
});

export const HEALTH_CHECK_SCRIPTS = Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.tier === "health-check").map((entry) => entry.file).sort());
export const SMOKE_GOLDEN_SCRIPTS = Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.tier === "smoke-golden").map((entry) => entry.file).sort());
export const SMOKE_SUITE_ENTRYPOINTS = Object.freeze(TEST_LANE_REGISTRY.filter((entry) => entry.entryKind === "suite-wrapper").map((entry) => entry.file).filter(exists).sort());
export const SMOKE_CLASSIFICATION = Object.freeze(Object.fromEntries(TEST_LANE_REGISTRY.map((entry) => [entry.file, entry.category])));

export function smokeCategoryOf(scriptPath) {
  return SMOKE_CLASSIFICATION[normalizeSmokeScriptPath(scriptPath)] || "";
}

export function smokeEvalMetadataOf(scriptPath) {
  const normalized = normalizeSmokeScriptPath(scriptPath);
  const entry = registryByFile.get(normalized);
  if (!entry) {
    return Object.freeze({
      scriptPath: normalized,
      category: "",
      tier: "",
      surface: "",
      entryKind: "",
      authorization: "",
      ownerSurface: "",
      lifecycleRole: "",
      contractRefs: Object.freeze([]),
    });
  }
  return Object.freeze({
    scriptPath: normalized,
    category: entry.category,
    tier: entry.tier,
    surface: entry.surface,
    entryKind: entry.entryKind,
    authorization: entry.authorization,
    ownerSurface: entry.ownerSurface,
    lifecycleRole: entry.lifecycleRole,
    contractRefs: Object.freeze([...entry.contracts]),
  });
}

export function listClassifiedSmokeScripts({ categories = SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return TEST_LANE_REGISTRY.filter((entry) => allowed.has(entry.category)).map((entry) => entry.file).sort();
}

export function listSmokeEvalScripts({ tiers = SMOKE_EVAL_TIERS, surfaces = SMOKE_EVAL_SURFACES } = {}) {
  const allowedTiers = new Set(tiers);
  const allowedSurfaces = new Set(surfaces);
  return TEST_LANE_REGISTRY
    .filter((entry) => allowedTiers.has(entry.tier) && allowedSurfaces.has(entry.surface))
    .map((entry) => entry.file)
    .sort();
}

export function isSmokeClassifiedIn(scriptPath, { categories = DEFAULT_SMOKE_CATEGORIES } = {}) {
  const allowed = new Set(categories);
  return allowed.has(smokeCategoryOf(scriptPath));
}

export function listRegisteredTestFiles() {
  return TEST_LANE_REGISTRY.map((entry) => entry.file).sort();
}

export async function assertTestLaneCoverage() {
  const actual = listTestFiles().filter((file) => !file.startsWith("tests/fixtures/"));
  const registered = listRegisteredTestFiles();
  const missing = actual.filter((file) => !registered.includes(file));
  const extra = registered.filter((file) => !actual.includes(file));
  const duplicates = registered.filter((file, index) => registered.indexOf(file) !== index);
  const orphaned = TEST_LANE_REGISTRY.filter((entry) => entry.verifySuites.length === 0).map((entry) => entry.file);
  const invalid = TEST_LANE_REGISTRY.filter((entry) => (
    !TEST_LANES.includes(entry.lane)
    || !SMOKE_CATEGORIES.includes(entry.category)
    || !SMOKE_EVAL_TIERS.includes(entry.tier)
    || !SMOKE_EVAL_SURFACES.includes(entry.surface)
    || !SMOKE_EVAL_ENTRY_KINDS.includes(entry.entryKind)
    || !SMOKE_EVAL_AUTHORIZATIONS.includes(entry.authorization)
    || !entry.ownerSurface
    || !SMOKE_EVAL_LIFECYCLE_ROLES.includes(entry.lifecycleRole)
    || !entry.contracts.includes("docs/specs/README.md")
  )).map((entry) => entry.file);
  return Object.freeze({
    ok: missing.length === 0 && extra.length === 0 && duplicates.length === 0 && orphaned.length === 0 && invalid.length === 0,
    missing,
    extra,
    duplicates,
    orphaned,
    invalid,
  });
}
