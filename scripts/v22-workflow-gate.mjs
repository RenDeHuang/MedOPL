#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const stageDocuments = [
  "AGENTS.md",
  "docs/active/README.md",
  "docs/specs/README.md",
  "docs/policies/README.md",
  "docs/delivery/README.md",
];

const forbiddenPathPatterns = [
  /^deploy(?:\/|$)/,
  /^\.sentrux(?:\/|$)/,
  /^adapters(?:\/|$)/,
  /(?:^|\/)one-person-lab(?:\/|$)/,
  /(?:^|\/)upstream(?:\/|$)/,
];

const secretLikePathPatterns = [
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

const secretLikeAddedLinePatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bOPENAI_API_KEY\s*=\s*['"]?[^'"\s]{12,}/i,
  /\b(?:SECRET_ID|SECRET_KEY|SECRETID|SECRETKEY|TENCENT_SECRET_ID|TENCENT_SECRET_KEY)\s*=\s*['"]?[^'"\s]{8,}/i,
  /\b(?:BEARER|TOKEN|API_KEY|PRIVATE_KEY)\b\s*[:=]\s*['"]?[^'"\s]{12,}/i,
  new RegExp(`-----BEGIN (?:RSA |OPENSSH |EC |DSA )?${["PRIVATE", "KEY"].join(" ")}-----`),
  /\bkubeconfig\b\s*[:=]\s*['"]?[^'"\s]{8,}/i,
];

const reviewRequiredCommands = Object.freeze([
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs tests scripts services",
]);

const currentCommandReferenceSources = Object.freeze([
  "package.json",
  ".github/workflows/verify.yml",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "tests/fixtures/v22/goal-current.json",
  "scripts/v22-workflow-gate.mjs",
  "README.md",
  "docs/active/README.md",
  "docs/delivery/README.md",
]);

const changeStartDefinitions = {
  "portal-ui": {
    title: "Portal / UI change package",
    intent: "Portal 普通用户界面、工作空间、托管运行环境、文件、账单和会话轨迹。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/active/README.md",
      "docs/delivery/README.md",
    ],
    validationCommands: [
      "node tests/regression/portal/regression-test-v22-saas-portal-opl-ops-surface-contract.mjs",
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
      "npm --prefix services/portal run check",
      "npm --prefix services/portal run frontend:typecheck",
    ],
  },
  gateway: {
    title: "OPL Entry / Gateway change package",
    intent: "OPL entry/preflight、Gateway launch/proxy、Portal 进入 OPL 工作台和 direct OPL 入口。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/delivery/README.md",
    ],
    validationCommands: [
      "node tests/regression/opl/regression-test-v22-opl-entry-preflight-auth-flow.mjs",
      "node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs",
      "node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs",
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    ],
  },
  runtime: {
    title: "Runtime Bridge change package",
    intent: "Runtime Bridge session/run/file/providerKeyRef、artifact reference 和 Runtime Agent relay；当前实现目录是 services/opl-runtime-bridge，不是旧 adapters/* 兼容层。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/delivery/README.md",
    ],
    validationCommands: [
      "node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
      "node tests/regression/opl/regression-test-v22-opl-runtime-e2e-local-flow.mjs",
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    ],
  },
  "langfuse-trace": {
    title: "Langfuse / Trace change package",
    intent: "Langfuse sanitized projection、Portal 会话轨迹和非 canonical source 边界。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/delivery/README.md",
    ],
    validationCommands: [
      "node tests/regression/portal/regression-test-v22-portal-session-trace-view.mjs",
      "node tests/regression/portal/regression-test-v22-portal-trace-file-linkage.mjs",
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    ],
  },
  "resource-billing": {
    title: "Resource / Billing / Audit change package",
    intent: "托管运行环境、资源绑定、预扣费、冻结金额、释放停止计费和审计状态。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/delivery/README.md",
    ],
    validationCommands: [
      "node tests/smoke/smoke-test-v22-managed-environment-open-flow.mjs",
      "node tests/regression/portal/regression-test-v22-managed-resource-binding-plan-view.mjs",
      "node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    ],
  },
  "tencent-quote": {
    title: "Tencent Quote Provider change package",
    intent: "readonly/tencent quote provider、mock adapter、套餐估算和 quote snapshot。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/delivery/README.md",
    ],
    validationCommands: [
      "node tests/future-authorized/cloud/future-authorized-test-v22-tencent-readonly-quote-provider-boundary.mjs",
      "node tests/regression/portal/regression-test-v22-managed-resource-binding-plan-view.mjs",
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
    ],
  },
  cleanup: {
    title: "Cleanup change package",
    intent: "旧路线清退、入口收敛、文档归档和污染防护。",
    specSubscriptions: [
      "docs/specs/README.md",
      "docs/specs/README.md",
      "docs/active/README.md",
      "docs/policies/README.md",
      "docs/history/README.md",
      "与被清退路径相关的 durable spec / policy",
    ],
    validationCommands: [
      "node tests/contract/contract-test-v22-mvp-contract-suite.mjs",
      "git diff --check -- docs scripts",
    ],
  },
};

