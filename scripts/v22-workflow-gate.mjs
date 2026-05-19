#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const stageDocuments = [
  "AGENTS.md",
  "docs/vibe-coding.md",
  "docs/contracts/README.md",
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
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

const packageDefinitions = {
  "portal-ui": {
    title: "Portal / UI 合同包",
    intent: "Portal 普通用户界面、工作空间、托管运行环境、文件、账单和会话轨迹。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
      "docs/contracts/v22-portal-files-billing-trace-boundary.md",
      "docs/contracts/v22-release-stop-billing-audit-boundary.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/active-surface.md",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-saas-portal-opl-ops-surface-contract.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "npm --prefix services/portal run check",
      "npm --prefix services/portal run frontend:typecheck",
    ],
  },
  gateway: {
    title: "OPL Entry / Gateway 合同包",
    intent: "OPL entry/preflight、Gateway launch/proxy、Portal 进入 OPL 工作台和 direct OPL 入口。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/v22-opl-entry-preflight-auth-boundary.md",
      "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
      "docs/contracts/v22-token-provider-boundary.md",
      "docs/contracts/v22-upstream-opl-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-opl-entry-preflight-auth-flow.mjs",
      "node scripts/smoke-test-v22-opl-dual-entry-contract.mjs",
      "node scripts/smoke-test-v22-opl-gateway-upstream-proxy-local.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
  },
  runtime: {
    title: "Runtime Bridge 合同包",
    intent: "Runtime Bridge session/run/file/providerKeyRef、artifact reference 和 Runtime Agent relay；当前实现目录是 services/opl-runtime-bridge，不是旧 adapters/* 兼容层。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/v22-runtime-bridge-session-run-file-provider-keyref-boundary.md",
      "docs/contracts/v22-opl-work-message-file-run-boundary.md",
      "docs/contracts/v22-token-provider-boundary.md",
      "docs/contracts/v22-trace-metadata-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
      "node scripts/smoke-test-v22-opl-runtime-e2e-local-flow.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
  },
  "langfuse-trace": {
    title: "Langfuse / Trace 合同包",
    intent: "Langfuse sanitized projection、Portal 会话轨迹和非 canonical source 边界。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/v22-langfuse-observability-metadata-boundary.md",
      "docs/contracts/v22-trace-metadata-boundary.md",
      "docs/contracts/v22-portal-files-billing-trace-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-langfuse-observability-metadata-contract.mjs",
      "node scripts/smoke-test-v22-portal-session-trace-view.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
  },
  "resource-billing": {
    title: "Resource / Billing / Audit 合同包",
    intent: "托管运行环境、资源绑定、预扣费、冻结金额、释放停止计费和审计状态。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/v22-managed-environment-open-boundary.md",
      "docs/contracts/v22-resource-plan-boundary.md",
      "docs/contracts/v22-pricing-snapshot-boundary.md",
      "docs/contracts/v22-tenant-resource-binding-boundary.md",
      "docs/contracts/v22-billing-freeze-boundary.md",
      "docs/contracts/v22-release-stop-billing-audit-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-managed-environment-open-flow.mjs",
      "node scripts/smoke-test-v22-managed-resource-binding-plan-view.mjs",
      "node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
  },
  "tencent-quote": {
    title: "Tencent Quote Provider 合同包",
    intent: "readonly/tencent quote provider、mock adapter、套餐估算和 quote snapshot。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/contracts/v22-managed-environment-open-boundary.md",
      "docs/contracts/v22-tencent-readonly-quote-provider-boundary.md",
      "docs/contracts/v22-pricing-snapshot-boundary.md",
      "docs/contracts/v22-resource-plan-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-tencent-readonly-quote-provider-boundary.mjs",
      "node scripts/smoke-test-v22-managed-resource-binding-plan-view.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
  },
  cleanup: {
    title: "Cleanup 合同包",
    intent: "旧路线退役、入口收敛、文档归档和污染防护。",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-control-plane-user-experience-boundary.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/active-surface.md",
      "docs/recovery/archive-policy.md",
      "与被退役路径相关的分支合同",
    ],
    validationCommands: [
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "git diff --check -- docs scripts",
    ],
  },
};

