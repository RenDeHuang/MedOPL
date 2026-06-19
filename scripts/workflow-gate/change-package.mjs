import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { normalizePath, unique } from "./git-diff.mjs";

export const stageDocuments = [
  "AGENTS.md",
  "docs/active/README.md",
  "docs/specs/README.md",
  "docs/policies/README.md",
  "docs/delivery/README.md",
];

export const changeStartDefinitions = {
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
      "node tests/suites/suite-test-v22-mvp.mjs",
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
      "node tests/contracts/contract-test-v22-node-portal-backend-physical-removal.mjs",
      "node tests/contracts/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs",
      "node tests/smoke/smoke-test-v22-portal-opl-connection-contract.mjs",
      "node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs",
      "node tests/suites/suite-test-v22-mvp.mjs",
    ],
  },
  runtime: {
    title: "Runtime Bridge change package",
    intent: "Runtime Bridge session/run/file/providerKeyRef、artifact reference 和 Runtime Agent relay；当前实现目录是 services/opl-runtime-bridge，不是旧 adapters/* 路线。",
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
      "node tests/contracts/runtime-bridge/contract-test-v22-runtime-gate-contract.mjs",
      "node tests/suites/suite-test-v22-mvp.mjs",
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
      "node tests/smoke/smoke-test-v22-portal-files-billing-trace-flow.mjs",
      "node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs",
      "node tests/suites/suite-test-v22-mvp.mjs",
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
      "node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs",
      "node tests/smoke/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "node tests/suites/suite-test-v22-mvp.mjs",
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
      "node tests/cloud/cloud-test-v22-tencent-readonly-inventory-boundary.mjs",
      "node tests/contracts/contract-test-v22-precloud-deployable-rc.mjs",
      "node tests/suites/suite-test-v22-mvp.mjs",
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
      "node tests/suites/suite-test-v22-mvp.mjs",
      "git diff --check -- docs scripts",
    ],
  },
};

export const changePackageTypes = Object.freeze(Object.keys(changeStartDefinitions));

function readOptionalRepoFile(repoRoot, repoPath) {
  const absolutePath = path.join(repoRoot, repoPath);
  if (!existsSync(absolutePath)) return "";
  return readFileSync(absolutePath, "utf8");
}

function closeoutHasCompletionAudit(closeout) {
  const source = String(closeout || "");
  const requiredStatuses = ["functional", "code_cleanup", "docs_foldback", "verification", "retired_entrypoints", "cannot_claim"];
  const statusPattern = "(?:done|partial|not_started|blocked)";
  return /## Plan Completion Audit/u.test(source)
    && requiredStatuses.every((field) => new RegExp(`${field}\\s*:\\s*${statusPattern}`, "u").test(source));
}

function closeoutHasCleanupResult(closeout) {
  const source = String(closeout || "");
  return /## Cleanup Result/u.test(source)
    && ["deleted", "folded", "retained", "reason", "next"].every((field) => new RegExp(`${field}\\s*:`, "u").test(source));
}

function changedArchivePackages(changedFiles) {
  return unique(changedFiles
    .map(normalizePath)
    .map((file) => file.match(/^changes\/archive\/([^/]+)\//u)?.[1])
    .filter(Boolean));
}

function activePackageWasArchived({ id, changedFiles, changedStatuses, archivePackageIds }) {
  if (!archivePackageIds.some((archiveId) => archiveId === id || archiveId.endsWith(`-${id}`))) return false;
  const activeFiles = changedFiles.map(normalizePath).filter((file) => file.startsWith(`changes/active/${id}/`));
  if (activeFiles.length === 0) return false;
  return activeFiles.every((file) => {
    const status = String(changedStatuses.get(file) || "");
    return status.startsWith("D") || status.startsWith("R");
  });
}

function changedActivePackages(changedFiles) {
  return unique(changedFiles
    .map(normalizePath)
    .map((file) => file.match(/^changes\/active\/([^/]+)\//u)?.[1])
    .filter(Boolean));
}

export function activeChangePackages(repoRoot) {
  const activeDir = path.join(repoRoot, "changes", "active");
  if (!existsSync(activeDir)) return [];
  return readdirSync(activeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !/^(?:template|tmp|misc|wip)$/iu.test(name))
    .sort();
}

export function reviewChangePackageRecords(changedFiles, changedStatuses = new Map()) {
  const normalizedChangedFiles = changedFiles.map(normalizePath);
  const archivePackageIds = changedArchivePackages(changedFiles);
  const active = changedActivePackages(changedFiles)
    .filter((id) => !activePackageWasArchived({ id, changedFiles, changedStatuses, archivePackageIds }))
    .map((id) => ({ id, root: "changes/active", path: `changes/active/${id}`, changedFiles: normalizedChangedFiles, changedStatuses }));
  const archive = archivePackageIds
    .map((id) => ({ id, root: "changes/archive", path: `changes/archive/${id}`, changedFiles: normalizedChangedFiles, changedStatuses }));
  return [...active, ...archive].sort((left, right) => left.path.localeCompare(right.path));
}

export function validateReviewChangePackage(repoRoot, record) {
  const proposal = readOptionalRepoFile(repoRoot, `${record.path}/proposal.md`);
  const specDelta = readOptionalRepoFile(repoRoot, `${record.path}/spec-delta.md`);
  const evalPlan = readOptionalRepoFile(repoRoot, `${record.path}/eval-plan.md`);
  const closeout = readOptionalRepoFile(repoRoot, `${record.path}/closeout.md`);
  const closeoutStatus = String(record.changedStatuses?.get(`${record.path}/closeout.md`) || "");
  const closeoutChanged = Boolean(closeoutStatus && !closeoutStatus.startsWith("D"));
  const activePackage = record.root === "changes/active";
  const missingFiles = ["proposal.md", "spec-delta.md", "eval-plan.md", "closeout.md"]
    .filter((fileName) => !existsSync(path.join(repoRoot, record.path, fileName)));
  const targetSpecs = unique([...specDelta.matchAll(/specs\/[a-z-]+\/spec\.md/gu)].map((match) => match[0])).sort();
  const evalCommands = unique(
    [...evalPlan.matchAll(/\b(?:node\s+(?:tests|scripts)\/[^\s`'"]+\.mjs|npm\s+(?:run|--prefix)\s+[^\n`]+)/gu)]
      .map((match) => match[0].trim()),
  ).sort();
  return {
    ...record,
    missingFiles,
    hasOwner: /Owner:/u.test(proposal),
    hasAuthorizationBoundary: /## Authorization Boundary/u.test(proposal),
    hasCannotClaim: /## CANNOT-CLAIM/u.test(specDelta) || /## Cannot Claim/u.test(closeout),
    hasCompletionAudit: closeoutHasCompletionAudit(closeout),
    hasCleanupResult: closeoutHasCleanupResult(closeout),
    targetSpecs,
    evalCommands,
    ok: missingFiles.length === 0
      && /Owner:/u.test(proposal)
      && /## Authorization Boundary/u.test(proposal)
      && targetSpecs.length > 0
      && evalCommands.length > 0
      && (!activePackage || !closeoutChanged || (closeoutHasCompletionAudit(closeout) && closeoutHasCleanupResult(closeout))),
  };
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