export const changePackageTypes = Object.freeze(Object.keys(changeStartDefinitions));

function normalizePath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

function unique(values) {
  return [...new Set(values)];
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { mode, options };
}

function runGit(args, { fallback = "" } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return fallback;
  }
}

function changedFilesSince(base) {
  const outputs = [
    runGit(["diff", "--name-only", `${base}...HEAD`], { fallback: "" }),
    runGit(["diff", "--name-only", "--cached"], { fallback: "" }),
    runGit(["diff", "--name-only"], { fallback: "" }),
    runGit(["ls-files", "--others", "--exclude-standard"], { fallback: "" }),
  ];
  return unique(outputs.flatMap((output) => output.split("\n").map((line) => line.trim()).filter(Boolean)));
}

function changedFileStatusesSince(base) {
  const outputs = [
    runGit(["diff", "--name-status", `${base}...HEAD`], { fallback: "" }),
    runGit(["diff", "--name-status", "--cached"], { fallback: "" }),
    runGit(["diff", "--name-status"], { fallback: "" }),
  ];
  const statuses = new Map();
  for (const output of outputs) {
    for (const line of output.split("\n").map((item) => item.trim()).filter(Boolean)) {
      const [status, ...paths] = line.split(/\s+/u);
      const filePath = normalizePath(paths.at(-1));
      if (filePath && !statuses.has(filePath)) statuses.set(filePath, status);
    }
  }
  for (const filePath of changedFilesSince(base)) {
    if (!statuses.has(filePath)) statuses.set(filePath, "A");
  }
  return statuses;
}

function currentBranchName() {
  return runGit(["branch", "--show-current"], { fallback: "" });
}

function statusPorcelain() {
  return runGit(["status", "--porcelain"], { fallback: "" });
}

function aheadCountForTrunk() {
  const output = runGit(["rev-list", "--count", "origin/recovery/platform-v22-trunk..HEAD"], { fallback: "0" });
  const count = Number(output);
  return Number.isFinite(count) ? count : 0;
}

function originPushRemoteUrl() {
  return runGit(["remote", "get-url", "--push", "origin"], { fallback: "" });
}

function addedLinesSince(base) {
  const effectiveDiff = runGit(["diff", "--unified=0", base], { fallback: "" });
  const untrackedFiles = runGit(["ls-files", "--others", "--exclude-standard"], { fallback: "" })
    .split("\n")
    .map(normalizePath)
    .filter(Boolean);
  const untrackedLines = untrackedFiles.flatMap((filePath) => {
    try {
      return readFileSync(path.join(repoRoot, filePath), "utf8").split("\n");
    } catch {
      return [];
    }
  });
  return effectiveDiff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .concat(untrackedLines);
}

function isForbiddenPath(filePath) {
  const normalized = normalizePath(filePath);
  return forbiddenPathPatterns.some((pattern) => pattern.test(normalized));
}

function isSecretLikePath(filePath) {
  const normalized = normalizePath(filePath);
  return secretLikePathPatterns.some((pattern) => pattern.test(normalized));
}

function secretLikeAddedLinesFrom(lines) {
  return lines
    .map((line, index) => ({ index: index + 1, line }))
    .filter(({ line }) => secretLikeAddedLinePatterns.some((pattern) => pattern.test(line)))
    .map(({ index, line }) => ({
      index,
      sample: line.length > 160 ? `${line.slice(0, 160)}...` : line,
    }));
}