export const contractPackageTypes = Object.freeze(Object.keys(packageDefinitions));

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

function isForbiddenPath(filePath) {
  const normalized = normalizePath(filePath);
  return forbiddenPathPatterns.some((pattern) => pattern.test(normalized));
}

function isSecretLikePath(filePath) {
  const normalized = normalizePath(filePath);
  return secretLikePathPatterns.some((pattern) => pattern.test(normalized));
}

function isV22SmokePath(filePath) {
  const normalized = normalizePath(filePath);
  return /^scripts\/smoke-test-v22-.*\.mjs$/.test(normalized);
}

function isServicesPath(filePath) {
  return normalizePath(filePath).startsWith("services/");
}

function isContractPath(filePath) {
  return normalizePath(filePath).startsWith("docs/contracts/");
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
  const selected = packageDefinitions[type];
  if (!selected) {
    throw new Error(`unknown_workflow_type:${type || "(missing)"}`);
  }
  return selected;
}

export function renderStartTemplate({ type = "portal-ui" } = {}) {
  const selected = packageForType(type);
  const lines = [
    `# v22 workflow gate start: ${type}`,
    "",
    "## 分支意图",
    `本分支类型：${type}`,
    `建议意图：${selected.intent}`,
    "",
    "## 当前必须读取的阶段文档",
    ...stageDocuments.map((doc) => `- ${doc}`),
    "- 本次订阅合同",
    "",
    "## 推荐合同包",
    `合同包：${selected.title}`,
    ...selected.contracts.map((doc) => `- ${doc}`),
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
} = {}) {
  const normalizedFiles = changedFiles.map(normalizePath).filter(Boolean);
  const authorizedCleanupDeletions = normalizedFiles.filter((file) =>
    isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const forbiddenPaths = normalizedFiles.filter((file) =>
    isForbiddenPath(file) && !isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const secretLikePaths = normalizedFiles.filter((file) =>
    isSecretLikePath(file) && !isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const servicesChanged = normalizedFiles.some(isServicesPath);
  const contractsChanged = normalizedFiles.some(isContractPath);
  const smokeChanged = normalizedFiles.some(isV22SmokePath);
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
  if (servicesChanged && !smokeChanged) {
    findings.push({
      code: "services_changed_without_v22_smoke_update",
      severity: "warning",
      message: "services/* 改动需要对应 v22 smoke 覆盖或在审计中说明无需新增 smoke。",
    });
  }
  if (contractsChanged && !smokeChanged) {
    findings.push({
      code: "contracts_changed_without_v22_smoke_update",
      severity: "warning",
      message: "docs/contracts 改动需要对应 v22 smoke 更新或在审计中说明已有 smoke 覆盖。",
    });
  }

  const recommendedCommands = [
    "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  ];
  if (normalizedFiles.some((file) => file.startsWith("services/portal/"))) {
    recommendedCommands.push("npm --prefix services/portal run check");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/portal/frontend/"))) {
    recommendedCommands.push("npm --prefix services/portal run frontend:typecheck");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/opl-web-gateway/"))) {
    recommendedCommands.push("npm --prefix services/opl-web-gateway run check");
    recommendedCommands.push("node scripts/smoke-test-v22-opl-gateway-upstream-proxy-local.mjs");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/opl-runtime-bridge/"))) {
    recommendedCommands.push("node scripts/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs");
  }
  if (contractsChanged) {
    recommendedCommands.push("git diff --check -- docs/contracts scripts");
  }

  return {
    ok: findings.every((finding) => finding.severity !== "blocker"),
    base,
    changedFiles: normalizedFiles,
    authorizedCleanupDeletions,
    forbiddenPaths,
    secretLikePaths,
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
    "只由 B 窗口执行 push；本 gate 不自动 push。",
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
