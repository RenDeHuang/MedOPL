import { normalizePath } from "./git-diff.mjs";

export const forbiddenPathPatterns = [
  /^deploy(?:\/|$)/,
  /^\.sentrux(?:\/|$)/,
  /^adapters(?:\/|$)/,
  /(?:^|\/)one-person-lab(?:\/|$)/,
  /(?:^|\/)upstream(?:\/|$)/,
];

export const secretLikePathPatterns = [
  /(?:^|\/)\.env(?:\.|$)/i,
  /\.env$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.kubeconfig$/i,
  /kubeconfig/i,
  /(?:^|\/)\.kube(?:\/|$)/i,
  /secret/i,
  /secrets/i,
  /token/i,
  /(?:^|\/)github$/i,
];

export const secretLikeAddedLinePatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bOPENAI_API_KEY\s*=\s*['"]?[^'"\s]{12,}/i,
  /\b(?:SECRET_ID|SECRET_KEY|SECRETID|SECRETKEY|TENCENT_SECRET_ID|TENCENT_SECRET_KEY)\s*=\s*['"]?[^'"\s]{8,}/i,
  /\b(?:BEARER|TOKEN|API_KEY|PRIVATE_KEY)\b\s*[:=]\s*['"]?[^'"\s]{12,}/i,
  new RegExp(`-----BEGIN (?:RSA |OPENSSH |EC |DSA )?${["PRIVATE", "KEY"].join(" ")}-----`),
  /\bkubeconfig\b\s*[:=]\s*['"]?[^'"\s]{8,}/i,
];

export function isForbiddenPath(filePath) {
  const normalized = normalizePath(filePath);
  return forbiddenPathPatterns.some((pattern) => pattern.test(normalized));
}

export function isSecretLikePath(filePath) {
  const normalized = normalizePath(filePath);
  return secretLikePathPatterns.some((pattern) => pattern.test(normalized));
}

export function secretLikeAddedLinesFrom(lines) {
  return lines
    .map((line, index) => ({ index: index + 1, line }))
    .filter(({ line }) => secretLikeAddedLinePatterns.some((pattern) => pattern.test(line)))
    .map(({ index, line }) => ({
      index,
      sample: line.length > 160 ? `${line.slice(0, 160)}...` : line,
    }));
}

export function isV22EvalPath(filePath) {
  const normalized = normalizePath(filePath);
  return [
    /^tests\/smoke\/smoke-test-v22-.*\.mjs$/u,
    /^tests\/health\/health-check-v22-.*\.mjs$/u,
    /^tests\/contracts\/(?:.+\/)?contract-test-v22-.*\.mjs$/u,
    /^tests\/governance\/governance-test-v22-.*\.mjs$/u,
    /^tests\/suites\/suite-test-v22-.*\.mjs$/u,
    /^tests\/regression\/.+\/regression-test-v22-.*\.mjs$/u,
    /^tests\/cloud\/cloud-test-v22-.*\.mjs$/u,
  ].some((pattern) => pattern.test(normalized));
}

export function isServicesPath(filePath) {
  return normalizePath(filePath).startsWith("services/");
}

export function isSpecPath(filePath) {
  return normalizePath(filePath).startsWith("docs/specs/");
}

export function isChangePackagePath(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith("changes/active/")
    || normalized.startsWith("changes/archive/")
    || normalized === "changes/README.md";
}

export function isFormalEngineeringChange(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized.startsWith("services/")
    || normalized.startsWith("tests/")
    || normalized.startsWith("specs/")
    || normalized.startsWith("docs/active/")
    || normalized === "docs/specs/README.md"
    || normalized.startsWith("scripts/")
  );
}

export function isStrictMonolithCleanupAuthorizedDelete(filePath, status, branchName = "") {
  if (!String(status || "").startsWith("D")) return false;
  const normalized = normalizePath(filePath);
  if (branchName === "cleanup/v22-archive-smoke-contract-physical-retirement") {
    return [
      /^docs\/(?:plan|reports|releases|logs|operations|superpowers)(?:\/|$)/u,
      /^OPL-v20-商业化产品套餐开发方案\.md$/u,
      /^scripts\/smoke-test-v17-/u,
      /^scripts\/smoke-test-v22-(?:agent-workflow-orchestrator|cleanup-completion-truth|legacy-script-archive-boundary|opl-legacy-paths-retired|physical-delete-user-owned-retired-domain-store|physical-legacy-batch-run-manifest|physical-legacy-file-retirement-goal|physical-legacy-file-retirement-inventory|portal-retired-frontend-surface-gate|portal-ui-truth-convergence|real-opl-file-run-artifact-runtime-agent-api-loop|retire-portal-provider-key-entry|retire-resource-order-primary-path|retire-user-owned-primary-path|strict-monolith-legacy-retirement-gate|system-domain-truth-layer-zero-old-context-gate)\.mjs$/u,
    ].some((pattern) => pattern.test(normalized));
  }
  if (branchName === "cleanup/v22-strict-monolith-zero-compat-active-surface") {
    return [
      /^deploy\/local\/dockerfiles\/(?:portal|opl-web-gateway|opl-runtime-bridge)\.Dockerfile$/u,
      /^adapters\/billing-aggregator(?:\/|$)/u,
      /^services\/portal\/src\/integrations\/billing-client\.mjs$/u,
      /^scripts\/(?:smoke-test-no-legacy-billing-paths|smoke-test-v11-cloud-status-ui-contract)\.mjs$/u,
    ].some((pattern) => pattern.test(normalized));
  }
  if (branchName === "cleanup/v22-repo-governance-physical-compaction") {
    return [
      /^configs(?:\/|$)/u,
      /^scripts\/(?:check-production-entry-health|check-production-entry-performance|update-dnspod-records|smoke-test-root-dockerignore)\.mjs$/u,
      /^scripts\/fixtures\/fake-kubectl-success\.cmd$/u,
    ].some((pattern) => pattern.test(normalized));
  }
  if (branchName === "cleanup/v22-node-backend-physical-removal") {
    return [
      /^services\/portal\/src(?:\/|$)/u,
      /^tests\/fixtures\/v22\/backend-go-convergence(?:\/|$)/u,
      /^tests\/local-rc\/local-rc-test-v22-provider-bound-message-backflow\.mjs$/u,
      /^tests\/regression\/opl\/regression-test-v22-(?:opl-entry-preflight-auth-flow|opl-runtime-e2e-local-flow|portal-opl-api-runtime-loop|provider-secret-boundary-contract)\.mjs$/u,
      /^tests\/regression\/portal\/regression-test-v22-(?:account-wallet-billing-closure|admin-ops-disabled-product-state|admin-ops-local-projection-view|managed-resource-binding-plan-view|portal-admin-shared-helper-structure|portal-api-auth-boundary|portal-auth-landing-route|portal-cost-balance-trace-linkage|portal-file-space-management|portal-local-api-action-closure|portal-runtime-startup-config|portal-session-trace-view|portal-storage-mode-local-closure|portal-trace-file-linkage|portal-workbench-management-ui-api|workspace-storage-public-response)\.mjs$/u,
      /^tests\/regression\/runtime-bridge\/regression-test-v22-portal-runtime-bridge-api-local-flow\.mjs$/u,
    ].some((pattern) => pattern.test(normalized));
  }
  if (branchName === "cleanup/v22-full-taxonomy-hard-retirement") {
    return [
      /^docs\/contracts(?:\/|$)/u,
      /^docs\/recovery(?:\/|$)/u,
      /^docs\/(?:product|architecture|status|invariants|decisions|vibe-coding)\.md$/u,
      new RegExp(`^scripts/(?:${[
        ["v22", "agent", "workflow"].join("-"),
        ["v22", "cloud", "harness", "select", "checks"].join("-"),
        ["v22", "cloud", "operation", "local", "executor"].join("-"),
        ["v22", "retired", "surface", "data"].join("-"),
        ["v22", "tencent", "readonly", "inventory", "runner"].join("-"),
        ["check", "mojibake"].join("-"),
      ].join("|")})\\.mjs$`, "u"),
      /^tests\/fixtures\/v22\/(?:autonomous-goal-runner-policy|cloud-harness-manifest|goal-leaf-manifest\.schema|product-completion-scoreboard)\.json$/u,
      /^tests\/contract\/contract-test-v22-(?:agent-run-record-gate|autonomous-goal-runner|contract-eval-compaction|contract-smoke-eval-index-compaction|default-entry-narrative-gate|docs-taxonomy-skeleton|env-template-default-entry|goal-state-consistency|long-term-governance-surfaces|monolith-agent-workflow-entrypoint-and-trace-normalization|opl-style-taxonomy-hard-compaction|post-20fe9ac-agent-workflow-truth-and-repo-classification|post-merge-portal-opl-truth|product-goal-execution-order|product-goal-harness|program-board|release-readiness-auth-boundary|repo-governance-physical-compaction|repo-zoning-boundary|smoke-eval-physical-compaction|tests-taxonomy-hard-retirement|truth-freeze-physical-retirement|truth-repo-narrative-reference-unification)\.mjs$/u,
      /^tests\/health\/health-check-v22-archive-smoke-contract-physical-retirement-gate\.mjs$/u,
      /^tests\/health\/smoke-test-v22-(?:archive-smoke-contract-physical-retirement-gate|smoke-classification-gate|smoke-eval-boundary)\.mjs$/u,
      /^tests\/regression\/opl\/regression-test-v22-(?:gflabtoken-entry-contract|opl-dual-entry-contract|opl-productionization-.+|portal-opl-context-backflow-contract|real-opl-capability-contract-gate|real-opl-file-run-artifact-contract-gate|real-opl-provider-message-contract-gate)\.mjs$/u,
      /^tests\/regression\/opl\/smoke-test-v22-(?:gflabtoken-entry-contract|opl-dual-entry-contract|opl-productionization-.+|portal-opl-context-backflow-contract|real-opl-capability-contract-gate|real-opl-file-run-artifact-contract-gate|real-opl-provider-message-contract-gate)\.mjs$/u,
      /^tests\/regression\/portal\/regression-test-v22-(?:langfuse-observability-metadata-contract|observability-billing-narrative-boundary|portal-figma-make-admin-readiness|portal-figma-make-ui-implementation-contract|portal-frontend-surface-eval|portal-structure-failure-isolation-contract|portal-ui-design-quality-audit|portal-web-route-alignment|portal-workbench-management-ui-composition-contract)\.mjs$/u,
      /^tests\/regression\/portal\/smoke-test-v22-(?:admin-ops-console-readonly-mvp|langfuse-observability-metadata-contract|observability-billing-narrative-boundary|portal-figma-make-admin-readiness|portal-figma-make-ui-implementation-contract|portal-frontend-surface-eval|portal-runtime-suite|portal-structure-failure-isolation-contract|portal-ui-design-quality-audit|portal-web-route-alignment|portal-workbench-management-ui-composition-contract)\.mjs$/u,
    ].some((pattern) => pattern.test(normalized));
  }
  if (branchName !== "cleanup/v22-strict-monolith-ideal-gap-and-legacy-retirement") return false;
  return [
    /^adapters\/(?:resource-provisioner|med-autoscience-runner|cloud-provisioner|shared)(?:\/|$)/u,
    /^scripts\/(?:smoke-test-secret-hygiene-manifests|smoke-test-v20-tencent-secret-isolation-contract|smoke-test-v21-gflabtoken-login-contract)\.mjs$/u,
    /^scripts\/(?:smoke-test-billing-cos-zip-reader|smoke-test-billing-http-routes-contract|smoke-test-billing-resource-attribution|smoke-test-billing-summary-runtime-contract|smoke-test-billing-tencent-bill-summary|smoke-test-billing-tencent-runtime-contract|smoke-test-billing-v12-cos-attribution|smoke-test-portal-billing-export-routes-contract|smoke-test-portal-http-dispatcher-contract|smoke-test-portal-page-payloads-contract|smoke-test-portal-runtime-bootstrap-contract|smoke-test-portal-store-structure-contract|start-billing-live)\.(?:mjs)$/u,
    /^services\/portal\/src\/integrations\/resource-provisioner-client\.mjs$/u,
    /^deploy\/tke-package(?:\/|$)/u,
    /^deploy\/local\/dockerfiles\/(?:resource-provisioner|med-autoscience-runner)\.Dockerfile$/u,
    /^infra\/(?:opencost|kubernetes|codex-runtime|production-hardening)(?:\/|$)/u,
    /^compose\.(?:demo|langfuse)\.yaml$/u,
  ].some((pattern) => pattern.test(normalized));
}

export function remoteLooksSsh(remoteUrl) {
  return /^git@[^:]+:.+/.test(remoteUrl) || /^ssh:\/\/.+/.test(remoteUrl);
}

export function remoteLooksTokenFree(remoteUrl) {
  if (!remoteUrl) return false;
  if (/gh[pousr]_[A-Za-z0-9_]+/.test(remoteUrl)) return false;
  if (/github_pat_[A-Za-z0-9_]+/.test(remoteUrl)) return false;
  if (/x-access-token/i.test(remoteUrl)) return false;
  try {
    const parsed = new URL(remoteUrl);
    if (parsed.username || parsed.password) return false;
  } catch {
    if (/https?:\/\/[^/\s@]+@/i.test(remoteUrl)) return false;
  }
  return true;
}
