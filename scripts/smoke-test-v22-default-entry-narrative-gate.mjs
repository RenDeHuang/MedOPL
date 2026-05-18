import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const filePaths = {
  readme: "README.md",
  product: "docs/product.md",
  architecture: "docs/architecture.md",
  productCompose: "compose.product.yaml",
  repoZoning: "docs/recovery/repo-zoning.md",
  legacyBacklog: "docs/recovery/legacy-cleanup-backlog.md",
};

const allowedDiffPaths = new Set([
  ".env.demo.template",
  "README.md",
  "docs/product.md",
  "docs/architecture.md",
  "compose.product.yaml",
  "docs/recovery/repo-zoning.md",
  "docs/recovery/legacy-cleanup-backlog.md",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "scripts/smoke-test-v22-env-template-default-entry.mjs",
]);

const branchScopedAllowedDiffPaths = new Map([
  ["cleanup/v22-goal-control-plane-current-truth", new Set([
    "docs/recovery/v22-codex-goal-loop.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-current.json",
    "docs/recovery/v22-goal-leaf-manifest.schema.json",
    "docs/recovery/v22-goal-state.md",
    "docs/recovery/v22-product-completion-scoreboard.json",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-goal-state-consistency.mjs",
    "scripts/smoke-test-v22-product-goal-execution-order.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-product-goal-dependency-ordering", new Set([
    "docs/recovery/v22-codex-goal-loop.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-product-goal-execution-order.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["feat/v22-opl-productionization-local-implementation", new Set([
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
  ])],
  ["docs/v22-advance-opl-productionization-eval-shell-cursor", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-opl-productionization-eval-shell", new Set([
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["docs/v22-advance-opl-productionization-cursor", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-frontend-product-evalset-gap", new Set([
    "docs/contracts/v22-portal-workbench-management-ui-composition-boundary.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-backend-contract-eval-template", new Set([
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-billing-audit-characterization", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-release-readiness-auth-boundary", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["test/v22-release-readiness-authorized-blocker", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["docs/v22-record-release-readiness-authorized-blocker-b-result", new Set([
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["docs/v22-record-billing-audit-b-absorb", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["docs/v22-record-backend-template-b-absorb", new Set([
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["docs/v22-advance-frontend-evalset-cursor", new Set([
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-product-goal-harness", new Set([
    "docs/recovery/v22-product-goal.md",
    "docs/recovery/v22-product-e2e-contract.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-codex-goal-loop.md",
    "docs/recovery/v22-ai-frontend-backend-development-framework.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-product-goal-loop-budget-10", new Set([
    "docs/recovery/v22-codex-goal-loop.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-secret-hygiene-diff-scan-eval-shell", new Set([
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-ai-frontend-backend-development-framework.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs",
  ])],
  ["cleanup/v22-legacy-scripts-archive-eval-shell", new Set([
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
  ])],
  ["cleanup/v22-cleanup-completion-truth", new Set([
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-current.json",
    "docs/recovery/v22-goal-leaf-manifest.schema.json",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-cleanup-completion-truth.mjs",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-goal-state-consistency.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
  ])],
  ["refactor/v22-portal-layering-characterization-gate", new Set([
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["contract/v22-opl-productionization-contract-refresh", new Set([
    "docs/contracts/v22-portal-opl-connection-boundary.md",
    "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
    "docs/recovery/mvp-contract-acceptance.md",
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-resource-order-store-postgres-schema-eval-shell", new Set([
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  ])],
  ["cleanup/v22-resource-order-store-postgres-schema-implementation", new Set([
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    "services/portal/src/state/portal-store-db-delegates.mjs",
    "services/portal/src/state/portal-store-postgres-persistence.mjs",
    "services/portal/src/state/portal-store-runtime-connections.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store.mjs",
  ])],
  ["recovery/platform-v22-trunk", new Set([
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/contracts/v22-portal-opl-connection-boundary.md",
    "docs/contracts/v22-real-opl-file-run-artifact-canary-boundary.md",
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/mvp-contract-acceptance.md",
    "docs/recovery/real-opl-file-run-artifact-validation-path.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-ai-frontend-backend-development-framework.md",
    "docs/recovery/v22-current-vs-ideal-gap-matrix.md",
    "docs/recovery/v22-goal-state.md",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/smoke-test-v22-opl-productionization-contract-refresh.mjs",
    "scripts/smoke-test-v22-opl-productionization-eval-shell.mjs",
    "scripts/smoke-test-v22-release-readiness-auth-boundary.mjs",
    "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
    "scripts/smoke-test-v22-portal-structure-failure-isolation-contract.mjs",
    "scripts/smoke-test-v22-product-goal-harness.mjs",
    "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
    "scripts/smoke-test-v22-diff-scoped-sensitive-hygiene.mjs",
    "services/opl-runtime-bridge/src/runtime-agent-http-relay.mjs",
    "services/portal/src/state/portal-store-db-delegates.mjs",
    "services/portal/src/state/portal-store-postgres-persistence.mjs",
    "services/portal/src/state/portal-store-runtime-connections.mjs",
    "services/portal/src/state/portal-store-storage-bootstrap.mjs",
    "services/portal/src/state/portal-store.mjs",
  ])],
  ["cleanup/v22-retire-user-owned-primary-path", new Set([
    "docs/recovery/status-matrix.md",
    "services/portal/src/app/portal-admin-api-payloads.mjs",
    "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
    "services/portal/src/app/portal-admin-portrait-payloads.mjs",
    "services/portal/src/config/portal-config.mjs",
    "services/portal/src/domain/platform-provisioned-resources.mjs",
    "services/portal/src/routes/admin-api.routes.mjs",
    "services/portal/src/routes/platform-provisioned-resource.routes.mjs",
    "services/portal/src/routes/portal-api.routes.mjs",
    "services/portal/src/routes/user-owned-resource.routes.mjs",
    "services/portal/src/state/portal-platform-provisioned-resource-store.mjs",
  ])],
  ["cleanup/v22-physical-legacy-goal", new Set([
    "docs/recovery/physical-legacy-file-retirement-goal.md",
    "docs/recovery/physical-legacy-file-retirement-inventory.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/architecture-truth.md",
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
    "scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
    "scripts/smoke-test-v22-physical-delete-user-owned-retired-domain-store.mjs",
    "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
    "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
    "scripts/smoke-test-v22-repo-zoning-boundary.mjs",
    "services/portal/src/domain/user-owned-resources.mjs",
    "services/portal/src/state/portal-user-owned-resource-store.mjs",
  ])],
  ["cleanup/v22-retire-resource-order-route-tombstones", new Set([
    "services/portal/src/routes/resource-order.routes.mjs",
    "services/portal/src/routes/resource-order-public.routes.mjs",
    "services/portal/src/routes/resource-order-internal.routes.mjs",
    "services/portal/src/routes/resource-order-public-delete.routes.mjs",
    "services/portal/src/routes/resource-order-provisioning-service.mjs",
    "services/portal/src/routes/resource-order-route-support.mjs",
  ])],
  ["cleanup/v22-retire-resource-order-billing-payloads", new Set([
    "services/portal/src/domain/wallet-ledger.mjs",
    "services/portal/src/domain/user-resource-bindings.mjs",
    "services/portal/src/app/portal-page-overview-payloads.mjs",
    "services/portal/src/app/portal-page-payload-helpers.mjs",
    "services/portal/src/app/portal-page-runtime-payloads.mjs",
    "services/portal/src/app/portal-page-workspace-payloads.mjs",
    "services/portal/src/domain/portal-api-payloads.mjs",
    "services/portal/src/domain/lab-entitlements.mjs",
    "services/portal/src/domain/lab-billing-policy.mjs",
    "services/portal/src/domain/workspace-storage.mjs",
  ])],
  ["cleanup/v22-retire-resource-order-store-admin-frontend", new Set([
    "services/portal/src/app/portal-admin-api-payload-helpers.mjs",
    "services/portal/src/app/portal-admin-api-payloads.mjs",
    "services/portal/src/app/portal-admin-overview-runtime-payloads.mjs",
    "services/portal/src/app/portal-module-source-payloads.mjs",
    "services/portal/src/state/portal-store-health.mjs",
    "services/portal/frontend/src/api/portal/overview.ts",
    "services/portal/frontend/src/api/portal/resources.ts",
    "services/portal/frontend/src/api/portal/traces.ts",
    "services/portal/frontend/src/api/portal/workspace.ts",
    "scripts/smoke-test-v22-admin-ops-console-readonly-mvp.mjs",
    "scripts/smoke-test-v22-portal-admin-shared-helper-structure.mjs",
    "scripts/smoke-test-v22-portal-mobile-table-usability.mjs",
  ])],
]);

const branchScopedAllowedDiffPatterns = new Map([
  ["cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement", [
    "docs/contracts/README.md",
    "docs/contracts/v22-admin-ops-console-boundary.md",
    "docs/contracts/v22-authorized-tencent-create-release-boundary.md",
    "docs/contracts/v22-authorized-tencent-create-release-execution-boundary.md",
    "docs/contracts/v22-portal-admin-ops-surface-boundary.md",
    "docs/contracts/v22-portal-structure-failure-isolation-boundary.md",
    "docs/contracts/v22-portal-user-surface-boundary.md",
    "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
    "docs/contracts/v22-tencent-readonly-inventory-boundary.md",
    "docs/recovery/*",
    "scripts/smoke-test-v22-*",
    "scripts/v22-tencent-readonly-inventory-runner.mjs",
    "scripts/v22-verify.mjs",
    "scripts/v22-workflow-gate.mjs",
    "scripts/check-v18-*",
    "scripts/check-v20*",
    "scripts/check-v21-*",
    "scripts/daily-check-v19-*",
    "scripts/live-prepare-v19-*",
    "scripts/load-test-v13-*",
    "scripts/analyze-v21-*",
    "scripts/install-opencost-local.ps1",
    "scripts/start-opencost-*",
    "scripts/start-billing-live.mjs",
    "scripts/start-portal-live.mjs",
    "scripts/smoke-test-v13-*",
    "scripts/smoke-test-v19-*",
    "scripts/smoke-test-v20*",
    "scripts/smoke-test-v21-*",
    "scripts/smoke-test-billing-*",
    "scripts/smoke-test-med-*",
    "scripts/smoke-test-opl-launch-adapter.mjs",
    "scripts/smoke-test-platform-nodepool-isolation-contract.mjs",
    "scripts/smoke-test-portal-async-provision.mjs",
    "scripts/smoke-test-portal-billing-export-routes-contract.mjs",
    "scripts/smoke-test-portal-http-dispatcher-contract.mjs",
    "scripts/smoke-test-portal-opl-adapter*.mjs",
    "scripts/smoke-test-portal-opl-web-hard-loop.mjs",
    "scripts/smoke-test-portal-page-payloads-contract.mjs",
    "scripts/smoke-test-portal-resource-*.mjs",
    "scripts/smoke-test-portal-runtime-bootstrap-contract.mjs",
    "scripts/smoke-test-portal-store-structure-contract.mjs",
    "scripts/smoke-test-resource-*.mjs",
    "scripts/smoke-test-secret-hygiene-manifests.mjs",
    "scripts/smoke-test-server-plan-runtime-chain.mjs",
    "scripts/smoke-test-tke-manifest-renderer-contract.mjs",
    "scripts/fixtures/med-autoscience-runner-fixture.mjs",
    "scripts/fixtures/portal-internal-resource-order-fixture.mjs",
    "scripts/lib/v19-*",
    "scripts/lib/v20.33-evidence.mjs",
    "services/portal/src/app/portal-feature-runtime-handlers.mjs",
    "services/portal/src/app/portal-http-dispatcher.mjs",
    "services/portal/src/app/portal-runtime*.mjs",
    "services/portal/src/app/portal-store-runtime.mjs",
    "services/portal/src/app/portal-page-workspace-payloads.mjs",
    "services/portal/src/config/portal-config.mjs",
    "services/portal/src/domain/lab-billing-policy.mjs",
    "services/portal/src/domain/lab-entitlements.mjs",
    "services/portal/src/domain/platform-provisioned-resources.mjs",
    "services/portal/src/domain/portal-api-payloads.mjs",
    "services/portal/src/domain/resource-order*.mjs",
    "services/portal/src/domain/tencent-readonly-inventory-provider.mjs",
    "services/portal/src/domain/user-resource-bindings.mjs",
    "services/portal/src/domain/wallet-ledger.mjs",
    "services/portal/src/domain/workspace-storage.mjs",
    "services/portal/src/integrations/langfuse-trace-client.mjs",
    "services/portal/src/integrations/resource-provisioner-client.mjs",
    "services/portal/src/routes/portal-api.routes.mjs",
    "services/portal/src/routes/portal-billing-export.routes.mjs",
    "services/portal/src/routes/resource-order*.mjs",
    "services/portal/src/routes/user-owned-resource.routes.mjs",
    "services/portal/src/state/portal-*.mjs",
    "services/portal/frontend/src/api/portal/resources.ts",
    "services/portal/frontend/src/api/portal/workspace.ts",
    "adapters/resource-provisioner/**",
    "adapters/med-autoscience-runner/**",
    "adapters/cloud-provisioner/**",
    "adapters/shared/**",
    "deploy/tke-package/**",
    "deploy/local/dockerfiles/resource-provisioner.Dockerfile",
    "deploy/local/dockerfiles/med-autoscience-runner.Dockerfile",
    "infra/opencost/**",
    "infra/kubernetes/**",
    "infra/codex-runtime/**",
    "infra/production-hardening/**",
    "compose.demo.yaml",
    "compose.langfuse.yaml",
  ]],
  ["cleanup/v22-strict-monolith-residual-test-anchor-retirement", [
    "docs/recovery/legacy-cleanup-backlog.md",
    "docs/recovery/physical-legacy-file-retirement-inventory.md",
    "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
    "docs/recovery/repo-zoning.md",
    "docs/recovery/status-matrix.md",
    "docs/recovery/v22-agent-verify-manifest.json",
    "docs/recovery/v22-program-board.md",
    "scripts/install-harbor-local.ps1",
    "scripts/install-minio-local.ps1",
    "scripts/start-minio-port-forward.ps1",
    "scripts/start-opl-web-runtime.mjs",
    "scripts/smoke-test-billing-*.mjs",
    "scripts/smoke-test-portal-*.mjs",
    "scripts/smoke-test-v22-admin-ops-console-readonly-mvp.mjs",
    "scripts/smoke-test-v22-agent-verify-entrypoint.mjs",
    "scripts/smoke-test-v22-legacy-script-archive-boundary.mjs",
    "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "scripts/smoke-test-v22-portal-api-auth-boundary.mjs",
    "scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
    "scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
    "scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
    "scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs",
    "scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs",
    "scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-wrapper.mjs",
    "scripts/v22-tencent-readonly-inventory-runner.mjs",
    "scripts/v22-verify.mjs",
  ]],
  ["cleanup/v22-strict-monolith-zero-compat-active-surface", [
    "docs/recovery/*",
    "docs/contracts/README.md",
    "docs/contracts/v22-*",
    "scripts/smoke-test-v22-*",
    "scripts/v22-verify.mjs",
    "scripts/v22-agent-workflow.mjs",
    "scripts/v22-cloud-operation-local-executor.mjs",
    "scripts/v22-workflow-gate.mjs",
    "scripts/v22-tencent-readonly-inventory-runner.mjs",
    "services/portal/src/**",
    "services/opl-web-gateway/src/**",
    "services/opl-runtime-bridge/src/**",
  ]],
  ["cleanup/v22-zero-compat-contract-smoke-physical-retirement", [
    "OPL-v20-*",
    "docs/status.md",
    "docs/contracts/v22-*",
    "docs/recovery/*",
    "docs/plan/**",
    "docs/reports/**",
    "docs/releases/**",
    "docs/logs/**",
    "docs/operations/**",
    "docs/superpowers/**",
    "scripts/fixtures/opl-product-api-fixture.mjs",
    "scripts/smoke-test-v22-*",
    "scripts/v22-smoke-classification.mjs",
    "scripts/v22-verify.mjs",
    "services/portal/src/migrate-schema.mjs",
    "services/portal/src/portal-cloud-operation-worker.mjs",
    "services/portal/src/app/portal-auth-runtime-handler.mjs",
    "services/portal/src/app/portal-http-dispatcher.mjs",
    "services/portal/src/app/portal-workspace-runtime.mjs",
    "services/portal/src/app/portal-runtime-observability.mjs",
    "services/portal/src/app/portal-page-overview-payloads.mjs",
    "services/portal/src/app/portal-page-payload-helpers.mjs",
    "services/portal/src/app/portal-page-workspace-payloads.mjs",
    "services/portal/src/app/portal-server-plan-runtime-handler.mjs",
    "services/portal/src/domain/**",
    "services/portal/src/routes/**",
    "services/portal/src/state/**",
    "services/portal/src/state/portal-platform-provisioned-resource-store.mjs",
    "services/portal/frontend/src/**",
    "services/opl-web-gateway/src/**",
    "services/opl-runtime-bridge/src/**",
  ]],
  ["cleanup/v22-system-domain-truth-layer-zero-old-context", [
    "README.md",
    "docs/product.md",
    "docs/architecture.md",
    "docs/contracts/README.md",
    "docs/contracts/v22-*",
    "docs/deployment/docker-product-appliance.md",
    "docs/recovery/*",
    "scripts/acceptance-portal-console.mjs",
    "scripts/check-commercial-blockers.mjs",
    "scripts/smoke-test-opl-*.mjs",
    "scripts/smoke-test-v22-*",
    "scripts/smoke-test-workspace-lifecycle.mjs",
    "services/portal/**",
    "services/opl-web-gateway/**",
    "services/opl-runtime-bridge/**",
  ]],
]);

function globToRegExp(pattern) {
  const escapedParts = String(pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${escapedParts.join(".*")}$`, "u");
}

const forbiddenDefaultEntryTerms = [
  "opl-v19-product-appliance",
  "opl-v19/",
  "PRODUCT_RUNTIME_MODE\": \"user_owned",
  "PRODUCT_RUNTIME_MODE=user_owned",
  "MED_AUTOSCIENCE_RUNNER_URL",
  "MED_AUTOSCIENCE_RUNNER_TOKEN",
  "MED_AUTOSCIENCE_RUNNER_IMAGE",
  "K8S_NAMESPACE",
  "RESOURCE_PROVISIONER_URL",
  "RESOURCE_PROVISIONER_IMAGE",
  "resource-provisioner",
  "med-autoscience-runner",
  "deploy/local/dockerfiles/",
  "adapters/",
  "OPENCOST_BASE_URL",
  "opencost",
  "LANGFUSE_IMAGE",
  "LANGFUSE_WORKER_IMAGE",
];

const forbiddenComposeServiceNames = [
  "portal-opl-adapter",
  "portal-opl-adapter-dev",
  "resource-provisioner",
  "resource-provisioner-dev",
  "med-autoscience-runner",
  "med-autoscience-runner-dev",
  "billing-aggregator",
  "billing-aggregator-dev",
];

const zeroCompatDeletedLegacyLocalScriptPaths = new Set([
  "scripts/smoke-test-no-legacy-billing-paths.mjs",
  "scripts/smoke-test-v11-cloud-status-ui-contract.mjs",
  "scripts/v22-tencent-authorized-deploy-execution-runner.mjs",
  "scripts/v22-tencent-authorized-resource-lifecycle-live-sequence.mjs",
  "scripts/v22-tencent-authorized-resource-lifecycle-node-pool-snapshot.mjs",
  "scripts/v22-tencent-authorized-resource-lifecycle-runner.mjs",
]);

const secretLikeValuePatterns = [
  /sk-[A-Za-z0-9_-]{16,}/u,
  /gh[pousr]_[A-Za-z0-9_]{16,}/u,
  /github_pat_[A-Za-z0-9_]{16,}/u,
  /AKID[A-Za-z0-9]{12,}/u,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /x-access-token[:=][A-Za-z0-9._-]+/iu,
  /Bearer\s+[A-Za-z0-9._-]{20,}/u,
  /^(?:SecretId|SecretKey|TENCENT_[A-Z_]*SECRET[A-Z_]*|LANGFUSE_SECRET_KEY|ZITADEL_ADMIN_BEARER_TOKEN)[ \t]*=[ \t]*[^#\s$][^\r\n#]*/mu,
];

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertDoesNotInclude(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

function changedFilesFromBase() {
  const outputs = [
    ["diff", "--name-only", "origin/recovery/platform-v22-trunk"],
    ["ls-files", "--others", "--exclude-standard"],
  ].map((args) => {
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 0, `git_${args.join("_")}_failed:${result.stderr || result.stdout}`);
    return result.stdout;
  });
  return [...new Set(outputs
    .flatMap((output) => output.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)))];
}

function isDeletedFromBase(filePath) {
  const result = spawnSync("git", ["-c", "core.quotepath=false", "diff", "--name-status", "origin/recovery/platform-v22-trunk", "--", filePath], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_diff_name_status_failed:${filePath}:${result.stderr || result.stdout}`);
  return result.stdout.split(/\r?\n/u).some((line) => line.trim().startsWith("D\t"));
}

function currentBranchName() {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `git_branch_show_current_failed:${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function parseCompose(source) {
  try {
    return JSON.parse(source);
  } catch (error) {
    assert.fail(`compose_product_must_remain_strict_json:${error.message}`);
  }
}

function assertOnlyAllowedFilesChanged() {
  const branchName = currentBranchName();
  const branchAllowedDiffPaths = branchScopedAllowedDiffPaths.get(branchName) ?? new Set();
  const branchAllowedDiffPatterns = (branchScopedAllowedDiffPatterns.get(branchName) ?? []).map(globToRegExp);
  for (const filePath of changedFilesFromBase()) {
    if (
      branchName === "cleanup/v22-strict-monolith-zero-compat-active-surface" &&
      (filePath.startsWith("adapters/billing-aggregator/") || filePath.startsWith("deploy/local/dockerfiles/")) &&
      isDeletedFromBase(filePath)
    ) {
      continue;
    }
    if (
      branchName === "cleanup/v22-strict-monolith-zero-compat-active-surface" &&
      zeroCompatDeletedLegacyLocalScriptPaths.has(filePath) &&
      isDeletedFromBase(filePath)
    ) {
      continue;
    }
    assert(
      allowedDiffPaths.has(filePath) || branchAllowedDiffPaths.has(filePath) || branchAllowedDiffPatterns.some((pattern) => pattern.test(filePath)),
      `default_entry_branch_modified_unsubscribed_file:${filePath}`,
    );
  }
}

function assertDefaultTruthDocs({ readme, product, architecture }) {
  for (const [label, source] of Object.entries({ readme, product, architecture })) {
    assertIncludes(source, "One Person Lab", `${label}_one_person_lab_truth`);
    assertIncludes(source, "开箱即用 SaaS 托管科研工作台", `${label}_managed_workbench_truth`);
    assertIncludes(source, "不是云资源控制台", `${label}_not_cloud_console_truth`);
    assertIncludes(source, "不是用户自配云资源", `${label}_not_user_configured_cloud_truth`);
  }

  assertIncludes(readme, "默认入口", "readme_default_entry_section");
  assertIncludes(readme, "Portal “进入 OPL 工作台”", "readme_portal_opl_entry");
  assertIncludes(readme, "/opl/entry/preflight", "readme_preflight_entry");
  assertIncludes(readme, "scripts/smoke-test-v22-default-entry-narrative-gate.mjs", "readme_default_entry_gate");

  assertIncludes(product, "Portal “进入 OPL 工作台”", "product_portal_opl_entry");
  assertIncludes(product, "/opl/entry/preflight", "product_preflight_entry");

  assertIncludes(architecture, "Portal -> OPL Web Gateway -> clean One Person Lab upstream", "architecture_default_chain");
  assertIncludes(architecture, "platform-provisioned / customer-dedicated", "architecture_platform_provisioned_truth");
}

function assertNoSecretLikeValues(source, label) {
  for (const pattern of secretLikeValuePatterns) {
    assert.doesNotMatch(source, pattern, `${label}_must_not_contain_secret_like_value:${pattern.source}`);
  }
}

function assertComposeBoundary(source) {
  for (const forbidden of forbiddenDefaultEntryTerms) {
    assertDoesNotInclude(source, forbidden, "compose_product_default_entry");
  }

  const compose = parseCompose(source);
  assert.equal(compose.name, "medopl-v22-managed-workbench", "compose_product_name_must_be_v22");
  assert(compose.services, "compose_product_services_missing");
  for (const serviceName of forbiddenComposeServiceNames) {
    assert.equal(
      Object.hasOwn(compose.services, serviceName),
      false,
      `compose_product_must_not_define_legacy_service:${serviceName}`,
    );
  }

  const allowedServiceNames = [
    "portal",
    "runtime-bridge",
    "opl-web-gateway",
    "opl-web",
    "portal-dev",
    "runtime-bridge-dev",
    "opl-web-gateway-dev",
    "postgres",
    "redis",
  ];
  for (const serviceName of Object.keys(compose.services)) {
    assert(
      allowedServiceNames.includes(serviceName),
      `compose_product_unexpected_default_service:${serviceName}`,
    );
  }

  for (const [serviceName, service] of Object.entries(compose.services)) {
    const profiles = service.profiles ?? [];
    assert(
      !profiles.includes("managed-runtime") && !profiles.includes("ops"),
      `compose_product_must_not_expose_legacy_profile:${serviceName}`,
    );
    const environment = service.environment ?? {};
    if (Object.hasOwn(environment, "PRODUCT_RUNTIME_MODE")) {
      assert.equal(
        environment.PRODUCT_RUNTIME_MODE,
        "platform_provisioned",
        `compose_product_runtime_mode_must_be_platform_provisioned:${serviceName}`,
      );
    }
  }
}

function assertRecoveryDocs({ repoZoning, legacyBacklog }) {
  assertIncludes(repoZoning, "default-entry cleanup completed", "repo_zoning_default_entry_completed_note");
  assertIncludes(repoZoning, "| `.env.demo.template` | Zone 2 | review/rewrite |", "repo_zoning_env_template_zone2_record");
  assertIncludes(repoZoning, "cleanup/v22-env-template-default-entry", "repo_zoning_env_template_followup_branch");
  assertIncludes(repoZoning, "secret-like path gate", "repo_zoning_env_template_secret_like_gate_record");
  assertIncludes(repoZoning, "env-template cleanup completed", "repo_zoning_env_template_completed_note");
  assertIncludes(legacyBacklog, "Default Entry Legacy Narrative", "legacy_backlog_default_entry_slice");
  assertIncludes(legacyBacklog, "completed on cleanup/v22-default-entry-legacy-narrative", "legacy_backlog_default_entry_completed_note");
  assertIncludes(legacyBacklog, ".env.demo.template", "legacy_backlog_env_template_followup_record");
  assertIncludes(legacyBacklog, "cleanup/v22-env-template-default-entry", "legacy_backlog_env_template_followup_branch");
}

const sources = Object.fromEntries(await Promise.all(
  Object.entries(filePaths).map(async ([key, filePath]) => [key, await readRepoFile(filePath)]),
));

assertOnlyAllowedFilesChanged();
assertDefaultTruthDocs(sources);
assertComposeBoundary(sources.productCompose);
assertRecoveryDocs(sources);

for (const [label, source] of Object.entries(sources)) {
  assertNoSecretLikeValues(source, label);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_default_entry_narrative_gate",
  protectedEntrypoints: [
    filePaths.readme,
    filePaths.product,
    filePaths.architecture,
    filePaths.productCompose,
  ],
  deferredEntrypoints: [
    ".env.demo.template",
  ],
  retiredDefaults: [
    "v19_v20_v21_appliance_narrative",
    "user_owned_primary_runtime_mode",
    "resource_order_primary_path",
    "resource_provisioner_default_service",
    "med_autoscience_runner_default_service",
    "deploy_adapters_default_entry",
    "opencost_langfuse_primary_product_narrative",
  ],
}, null, 2));