function rootPackageScripts() {
  const source = readFileSync(path.join(repoRoot, "package.json"), "utf8");
  return new Set(Object.keys(JSON.parse(source).scripts || {}));
}

function localCommandReferencesFromSource(source) {
  const text = String(source || "");
  const nodeFiles = [...text.matchAll(/\bnode\s+((?:tests|scripts)\/[^\s`'"]+\.mjs)(?:\s|$)/gu)]
    .map((match) => normalizePath(match[1]));
  const npmScripts = [...text.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)\b/gu)]
    .map((match) => match[1]);

  return {
    nodeFiles: unique(nodeFiles).sort(),
    npmScripts: unique(npmScripts).sort(),
  };
}

export function findMissingLocalCommandReferences({
  sources = currentCommandReferenceSources,
} = {}) {
  const missing = [];
  const packageScripts = rootPackageScripts();
  for (const sourcePath of sources) {
    const absoluteSourcePath = path.join(repoRoot, sourcePath);
    if (!existsSync(absoluteSourcePath)) {
      missing.push({
        source: sourcePath,
        file: sourcePath,
        reason: "command_source_missing",
      });
      continue;
    }
    const source = readFileSync(absoluteSourcePath, "utf8");
    const references = localCommandReferencesFromSource(source);
    for (const filePath of references.nodeFiles) {
      if (!existsSync(path.join(repoRoot, filePath))) {
        missing.push({
          source: sourcePath,
          file: filePath,
          reason: "node_entry_missing",
        });
      }
    }
    for (const scriptName of references.npmScripts) {
      if (!packageScripts.has(scriptName)) {
        missing.push({
          source: sourcePath,
          script: scriptName,
          reason: "package_script_missing",
        });
      }
    }
  }
  return missing;
}

export const findMissingLocalTestCommandReferences = findMissingLocalCommandReferences;

function isV22EvalPath(filePath) {
  const normalized = normalizePath(filePath);
  return [
    /^tests\/smoke\/smoke-test-v22-.*\.mjs$/u,
    /^tests\/health\/health-check-v22-.*\.mjs$/u,
    /^tests\/contract\/(?:.+\/)?contract-test-v22-.*\.mjs$/u,
    /^tests\/regression\/.+\/regression-test-v22-.*\.mjs$/u,
    /^tests\/local-rc\/local-rc-test-v22-.*\.mjs$/u,
    /^tests\/future-authorized\/cloud\/future-authorized-test-v22-.*\.mjs$/u,
  ].some((pattern) => pattern.test(normalized));
}

function isServicesPath(filePath) {
  return normalizePath(filePath).startsWith("services/");
}

function isSpecPath(filePath) {
  return normalizePath(filePath).startsWith("docs/specs/");
}

function isChangePackagePath(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith("changes/active/") || normalized.startsWith("changes/archive/") || normalized === "changes/README.md";
}

function isFormalEngineeringChange(filePath) {
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

function activeChangePackages() {
  const activeDir = path.join(repoRoot, "changes", "active");
  if (!existsSync(activeDir)) return [];
  return readdirSync(activeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !/^(?:template|tmp|misc|wip)$/iu.test(name))
    .sort();
}

function changedActivePackages(changedFiles) {
  return unique(changedFiles
    .map(normalizePath)
    .map((file) => file.match(/^changes\/active\/([^/]+)\//u)?.[1])
    .filter(Boolean));
}

function changedArchivePackages(changedFiles) {
  return unique(changedFiles
    .map(normalizePath)
    .map((file) => file.match(/^changes\/archive\/([^/]+)\//u)?.[1])
    .filter(Boolean));
}

function archivePackageMatchesActiveId(archiveId, activeId) {
  return archiveId === activeId || archiveId.endsWith(`-${activeId}`);
}

function activePackageWasArchived({ id, changedFiles, changedStatuses, archivePackageIds }) {
  if (!archivePackageIds.some((archiveId) => archivePackageMatchesActiveId(archiveId, id))) return false;
  const activeFiles = changedFiles.map(normalizePath).filter((file) => file.startsWith(`changes/active/${id}/`));
  if (activeFiles.length === 0) return false;
  return activeFiles.every((file) => {
    const status = String(changedStatuses.get(file) || "");
    return status.startsWith("D") || status.startsWith("R");
  });
}

function reviewChangePackageRecords(changedFiles, changedStatuses = new Map()) {
  const archivePackageIds = changedArchivePackages(changedFiles);
  const active = changedActivePackages(changedFiles)
    .filter((id) => !activePackageWasArchived({ id, changedFiles, changedStatuses, archivePackageIds }))
    .map((id) => ({ id, root: "changes/active", path: `changes/active/${id}` }));
  const archive = archivePackageIds
    .map((id) => ({ id, root: "changes/archive", path: `changes/archive/${id}` }));
  return [...active, ...archive].sort((left, right) => left.path.localeCompare(right.path));
}

function readOptionalRepoFile(repoPath) {
  const absolutePath = path.join(repoRoot, repoPath);
  if (!existsSync(absolutePath)) return "";
  return readFileSync(absolutePath, "utf8");
}

function validateReviewChangePackage(record) {
  const proposal = readOptionalRepoFile(`${record.path}/proposal.md`);
  const specDelta = readOptionalRepoFile(`${record.path}/spec-delta.md`);
  const evalPlan = readOptionalRepoFile(`${record.path}/eval-plan.md`);
  const closeout = readOptionalRepoFile(`${record.path}/closeout.md`);
  const missingFiles = [
    "proposal.md",
    "spec-delta.md",
    "eval-plan.md",
    "closeout.md",
  ].filter((fileName) => !existsSync(path.join(repoRoot, record.path, fileName)));
  const targetSpecs = unique([...specDelta.matchAll(/specs\/[a-z-]+\/spec\.md/gu)].map((match) => match[0])).sort();
  const evalCommands = unique([...evalPlan.matchAll(/\b(?:node\s+(?:tests|scripts)\/[^\s`'"]+\.mjs|npm\s+(?:run|--prefix)\s+[^\n`]+)/gu)]
    .map((match) => match[0].trim())).sort();
  return {
    ...record,
    missingFiles,
    hasOwner: /Owner:/u.test(proposal),
    hasAuthorizationBoundary: /## Authorization Boundary/u.test(proposal),
    hasCannotClaim: /## CANNOT-CLAIM/u.test(specDelta) || /## Cannot Claim/u.test(closeout),
    targetSpecs,
    evalCommands,
    ok: missingFiles.length === 0
      && /Owner:/u.test(proposal)
      && /## Authorization Boundary/u.test(proposal)
      && targetSpecs.length > 0
      && evalCommands.length > 0,
  };
}

function isStrictMonolithCleanupAuthorizedDelete(filePath, status, branchName = currentBranchName()) {
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
  if (branchName === "cleanup/v22-full-taxonomy-hard-retirement") {
    return [
      /^docs\/contracts(?:\/|$)/u,
      /^docs\/recovery(?:\/|$)/u,
      /^docs\/(?:product|architecture|status|invariants|decisions|vibe-coding)\.md$/u,
      new RegExp(`^scripts/(?:${
        [
          ["v22", "agent", "workflow"].join("-"),
          ["v22", "cloud", "harness", "select", "checks"].join("-"),
          ["v22", "cloud", "operation", "local", "executor"].join("-"),
          ["v22", "retired", "surface", "data"].join("-"),
          ["v22", "tencent", "readonly", "inventory", "runner"].join("-"),
          ["check", "mojibake"].join("-"),
        ].join("|")
      })\\.mjs$`, "u"),
      /^tests\/fixtures\/v22\/(?:autonomous-goal-runner-policy|cloud-harness-manifest|goal-leaf-manifest\.schema|product-completion-scoreboard)\.json$/u,
      /^tests\/contract\/contract-test-v22-(?:agent-run-record-gate|autonomous-goal-runner|contract-eval-compaction|contract-smoke-eval-index-compaction|default-entry-narrative-gate|docs-taxonomy-skeleton|env-template-default-entry|goal-state-consistency|long-term-governance-surfaces|monolith-agent-workflow-entrypoint-and-trace-normalization|opl-style-taxonomy-hard-compaction|post-20fe9ac-agent-workflow-truth-and-repo-classification|post-merge-portal-opl-truth|product-goal-execution-order|product-goal-harness|program-board|release-readiness-auth-boundary|repo-governance-physical-compaction|repo-zoning-boundary|smoke-eval-physical-compaction|tests-taxonomy-hard-retirement|truth-freeze-physical-retirement|truth-repo-narrative-reference-unification)\.mjs$/u,
      /^tests\/future-authorized\/cloud\/future-authorized-test-v22-(?:agent-workflow-cloud-onboarding|authorized-tencent-deploy-execution-contract|cloud-connection-runnable-path|cloud-harness-manifest-selector|cloud-onboarding-absorption-sequence|cloud-onboarding-board-status|cloud-onboarding-workflow-contract|cloud-resource-isolation-contract|discovery-governance-local-gate|opl-deployment-ownership-release-plan-contract|package-d-.+|portal-cloud-operation-async-worker-loop|portal-cloud-operation-runner-loop|portal-package-click-cloud-resource-loop|portal-production-cloud-operation-.+|real-resource-contract-alignment|tencent-readonly-inventory-.+|tencent-resource-lifecycle-.+)\.mjs$/u,
      /^tests\/future-authorized\/cloud\/smoke-test-v22-(?:agent-workflow-cloud-onboarding|authorized-tencent-deploy-execution-contract|cloud-connection-runnable-path|cloud-harness-manifest-selector|cloud-onboarding-absorption-sequence|cloud-onboarding-board-status|cloud-onboarding-workflow-contract|cloud-resource-isolation-contract|discovery-governance-local-gate|opl-deployment-ownership-release-plan-contract|package-d-.+|portal-cloud-operation-async-worker-loop|portal-cloud-operation-runner-loop|portal-package-click-cloud-resource-loop|portal-production-cloud-operation-.+|real-resource-contract-alignment|tencent-readonly-inventory-.+|tencent-resource-lifecycle-.+)\.mjs$/u,
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

function remoteLooksSsh(remoteUrl) {
  return /^git@[^:]+:.+/.test(remoteUrl) || /^ssh:\/\/.+/.test(remoteUrl);
}

function remoteLooksTokenFree(remoteUrl) {
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

function packageForType(type) {
  const selected = changeStartDefinitions[type];
  if (!selected) {
    throw new Error(`unknown_change_package_type:${type || "(missing)"}`);
  }
  return selected;
}

export function renderStartTemplate({ type = "portal-ui" } = {}) {
  const selected = packageForType(type);
  const lines = [
    `# v22 change package gate start: ${type}`,
    "",
    "## 分支意图",
    `本分支类型：${type}`,
    `建议意图：${selected.intent}`,
    "",
    "## 当前必须读取的阶段文档",
    ...stageDocuments.map((doc) => `- ${doc}`),
    "- 本次 change package",
    "- 本次 spec subscription / truth subscription",
    "",
    "## 推荐 change package",
    `change package：${selected.title}`,
    ...selected.specSubscriptions.map((doc) => `- ${doc}`),
    "",
    "## 本次不修改项",
    "- 不修改未授权的 deploy/*",
    "- 不修改未授权的 .sentrux/*",
    "- 不修改未授权的 adapters/*",
    "- 不修改 one-person-lab upstream",
    "- 不执行真实云资源创建、绑定、释放或真实扣费",
    "",
    "## 污染防护",
    "- 不读取 secret、kubeconfig、token、SecretId、SecretKey、SSH private key 或 .env",
    "- 不调用真实腾讯云、COS、Langfuse、one-person-lab 或外部生产 API",
    "- 不把 raw API Key、bearer token、launchToken、runtimeToken 写入 response、日志、URL、浏览器持久化存储或 git",
    "- 不恢复旧 v19/v20/v21 路线为 v22 产品入口",
    "- 不让云厂商/工程字段成为普通用户主语言",
    "",
    "## 推荐验证命令",
    ...selected.validationCommands.map((command) => `- ${command}`),
  ];
  return `${lines.join("\n")}\n`;
}

export function evaluateReview({
  base = "recovery/platform-v22-trunk",
  changedFiles = changedFilesSince(base),
  branchName = currentBranchName(),
  changedStatuses = changedFileStatusesSince(base),
  addedLines = addedLinesSince(base),
  missingLocalCommandReferences = findMissingLocalCommandReferences(),
  activeChangePackageNames = activeChangePackages(),
} = {}) {
  const normalizedFiles = changedFiles.map(normalizePath).filter(Boolean);
  const authorizedCleanupDeletions = normalizedFiles.filter((file) =>
    isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const forbiddenPaths = normalizedFiles.filter((file) =>
    isForbiddenPath(file) && !isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const secretLikePaths = normalizedFiles.filter((file) =>
    isSecretLikePath(file) && !isV22EvalPath(file) && !isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const secretLikeAddedLines = secretLikeAddedLinesFrom(addedLines);
  const servicesChanged = normalizedFiles.some(isServicesPath);
  const specsChanged = normalizedFiles.some(isSpecPath);
  const evalChanged = normalizedFiles.some(isV22EvalPath);
  const formalEngineeringChanged = normalizedFiles.some((file) => isFormalEngineeringChange(file) && !isChangePackagePath(file));
  const reviewPackages = reviewChangePackageRecords(normalizedFiles, changedStatuses).map(validateReviewChangePackage);
  const validReviewPackages = reviewPackages.filter((record) => record.ok);
  const activeChanges = [...activeChangePackageNames, ...changedArchivePackages(normalizedFiles)].sort();
  const findings = [];

  if (forbiddenPaths.length > 0) {
    findings.push({
      code: "forbidden_path_changed",
      severity: "blocker",
      files: forbiddenPaths,
    });
  }
  if (secretLikePaths.length > 0) {
    findings.push({
      code: "secret_like_path_changed",
      severity: "blocker",
      files: secretLikePaths,
    });
  }
  if (secretLikeAddedLines.length > 0) {
    findings.push({
      code: "secret_like_added_line",
      severity: "blocker",
      matches: secretLikeAddedLines,
    });
  }
  if (missingLocalCommandReferences.length > 0) {
    findings.push({
      code: "missing_local_command_reference",
      severity: "blocker",
      references: missingLocalCommandReferences,
    });
  }
  if (servicesChanged && !evalChanged && validReviewPackages.length === 0) {
    findings.push({
      code: "services_changed_without_eval_plan_update",
      severity: "blocker",
      message: "services/* 改动需要本次 change package 的 eval-plan.md 绑定本地 eval，或同时修改/新增已注册 eval。",
    });
  }
  if (specsChanged && !evalChanged && validReviewPackages.length === 0) {
    findings.push({
      code: "specs_changed_without_eval_plan_update",
      severity: "blocker",
      message: "docs/specs 改动需要本次 change package 的 spec-delta.md 与 eval-plan.md 绑定 target spec 和本地 eval，或同时修改/新增已注册 eval。",
    });
  }
  if (formalEngineeringChanged && reviewPackages.length === 0) {
    findings.push({
      code: "formal_change_without_active_change_package",
      severity: "blocker",
      message: "正式工程变更必须在本次 diff 中包含 repo-native changes/active/<change-id> 或 changes/archive/<date-change-id>，记录 proposal、spec delta、design、tasks、eval plan、review 和 closeout。",
    });
  }
  if (formalEngineeringChanged && reviewPackages.some((record) => !record.ok)) {
    findings.push({
      code: "formal_change_package_missing_spec_or_eval_plan",
      severity: "blocker",
      packages: reviewPackages.filter((record) => !record.ok).map((record) => ({
        path: record.path,
        missingFiles: record.missingFiles,
        hasOwner: record.hasOwner,
        hasAuthorizationBoundary: record.hasAuthorizationBoundary,
        targetSpecs: record.targetSpecs,
        evalCommands: record.evalCommands,
      })),
      message: "本次 formal change 的 change package 必须声明 owner、authorization boundary、target specs 和本地 eval commands。",
    });
  }

  const recommendedCommands = [...reviewRequiredCommands];
  if (normalizedFiles.some((file) => file.startsWith("services/portal/"))) {
    recommendedCommands.push("npm --prefix services/portal run check");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/portal/frontend/"))) {
    recommendedCommands.push("npm --prefix services/portal run frontend:typecheck");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/opl-web-gateway/"))) {
    recommendedCommands.push("npm --prefix services/opl-web-gateway run check");
    recommendedCommands.push("node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/opl-runtime-bridge/"))) {
    recommendedCommands.push("node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs");
  }
  if (specsChanged) {
    recommendedCommands.push("git diff --check -- docs/specs tests scripts");
  }

  return {
    ok: findings.every((finding) => finding.severity !== "blocker"),
    base,
    changedFiles: normalizedFiles,
    authorizedCleanupDeletions,
    forbiddenPaths,
    secretLikePaths,
    secretLikeAddedLines,
    missingLocalCommandReferences,
    missingLocalTestCommandReferences: missingLocalCommandReferences,
    activeChanges,
    reviewPackages,
    findings,
    recommendedCommands: unique(recommendedCommands),
  };
}

export function evaluateCheckpoint({
  branchName = currentBranchName(),
  statusPorcelain: status = statusPorcelain(),
  aheadCount = aheadCountForTrunk(),
  remoteUrl = originPushRemoteUrl(),
} = {}) {
  const checks = {
    onTrunk: {
      ok: branchName === "recovery/platform-v22-trunk",
      detail: branchName || "(unknown)",
    },
    worktreeClean: {
      ok: status.trim().length === 0,
      detail: status.trim() ? "dirty" : "clean",
    },
    aheadOrigin: {
      ok: aheadCount > 0,
      detail: String(aheadCount),
    },
    remoteSsh: {
      ok: remoteLooksSsh(remoteUrl),
      detail: remoteUrl || "(missing)",
    },
    remoteNoToken: {
      ok: remoteLooksTokenFree(remoteUrl),
      detail: remoteUrl ? "token-free" : "(missing)",
    },
  };
  const pushChecklist = [
    "确认工作区干净。",
    "确认没有 secret 被 tracked，包含 kubeconfig、token、SecretId、SecretKey、SSH private key、.env 和本地 github 配置。",
    "确认 remote 是 SSH，且 remote URL 不含 token/PAT。",
    "确认本地 trunk ahead origin/recovery/platform-v22-trunk。",
    "只由 landing operator 在 landing gate 通过后执行 push；本 gate 不自动 push。",
  ];

  return {
    ok: Object.values(checks).every((check) => check.ok),
    checks,
    pushChecklist,
  };
}

function renderReviewReport(review) {
  return `${JSON.stringify({
    ok: review.ok,
    mode: "review",
    base: review.base,
    changedFiles: review.changedFiles,
    authorizedCleanupDeletions: review.authorizedCleanupDeletions,
    forbiddenPaths: review.forbiddenPaths,
    secretLikePaths: review.secretLikePaths,
    secretLikeAddedLines: review.secretLikeAddedLines,
    missingLocalCommandReferences: review.missingLocalCommandReferences,
    reviewPackages: review.reviewPackages,
    findings: review.findings,
    recommendedCommands: review.recommendedCommands,
  }, null, 2)}\n`;
}

function renderCheckpointReport(checkpoint) {
  return `${JSON.stringify({
    ok: checkpoint.ok,
    mode: "checkpoint",
    checks: checkpoint.checks,
    pushChecklist: checkpoint.pushChecklist,
  }, null, 2)}\n`;
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-workflow-gate.mjs start --type <portal-ui|gateway|runtime|langfuse-trace|resource-billing|tencent-quote|cleanup>",
    "  node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk",
    "  node scripts/v22-workflow-gate.mjs checkpoint",
    "",
  ].join("\n"));
}

async function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));
  if (mode === "start") {
    process.stdout.write(renderStartTemplate({ type: options.type || "portal-ui" }));
    return;
  }
  if (mode === "review") {
    process.stdout.write(renderReviewReport(evaluateReview({ base: options.base || "recovery/platform-v22-trunk" })));
    return;
  }
  if (mode === "checkpoint") {
    process.stdout.write(renderCheckpointReport(evaluateCheckpoint()));
    return;
  }
  printUsage();
  process.exitCode = 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
