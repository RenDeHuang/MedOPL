#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stageDocuments = [
  "AGENTS.md",
  "docs/vibe-coding.md",
  "docs/contracts/README.md",
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
];

const sharedBoundaries = [
  "只生成任务包、审查包、QA 包、checkpoint 包和下一步建议。",
  "不自动 " + "merge。",
  "不自动 " + "push。",
  "不启动 " + "t" + "mux。",
  "不读 secret。",
  "不调用真实云或外部生产服务。",
  "不修改 deploy/*、.sentrux/*、adapters/* 或 upstream。",
  "不运行 " + "build" + "/push/" + "kube" + "ctl/" + "live" + "-test。",
];

const disallowedActions = [
  "git " + "merge",
  "git " + "push",
  "t" + "mux",
  "secret read",
  "real cloud call",
  "build" + "/push",
  "kube" + "ctl",
  "live" + "-test",
];

const stableStatusEnum = Object.freeze([
  "A_COMMITTED",
  "B_BLOCKER",
  "A_FIXED",
  "B_MERGED",
  "B_PUSHED",
  "C_BLOCKER",
  "C_PASS",
]);

const statusAliases = Object.freeze({
  B_BLOCKED: "B_BLOCKER",
});

const worktreeRoot = "/home/dev/projects/platform-v22.worktrees";
const runtimeStateRoot = ".runtime/v22-agent-workflow";
const laneStateDir = `${runtimeStateRoot}/lanes`;
const cloudOnboardingBoardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const cloudOnboardingStatusTablePath = "docs/recovery/cloud-onboarding-status-table.md";
const cloudOnboardingWorkflowContractPath = "docs/contracts/v22-cloud-onboarding-workflow-boundary.md";
const cloudHarnessManifestPath = "docs/recovery/v22-cloud-harness-manifest.json";

const cloudOnboardingRunnablePath = Object.freeze([
  ["R-00", "CC-01", "none", "local contract guard", "stdout JSON only"],
  ["R-01", "CC-01", "dependency_install", "SDK dependency install", "services/portal/package.json and services/portal/package-lock.json"],
  ["R-02", "CC-01", "dependency_install", "SDK shape smoke", "stdout JSON only"],
  ["R-03", "CC-02", "readonly_connection", "readonly preflight", "stdout JSON only"],
  ["R-04", "CC-02", "readonly_connection", "readonly live report", ".runtime/v22-tencent-readonly-inventory/<authorized-run-id>.json"],
  ["R-05", "CC-03", "local_contract_smoke", "Portal canonical operation smoke", "stdout JSON only"],
  ["R-06", "CC-04", "authorized_resource_lifecycle", "storage dry-run", ".runtime/v22-cloud-lifecycle/<operation-id>-storage-dry-run.json"],
  ["R-07", "CC-04", "authorized_resource_lifecycle", "authorized storage execution", ".runtime/v22-cloud-lifecycle/<operation-id>-storage-execution.json"],
  ["R-08", "CC-05", "authorized_resource_lifecycle", "compute dry-run", ".runtime/v22-cloud-lifecycle/<operation-id>-compute-dry-run.json"],
  ["R-09", "CC-05", "authorized_resource_lifecycle", "authorized compute execution", ".runtime/v22-cloud-lifecycle/<operation-id>-compute-execution.json"],
  ["R-10", "CC-03", "local_contract_smoke", "Portal projection smoke", "stdout JSON only"],
  ["R-11", "CC-04", "authorized_resource_lifecycle", "expand storage dry-run and execution", ".runtime/v22-cloud-lifecycle/<operation-id>-storage-expand.json"],
  ["R-12", "CC-05", "authorized_resource_lifecycle", "expand compute dry-run and execution", ".runtime/v22-cloud-lifecycle/<operation-id>-compute-expand.json"],
  ["R-13", "CC-06", "readonly_connection", "COS billing checkpoint", ".runtime/v22-cloud-reconciliation/<run-id>.json"],
  ["R-14", "CC-07", "deploy_and_production_integration", "TCR repository/tag preflight", ".runtime/v22-registry/<run-id>.json"],
  ["R-15", "CC-07", "deploy_and_production_integration", "multi-image build and push unique test tag", ".runtime/v22-registry/<run-id>.json"],
  ["R-16", "CC-07", "deploy_and_production_integration", "deploy dry-run", ".runtime/v22-cloud-deploy/<run-id>.json"],
  ["R-17", "CC-07", "deploy_and_production_integration", "authorized deploy rollout", ".runtime/v22-cloud-deploy/<run-id>.json"],
  ["R-18", "CC-07", "deploy_and_production_integration", "runtime smoke", ".runtime/v22-runtime-smoke/<run-id>.json"],
  ["R-19", "CC-05", "authorized_resource_lifecycle", "release compute", ".runtime/v22-cloud-lifecycle/<operation-id>-compute-release.json"],
  ["R-20", "CC-04", "authorized_resource_lifecycle", "delete file space", ".runtime/v22-cloud-lifecycle/<operation-id>-storage-delete.json"],
  ["R-21", "CC-REVIEW", "manual_b_review", "final reconciliation cleanup and B review", ".runtime/v22-cloud-cleanup/<run-id>.json"],
].map(([step, gateId, authorizationPackage, name, artifactPath]) => Object.freeze({
  step,
  gateId,
  authorizationPackage,
  name,
  artifactPath,
  blockedReason: authorizationPackage === "none" || authorizationPackage === "local_contract_smoke"
    ? ""
    : "needs_explicit_user_authorization",
  suggestedCommands: [],
})));

const workspaceDiscipline = Object.freeze({
  mainWorkspaceRole: "主工作区只用于规划、B 审计、ff-only merge、checkpoint、push、清理。",
  mainWorkspaceWritable: false,
  mainWorkspaceWriteReminder: "主工作区不可写：A/C/D 写文件时必须切到独立 git worktree。",
  bAuditGateRule: "B 的人工审计闸门不能被绕过。",
  bUsesMainWorkspace: true,
  bWorkspace: "main",
  writingLanesUseWorktree: ["A", "C", "D"],
  writingLaneRule: "A/C/D 使用独立 worktree；C 只读 QA 不写文件，若升级为写文件修复则拆 lane。",
  oneActiveLanePerWorktree: true,
  completionFlow: ["verify", "B review", "absorb or abandon", "cleanup"],
  executionSurfaceNotTruth: "t" + "mux pane/session 只是执行面，不是 truth。",
  truthRule: "truth 必须进入 repo-tracked contracts/docs/scripts/tests。",
  truthTrackedPaths: ["contracts", "docs", "scripts", "tests"],
  nonCommittableLocalState: ["t" + "mux session", "agent 对话", "临时日志", "本地状态"],
});

const repoGovernanceTruth = Object.freeze([
  "AGENTS.md",
  "docs/vibe-coding.md",
  "docs/contracts",
  "docs/recovery",
  "scripts/smoke-*",
]);

const forbiddenActions = Object.freeze(disallowedActions);

const workflowTypes = {
  cleanup: {
    label: "cleanup",
    intent: "退役旧路线、入口收敛、文档归档和污染防护。",
    branchPrefix: "cleanup/",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/active-surface.md",
      "docs/recovery/archive-policy.md",
      "与被退役路径相关的分支合同",
    ],
    validations: [
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "git diff --check -- docs scripts",
    ],
    cScope: "只读检查被退役入口没有重新出现在普通用户主叙事。",
  },
  "portal-ui": {
    label: "portal-ui",
    intent: "Portal 普通用户界面、托管运行环境、工作空间、文件、账单和运行轨迹。",
    branchPrefix: "feat/",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
      "docs/contracts/v22-portal-files-billing-trace-boundary.md",
      "docs/contracts/v22-release-stop-billing-audit-boundary.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/active-surface.md",
    ],
    validations: [
      "node scripts/smoke-test-v22-saas-portal-opl-ops-surface-contract.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "npm --prefix services/portal run check",
      "npm --prefix services/portal run frontend:typecheck",
    ],
    cScope: "只读检查普通用户 Portal 是否保持科研工作台叙事和密钥边界。",
  },
  "resource-billing": {
    label: "resource-billing",
    intent: "托管运行环境、资源绑定、预扣费、冻结金额、释放停止计费和审计状态。",
    branchPrefix: "feat/",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-managed-environment-open-boundary.md",
      "docs/contracts/v22-resource-plan-boundary.md",
      "docs/contracts/v22-pricing-snapshot-boundary.md",
      "docs/contracts/v22-tenant-resource-binding-boundary.md",
      "docs/contracts/v22-billing-freeze-boundary.md",
      "docs/contracts/v22-release-stop-billing-audit-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validations: [
      "node scripts/smoke-test-v22-managed-environment-open-flow.mjs",
      "node scripts/smoke-test-v22-managed-resource-binding-plan-view.mjs",
      "node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
    cScope: "只读检查套餐、余额、预扣费、冻结金额和释放审计是否可解释。",
  },
  contract: {
    label: "contract",
    intent: "合同、阶段文档、边界文档和对应 v22 smoke 的收敛。",
    branchPrefix: "contract/",
    contracts: [
      "docs/contracts/README.md",
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
      "docs/recovery/status-matrix.md",
      "docs/recovery/mvp-contract-acceptance.md",
    ],
    validations: [
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "node scripts/smoke-test-v22-workflow-gate.mjs",
      "git diff --check -- docs/contracts docs/recovery scripts",
    ],
    cScope: "只读检查合同范围、非目标、授权边界和 smoke 可验证性。",
  },
  "ops-console": {
    label: "ops-console",
    intent: "平台运维视图、后台边界、异常归因、审计状态和普通用户叙事隔离。",
    branchPrefix: "feat/",
    contracts: [
      "docs/contracts/v22-mvp-managed-opl-loop.md",
      "docs/contracts/v22-saas-portal-opl-ops-surface-boundary.md",
      "docs/contracts/v22-tenant-resource-binding-boundary.md",
      "docs/contracts/v22-release-stop-billing-audit-boundary.md",
      "docs/recovery/status-matrix.md",
    ],
    validations: [
      "node scripts/smoke-test-v22-saas-portal-opl-ops-surface-contract.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "npm --prefix services/portal run check",
      "npm --prefix services/portal run frontend:typecheck",
    ],
    cScope: "只读检查运维面没有泄露到普通用户主界面。",
  },
};

const qaSurfaces = {
  resources: {
    label: "resources",
    prompt: "只读检查资源/托管运行环境页面；不得执行开通、释放、绑定或任何会改变资源状态的动作。",
    screenshots: [
      "资源/托管运行环境列表全页截图。",
      "套餐、文件空间、余额或冻结金额关联区域截图。",
      "空态、异常态或审计提示态截图。",
    ],
    checks: [
      "普通用户看到的是托管运行环境和文件空间，不是云控制台。",
      "页面不暴露 raw provider key、token、内部密钥、运行令牌或对象存储内部地址。",
      "资源绑定、计费、审计字段只在合适的后台/运维语境出现。",
    ],
  },
  workspace: {
    label: "workspace",
    prompt: "只读检查工作空间、输入文件、输出文件和进入 OPL 工作台入口；不得上传、删除或提交任务。",
    screenshots: [
      "工作空间总览截图。",
      "输入文件和输出文件区域截图。",
      "进入 OPL 工作台入口及其状态截图。",
    ],
    checks: [
      "工作空间语言围绕科研任务、文件和工作台。",
      "下载/文件引用不暴露内部路径、对象键或签名地址。",
      "进入工作台入口不把内部认证路径作为用户入口。",
    ],
  },
  trace: {
    label: "trace",
    prompt: "只读检查运行轨迹、会话、任务进度和审计 metadata；不得重放任务或调用外部观测服务。",
    screenshots: [
      "运行轨迹列表截图。",
      "单条会话/任务详情截图。",
      "失败态或审计 pending 状态截图。",
    ],
    checks: [
      "轨迹只展示 sanitized metadata，不展示 raw prompt、raw key 或 bearer token。",
      "轨迹可回答任务跑到哪一步、输出文件在哪里、审计状态是什么。",
      "观测附件不能成为账单或业务事实来源。",
    ],
  },
  billing: {
    label: "billing",
    prompt: "只读检查账单、余额、预扣费、冻结金额、释放停止计费和审计状态；不得触发充值或扣费动作。",
    screenshots: [
      "账单摘要截图。",
      "余额、预扣费、冻结金额区域截图。",
      "释放后停止计费确认和审计状态截图。",
    ],
    checks: [
      "用户能看懂钱花在哪里、是否停止扣费、审计是否完成。",
      "费用语言不要求用户理解后台资源池或工程标签。",
      "异常状态明确，不用隐式通过掩盖缺参或缺状态。",
    ],
  },
  overview: {
    label: "overview",
    prompt: "只读检查 Portal 总览页的信息架构；不得修改用户、资源、账单、文件或任务状态。",
    screenshots: [
      "总览首屏截图。",
      "余额/任务/会话/托管环境/文件空间汇总截图。",
      "异常或待处理提醒截图。",
    ],
    checks: [
      "总览回答余额、任务进度、环境状态、文件空间和入口位置。",
      "普通用户主语言保持科研工作台，不变成工程后台。",
      "没有 raw key、token、内部令牌或生产服务细节进入页面。",
    ],
  },
};

const nextStateHandlers = {
  A_COMMITTED: (state) => ({
    window: "B",
    action: "review-pack",
    message: `窗口 B 执行 review-pack：node scripts/v22-agent-workflow.mjs review-pack --branch ${state.branch || "<branch>"} --base ${state.base || "recovery/platform-v22-trunk"}`,
  }),
  B_BLOCKER: (state) => ({
    window: "A",
    action: "fix-pack",
    message: `窗口 A 执行 fix-pack：修复 ${state.branch || "<branch>"} 的 blocker，修复后回复 status: A_FIXED。`,
  }),
  A_FIXED: (state) => ({
    window: "B",
    action: "re-review-pack",
    message: `窗口 B 执行 re-review-pack：复审修复 commit ${state.commit || "<commit>"}。`,
  }),
  B_MERGED: () => ({
    window: "B",
    action: "checkpoint-pack",
    message: "窗口 B 执行 checkpoint-pack，确认 push 前工作区、remote、secret hygiene 和验证记录。",
  }),
  B_PUSHED: (state) => ({
    window: "C",
    action: "qa-pack",
    message: `窗口 C 执行 qa-pack：对 ${state.surface || "overview"} 做只读 QA，发现问题回复 status: C_BLOCKER，通过回复 status: C_PASS。`,
  }),
  C_BLOCKER: (state) => ({
    window: "A",
    action: "fix-pack",
    message: `窗口 A 处理 C blocker：修复 ${state.branch || "<branch>"} 或拆出新 lane，修复后回复 status: A_FIXED。`,
  }),
  C_PASS: () => ({
    window: "D",
    action: "done",
    message: "C 只读 QA PASS；当前 lane done，下一步由 owner 选择 next business lane。",
  }),
};

function parseArgs(argv) {
  const [mode, ...rawRest] = argv;
  const rest = [...rawRest];
  let submode = "";
  if ((mode === "lane" || mode === "cloud-onboarding") && rest[0] && !rest[0].startsWith("--")) {
    submode = rest.shift();
  }
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item.startsWith("--")) {
      throw new Error(`unknown_positional_arg:${item}`);
    }
    const key = item.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { mode, submode, options };
}

function workflowForType(type) {
  const workflow = workflowTypes[type];
  if (!workflow) {
    throw new Error(`unknown_workflow_type:${type || "(missing)"}`);
  }
  return workflow;
}

function qaForSurface(surface) {
  const selected = qaSurfaces[surface];
  if (!selected) {
    throw new Error(`unknown_qa_surface:${surface || "(missing)"}`);
  }
  return selected;
}

function parseState(stateText) {
  if (!stateText || stateText === true) {
    throw new Error("state_json_required");
  }
  let state;
  try {
    state = JSON.parse(stateText);
  } catch {
    throw new Error("state_json_invalid");
  }
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("state_json_object_required");
  }
  const stableStatus = assertKnownStatus(state.status);
  if (!stableStatus) {
    throw new Error(`unknown_state_status:${state.status || "(missing)"}`);
  }
  return {
    ...state,
    status: state.status,
    stableStatus,
  };
}

function humanList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function humanKeyValue(items) {
  return items
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

function laneSlug(value) {
  return String(value || "")
    .replace(/^refs\/heads\//, "")
    .replace(/^(feat|cleanup|contract|spike)\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "lane";
}

function recommendedBranchForWorkflow(workflow) {
  return `${workflow.branchPrefix}v22-${workflow.label}-lane`;
}

function recommendedWorktreePathForLane(lane) {
  return `${worktreeRoot}/${laneSlug(lane)}`;
}

function disciplineLines(discipline = workspaceDiscipline) {
  return [
    discipline.mainWorkspaceRole,
    discipline.mainWorkspaceWriteReminder,
    discipline.bAuditGateRule,
    "B 使用主工作区。",
    discipline.writingLaneRule,
    "一个 worktree 只承载一条 active lane。",
    `lane 完成后走 ${discipline.completionFlow.join(" -> ")}。`,
    discipline.executionSurfaceNotTruth,
    discipline.truthRule,
    `不提交 ${discipline.nonCommittableLocalState.join("、")}。`,
  ];
}

function canonicalStatus(status) {
  return statusAliases[status] || status;
}

function assertKnownStatus(status) {
  const canonical = canonicalStatus(status);
  if (!stableStatusEnum.includes(canonical)) {
    throw new Error(`unknown_state_status:${status || "(missing)"}`);
  }
  return canonical;
}

function isSecretLikeReplyFile(filePath) {
  const normalized = String(filePath || "").replaceAll("\\", "/");
  const envName = "." + "env";
  const secretKeywords = [
    envName,
    "secret",
    "token",
    "key",
    "kubeconfig",
    "credential",
    "private",
    "pem",
  ];
  return secretKeywords.some((keyword) => normalized.toLowerCase().includes(keyword.toLowerCase()));
}

function parseReplyText(replyText, from, replyFile) {
  const fields = {};
  const lines = String(replyText || "").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const [, rawKey, rawValue] = match;
    fields[rawKey.toLowerCase()] = rawValue;
  }

  const rawStatus = fields.status || fields.state;
  const stableStatus = assertKnownStatus(rawStatus);
  const branch = fields.branch || "";
  const commit = fields.commit || "";
  const worktree = fields.worktree || "";
  const surface = fields.surface || "";
  const base = fields.base || "";
  const blocker = fields.blocker || "";
  const summary = fields.summary || "";
  const fix = fields.fix || "";

  return {
    command: "ingest",
    from,
    replyFile,
    replyText: String(replyText || "").trimEnd(),
    status: rawStatus,
    stableStatus,
    branch,
    commit,
    worktree,
    surface,
    base,
    blocker,
    summary,
    fix,
  };
}

function gitCommand(args) {
  return execFileSync("git", args, {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function currentBranchName() {
  return gitCommand(["branch", "--show-current"]) || "(unknown)";
}

function currentWorktreePath() {
  return gitCommand(["rev-parse", "--show-toplevel"]) || process.cwd();
}

function repoRootPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function readRepoText(relativePath) {
  return readFile(path.join(repoRootPath(), relativePath), "utf8");
}

function parseAnchoredJsonBlock(source, name) {
  const pattern = new RegExp(`<!-- ${name}:start -->\\s*\\\`\\\`\\\`json\\s*([\\s\\S]*?)\\s*\\\`\\\`\\\`\\s*<!-- ${name}:end -->`);
  const match = String(source || "").match(pattern);
  if (!match) {
    throw new Error(`anchored_json_block_missing:${name}`);
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`anchored_json_block_invalid:${name}:${error.message}`);
  }
}

function laneIdSafe(laneId) {
  const value = String(laneId || "");
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`invalid_lane_id:${laneId || "(missing)"}`);
  }
  return value;
}

function laneStatePath(laneId) {
  return path.join(repoRootPath(), laneStateDir, `${laneIdSafe(laneId)}.json`);
}

function relativeLaneStatePath(laneId) {
  return `${laneStateDir}/${laneIdSafe(laneId)}.json`;
}

async function ensureLaneStateDir() {
  await mkdir(path.join(repoRootPath(), laneStateDir), { recursive: true });
}

async function writeJsonAtomic(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function readLane(laneId) {
  const filePath = laneStatePath(laneId);
  const source = await readFile(filePath, "utf8");
  return JSON.parse(source);
}

async function writeLane(lane) {
  await writeJsonAtomic(laneStatePath(lane.id), lane);
}

async function listLanes() {
  await ensureLaneStateDir();
  const dirPath = path.join(repoRootPath(), laneStateDir);
  const entries = await readdir(dirPath, { withFileTypes: true });
  const lanes = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const source = await readFile(path.join(dirPath, entry.name), "utf8");
    lanes.push(JSON.parse(source));
  }
  return lanes.sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function nowIso() {
  return new Date().toISOString();
}

function packageContractsForType(type) {
  const workflow = workflowTypes[type === "workflow" ? "contract" : type];
  if (type === "workflow") {
    return [
      "AGENTS.md",
      "docs/vibe-coding.md",
      "docs/contracts/README.md",
      "docs/recovery/status-matrix.md",
      "scripts/smoke-test-v22-agent-workflow-orchestrator.mjs",
      "scripts/smoke-test-v22-workflow-gate.mjs",
    ];
  }
  if (!workflow) return stageDocuments;
  return workflow.contracts;
}

function validationCommandsForType(type) {
  if (type === "workflow") {
    return [
      "node scripts/smoke-test-v22-agent-workflow-orchestrator.mjs",
      "node scripts/smoke-test-v22-workflow-gate.mjs",
      "git diff --check -- scripts docs .gitignore",
    ];
  }
  const workflow = workflowTypes[type];
  return workflow?.validations || [
    "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "git diff --check -- scripts docs",
  ];
}

function createLaneRecord({ id, type, goal, owner, branch, worktree }) {
  const laneId = laneIdSafe(id);
  if (!workflowTypes[type] && type !== "workflow") {
    throw new Error(`unknown_lane_type:${type || "(missing)"}`);
  }
  if (!["A", "C", "D"].includes(owner)) {
    throw new Error(`invalid_lane_owner:${owner || "(missing)"}`);
  }
  if (!goal || goal === true) {
    throw new Error("lane_goal_required");
  }
  if (!branch || branch === true) {
    throw new Error("lane_branch_required");
  }
  if (!worktree || worktree === true) {
    throw new Error("lane_worktree_required");
  }
  const timestamp = nowIso();
  return {
    schemaVersion: 1,
    id: laneId,
    type,
    goal,
    owner,
    branch,
    worktree,
    status: "LANE_INITIALIZED",
    latestCommit: "",
    pendingOwner: owner,
    nextWindow: owner,
    nextAction: "start work in owner worktree",
    blockerCount: 0,
    blockers: [],
    completed: [],
    subscribedContracts: packageContractsForType(type),
    verificationCommands: validationCommandsForType(type),
    forbiddenActions,
    runtimeStatePath: relativeLaneStatePath(laneId),
    runtimeStateTracked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [
      {
        at: timestamp,
        from: "system",
        status: "LANE_INITIALIZED",
        summary: "lane state initialized",
      },
    ],
    closed: null,
  };
}

function nextForStableStatus(stableStatus, state) {
  const transition = createIngestTransitionPack({ stableStatus, state });
  return transition;
}

function updateLaneFromIngest(lane, parsedState, from, transition) {
  const timestamp = nowIso();
  const blocker = parsedState.blocker || "";
  const completed = [...(lane.completed || [])];
  if (parsedState.summary) completed.push(parsedState.summary);
  if (parsedState.fix) completed.push(parsedState.fix);
  const blockers = [...(lane.blockers || [])];
  if (blocker) {
    blockers.push({
      at: timestamp,
      from,
      status: parsedState.stableStatus,
      text: blocker,
    });
  }
  return {
    ...lane,
    owner: transition.next.window,
    status: parsedState.stableStatus,
    branch: parsedState.branch || lane.branch,
    worktree: parsedState.worktree || lane.worktree,
    latestCommit: parsedState.commit || lane.latestCommit,
    pendingOwner: transition.next.window,
    nextWindow: transition.next.window,
    nextAction: transition.next.action,
    blockerCount: blockers.length,
    blockers,
    completed,
    updatedAt: timestamp,
    events: [
      ...(lane.events || []),
      {
        at: timestamp,
        from,
        status: parsedState.stableStatus,
        commit: parsedState.commit,
        summary: parsedState.summary || parsedState.fix || parsedState.blocker || "",
      },
    ],
  };
}

function worktreeClean(worktreePath) {
  try {
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: worktreePath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return output.length === 0;
  } catch {
    return false;
  }
}

function mainWorkspaceClean() {
  return worktreeClean("/home/dev/projects/platform-v22");
}

function branchMergeReady(lane) {
  return lane.status === "B_MERGED";
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createStartPack({ type }) {
  const workflow = workflowForType(type);
  const recommendedBranch = recommendedBranchForWorkflow(workflow);
  const recommendedWorktreePath = recommendedWorktreePathForLane(workflow.label);
  const packages = {
    A: {
      window: "A",
      title: `A 窗口任务包：${workflow.label}`,
      recommendedBranch,
      recommendedWorktreePath,
      workspace: "independent-worktree",
      prompt: [
        `从 ${workflow.branchPrefix}<name> 开始，只做一个明确意图：${workflow.intent}`,
        `推荐 branch：${recommendedBranch}`,
        `推荐 worktree 路径：${recommendedWorktreePath}`,
        "先读取阶段文档和订阅合同，声明边界，再按 smoke -> 实现 -> 验证 -> commit 推进。",
        "本窗口只产出本地变更和 commit，不执行合并、推送或外部系统动作。",
      ],
      requiredReading: stageDocuments,
      contracts: workflow.contracts,
      validationCommands: workflow.validations,
    },
    B: {
      window: "B",
      title: "B 窗口任务包：审计 / 合并前复审",
      workspace: "main",
      prompt: [
        "B 使用主工作区；主工作区不可写，除规划、审计、ff-only 合并、checkpoint、push、清理外不承载开发改动。",
        "复审 A 分支是否只服务一个意图，合同订阅是否完整，smoke 是否覆盖边界。",
        "检查污染风险、secret hygiene、验证结果、工作区状态和合并条件。",
        "本包只给审查步骤；是否合并由 B 依据审查结果人工执行。",
      ],
      validationCommands: [
        "node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk",
        ...workflow.validations,
        "git diff --check -- scripts docs",
      ],
    },
    C: {
      window: "C",
      title: "C 窗口任务包：并行只读 QA",
      workspace: "independent-worktree-if-writing",
      recommendedWorktreePath: recommendedWorktreePathForLane(`c-qa-${workflow.label}`),
      prompt: [
        "A/C/D 使用独立 worktree；C 当前只读 QA 不写文件，若要写入修复必须拆独立 lane。",
        workflow.cScope,
        "只读浏览、截图、记录边界问题；不得改代码、不得触发状态变更。",
        "发现 blocker 时输出复现、截图要求、影响面和建议交回 A/B 的窗口。",
      ],
      recommendedSurfaces: Object.keys(qaSurfaces),
    },
  };

  return {
    ok: true,
    command: "start",
    type,
    recommendedBranch,
    recommendedWorktreePath,
    workspaceDiscipline,
    packages,
    nextRecommendation: "先把 A 窗口任务包发给开发窗口；B 等 A_COMMITTED 后使用 review-pack；C 可并行使用 c-qa-pack 做只读 QA。",
    disallowedActions,
  };
}

function compactCloudOnboardingPhase(phase) {
  return {
    phaseId: phase.phaseId,
    phaseName: phase.phaseName,
    status: phase.status,
    owner: phase.owner,
    handoffTarget: handoffTargetForCloudOwner(phase.owner),
    nextAction: phase.nextAction,
  };
}

function handoffTargetForCloudOwner(owner) {
  if (owner === "A" || owner === "B" || owner === "C" || owner === "D") return owner;
  if (owner === "user") return "D";
  return "A";
}

function nodeCommandsForSmoke(smokeList) {
  return (smokeList || [])
    .filter((item) => String(item).startsWith("scripts/"))
    .map((item) => `node ${item}`);
}

function phaseLabel(phase) {
  if (!phase) return "";
  return `${phase.phaseId} ${phase.phaseName}`;
}

function buildCloudOnboardingPhaseSummary(phases) {
  const summary = {
    done: [],
    pending: [],
    blocked: [],
    needsUserAuthorization: [],
    active: [],
    starterLiveDone: [],
  };
  for (const phase of phases) {
    const compact = compactCloudOnboardingPhase(phase);
    if (phase.status === "needs-user-authorization") {
      summary.needsUserAuthorization.push(compact);
    } else if (String(phase.status).startsWith("starter-")) {
      summary.starterLiveDone.push(compact);
    } else if (summary[phase.status]) {
      summary[phase.status].push(compact);
    }
  }
  return summary;
}

function cloudOnboardingHandoffGuidance() {
  return {
    A: "窗口 A：使用独立 worktree 做本地实现、合同、smoke 和任务包准备；不触发真实外部副作用。",
    B: "窗口 B：使用主工作区做审查、默认 gate、checkpoint 和人工合并判断；脚本不自动合并或推送。",
    C: "窗口 C：做只读 QA、状态核对和 report 审查输入；需要写文件时拆独立 lane。",
    D: "窗口 D：承接用户授权 gate 和后续串行真实外部副作用协调；没有明确授权时保持阻断。",
  };
}

function buildCloudOnboardingTaskPackets({ checkConfigPhase, defaultGatePhase, userLivePhase }) {
  const checkConfigCommands = nodeCommandsForSmoke(checkConfigPhase?.requiredSmoke);
  const defaultGateCommands = [
    "node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk",
    ...nodeCommandsForSmoke(defaultGatePhase?.requiredSmoke),
  ];
  const reviewCommands = [
    "node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk",
    "node scripts/smoke-test-v22-agent-workflow-cloud-onboarding.mjs",
    "node scripts/smoke-test-v22-cloud-onboarding-board-status.mjs",
    "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
    "git diff --check -- scripts docs/recovery docs/contracts",
  ];

  return [
    {
      id: "check-config",
      title: "check-config task packet",
      phaseId: checkConfigPhase?.phaseId || "CO-04",
      phaseName: checkConfigPhase?.phaseName || "check-config",
      status: checkConfigPhase?.status || "pending",
      handoffTarget: "A",
      requiredSmoke: checkConfigPhase?.requiredSmoke || [],
      userGate: checkConfigPhase?.userGate || "",
      suggestedCommands: checkConfigCommands,
      allowedActions: ["read tracked docs", "run local smoke", "prepare task packet"],
      forbiddenActions: sharedBoundaries,
    },
    {
      id: "default-gate",
      title: "default gate task packet",
      phaseId: defaultGatePhase?.phaseId || "CO-05",
      phaseName: defaultGatePhase?.phaseName || "default gate",
      status: defaultGatePhase?.status || "pending",
      handoffTarget: "B",
      requiredSmoke: defaultGatePhase?.requiredSmoke || [],
      userGate: defaultGatePhase?.userGate || "",
      suggestedCommands: defaultGateCommands,
      allowedActions: ["review fail-closed default path", "check TC3 diagnostic-only boundary", "record blocker or pass"],
      forbiddenActions: sharedBoundaries,
    },
    {
      id: "user-authorized-readonly-live",
      title: "user-authorized readonly live task packet",
      phaseId: userLivePhase?.phaseId || "CO-06",
      phaseName: userLivePhase?.phaseName || "user-authorized readonly live",
      status: userLivePhase?.status || "needs-user-authorization",
      handoffTarget: "D",
      requiredSmoke: userLivePhase?.requiredSmoke || [],
      userGate: userLivePhase?.userGate || "",
      needsUserAuthorization: true,
      blockedReason: "needs_explicit_user_authorization",
      suggestedCommands: [],
      allowedActions: ["ask user for explicit authorization scope", "record authorization decision"],
      forbiddenActions: sharedBoundaries,
    },
    {
      id: "b-review-merge",
      title: "B review/merge task packet",
      phaseId: defaultGatePhase?.phaseId || "CO-05",
      phaseName: "B review and manual merge decision",
      status: "pending",
      handoffTarget: "B",
      requiredSmoke: [
        "scripts/smoke-test-v22-agent-workflow-cloud-onboarding.mjs",
        "scripts/smoke-test-v22-cloud-onboarding-board-status.mjs",
        "scripts/smoke-test-v22-mvp-contract-suite.mjs",
      ],
      userGate: "stop before merge/push or any live path",
      requiresManualMergeDecision: true,
      suggestedCommands: reviewCommands,
      allowedActions: ["review diff", "record findings", "decide whether manual ff-only merge is allowed"],
      forbiddenActions: sharedBoundaries,
    },
  ];
}

function buildBoardCurrentTaskPacket(board = {}) {
  return {
    id: "cloud-harness-l1-l4-refactor",
    title: "Cloud harness L1-L4 refactor task packet",
    phaseId: "L1-L4",
    phaseName: "production cloud operation harness",
    status: "starter-live-done",
    handoffTarget: "B",
    requiredSmoke: [
      "scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs",
      "scripts/smoke-test-v22-portal-runtime-startup-config.mjs",
      "scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs",
      "scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs",
      "scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs",
      "scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs",
      "scripts/smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs",
      "scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs",
      "scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs",
      "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs",
      "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs",
      "scripts/smoke-test-v22-mvp-contract-suite.mjs",
    ],
    userGate: "starter minimal live loop is recorded; future pro, upgrade, add-storage, dedicated node pool, or full matrix live reruns need separate authorization; node pool baseline desired/current must remain 2 and cleanup must return to 2",
    requiresManualMergeDecision: true,
    suggestedCommands: [
      "node scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs",
      "node scripts/smoke-test-v22-portal-runtime-startup-config.mjs",
      "node scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs",
      "node scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs",
      "node scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs",
      "node scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs",
      "node scripts/smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs",
      "node scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs",
      "node scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs",
      "node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
      "node scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs",
      "node scripts/smoke-test-v22-portal-frontend-surface-eval.mjs",
      "node scripts/smoke-test-v22-mvp-contract-suite.mjs",
      "git diff --check -- scripts docs/recovery docs/contracts services/portal",
    ],
    allowedActions: ["review rebase", "run local harness smoke", "record B absorption decision"],
    forbiddenActions: sharedBoundaries,
  };
}

async function readCloudOnboardingData() {
  const [boardSource, statusSource] = await Promise.all([
    readRepoText(cloudOnboardingBoardPath),
    readRepoText(cloudOnboardingStatusTablePath),
  ]);
  return {
    board: parseAnchoredJsonBlock(boardSource, "v22-cloud-onboarding-execution-board"),
    statusTable: parseAnchoredJsonBlock(statusSource, "v22-cloud-onboarding-status-table"),
  };
}

async function createCloudOnboardingStatusPack() {
  const { board, statusTable } = await readCloudOnboardingData();
  const phases = statusTable.phases || [];
  const activePhase = phases.find((phase) => phase.status === "active")
    || phases.find((phase) => phase.status === "needs-user-authorization" && phase.phaseName.includes("readonly live"));
  const activeIndex = activePhase ? phases.indexOf(activePhase) : -1;
  const nextPhase = phases.slice(activeIndex + 1).find((phase) => ["pending", "needs-user-authorization", "blocked"].includes(phase.status))
    || phases.find((phase) => phase.status === "pending")
    || phases.find((phase) => phase.status === "needs-user-authorization");
  const checkConfigPhase = phases.find((phase) => phase.phaseName === "check-config");
  const defaultGatePhase = phases.find((phase) => phase.phaseName === "default gate");
  const userLivePhase = phases.find((phase) => phase.status === "needs-user-authorization" && phase.phaseName.includes("readonly live"));
  const taskPackets = buildCloudOnboardingTaskPackets({
    checkConfigPhase,
    defaultGatePhase,
    userLivePhase,
  });
  const boardCurrentTaskPacket = buildBoardCurrentTaskPacket(board);
  const currentTaskPacket = board.authorizedStorageCreateCanaryDone ? boardCurrentTaskPacket : null;

  return {
    ok: true,
    command: "cloud-onboarding status",
    programId: statusTable.programId || board.programId,
    currentPhase: board.currentPhase,
    activeLane: board.currentLane || phaseLabel(activePhase),
    nextLane: board.nextLane || phaseLabel(nextPhase),
    handoffTarget: currentTaskPacket?.handoffTarget || handoffTargetForCloudOwner(activePhase?.owner),
    requiredSmoke: currentTaskPacket?.requiredSmoke || activePhase?.requiredSmoke || [],
    userGate: currentTaskPacket?.userGate || activePhase?.userGate || "",
    phaseSummary: buildCloudOnboardingPhaseSummary(phases),
    runnablePath: cloudOnboardingRunnablePath,
    serialRealSideEffects: board.serialRealSideEffects || [],
    handoffGuidance: cloudOnboardingHandoffGuidance(),
    taskPackets: [boardCurrentTaskPacket, ...taskPackets],
    sourceDocuments: {
      executionBoard: cloudOnboardingBoardPath,
      statusTable: cloudOnboardingStatusTablePath,
      workflowContract: cloudOnboardingWorkflowContractPath,
      harnessManifest: cloudHarnessManifestPath,
    },
    safety: {
      printsRecommendationsOnly: true,
      readsSecretNow: false,
      callsRealCloudNow: false,
      automerges: false,
      autopushes: false,
      serializesRealExternalSideEffects: true,
    },
    disallowedActions,
  };
}

async function createCloudOnboardingNextPack() {
  const statusPack = await createCloudOnboardingStatusPack();
  const nextTaskPacket = statusPack.taskPackets.find((packet) => packet.id === "cloud-harness-l1-l4-refactor")
    || statusPack.taskPackets.find((packet) => packet.phaseId && statusPack.activeLane === phaseLabel(packet))
    || statusPack.taskPackets.find((packet) => packet.status === "active")
    || statusPack.taskPackets[0];
  return {
    ...statusPack,
    command: "cloud-onboarding next",
    nextTaskPacket,
  };
}

function createReviewPack({ branch, base }) {
  if (!branch || branch === true) {
    throw new Error("branch_required");
  }
  const targetBase = base && base !== true ? base : "recovery/platform-v22-trunk";
  const recommendedWorktreePath = recommendedWorktreePathForLane(branch);
  const verificationCommands = [
    `git diff --name-only ${targetBase}...${branch}`,
    `node scripts/v22-workflow-gate.mjs review --base ${targetBase}`,
    "node scripts/smoke-test-v22-agent-workflow-orchestrator.mjs",
    "node scripts/smoke-test-v22-workflow-gate.mjs",
    "git diff --check -- scripts docs",
  ];
  const mergeConditions = [
    "工作区干净",
    "分支只服务一个明确意图",
    "合同订阅完整且无冲突",
    "没有未授权路径改动",
    "没有 secret 或内部令牌进入 diff、日志或 evidence",
    "所有本地验证命令通过",
    "B 窗口确认可以 ff-only 合回 recovery/platform-v22-trunk",
    "A/C/D 写入工作已经在独立 worktree 完成，主工作区仅用于 B 审计和合并前后 checkpoint",
  ];
  return {
    ok: true,
    command: "review-pack",
    window: "B",
    branch,
    base: targetBase,
    recommendedBranch: branch,
    recommendedWorktreePath,
    workspaceDiscipline,
    prompt: [
      `审查 ${branch} 相对 ${targetBase} 的 diff。`,
      "B 使用主工作区；主工作区不可写，除 B 审计、ff-only 合并、checkpoint、push、清理外不承载开发改动。",
      "优先找 blocker：合同不一致、污染风险、secret hygiene、未授权路径、未验证变更、隐式缺参或伪通过。",
      "审查输出先列 findings，再列验证证据和合并判断。",
    ],
    verificationCommands,
    mergeConditions,
    disallowedActions,
  };
}

function createQaPack({ surface }) {
  const selected = qaForSurface(surface);
  const recommendedWorktreePath = recommendedWorktreePathForLane(`c-qa-${surface}`);
  return {
    ok: true,
    command: "c-qa-pack",
    window: "C",
    surface,
    recommendedBranch: `qa/v22-c-${surface}-readonly`,
    recommendedWorktreePath,
    workspaceDiscipline,
    prompt: selected.prompt,
    screenshotRequirements: selected.screenshots,
    boundaryChecks: [
      ...selected.checks,
      workspaceDiscipline.writingLaneRule,
      workspaceDiscipline.truthRule,
    ],
    disallowedActions,
  };
}

function createFixPack({ state, window = "A" } = {}) {
  const branch = state?.branch || "<branch>";
  return {
    ok: true,
    command: "fix-pack",
    window,
    stableStatus: state?.stableStatus || "B_BLOCKER",
    branch,
    prompt: [
      `A fix-pack：修复 ${branch} 的 blocker。`,
      `blocker: ${state?.blocker || "<blocker>"}`,
      "在独立 worktree 完成修复。",
      "修复后回复 status: A_FIXED。",
    ],
    verificationCommands: [
      "node scripts/smoke-test-v22-agent-workflow-orchestrator.mjs",
      "node scripts/smoke-test-v22-workflow-gate.mjs",
      "git diff --check -- scripts docs",
    ],
    recommendedBranch: branch,
    recommendedWorktreePath: `${worktreeRoot}/${laneSlug(branch)}`,
    workspaceDiscipline,
    disallowedActions,
  };
}

function createReReviewPack({ state } = {}) {
  const branch = state?.branch || "<branch>";
  return {
    ok: true,
    command: "re-review-pack",
    window: "B",
    stableStatus: state?.stableStatus || "A_FIXED",
    branch,
    prompt: [
      `B re-review-pack：复审修复 commit ${state?.commit || "<commit>"}.`,
      "确认 blocker 已消失，继续下一轮审查。",
      "B 使用主工作区；主工作区不可写。",
    ],
    verificationCommands: [
      "node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk",
      "node scripts/smoke-test-v22-agent-workflow-orchestrator.mjs",
      "node scripts/smoke-test-v22-workflow-gate.mjs",
    ],
    mergeConditions: [
      "工作区干净",
      "复修 commit 已解释 blocker",
      "没有新的 secret 或未授权路径",
    ],
    recommendedBranch: branch,
    recommendedWorktreePath: "/home/dev/projects/platform-v22",
    workspaceDiscipline,
    disallowedActions,
  };
}

function createDonePack({ state } = {}) {
  return {
    ok: true,
    command: "done",
    window: "D",
    stableStatus: state?.stableStatus || "C_PASS",
    branch: state?.branch || "<branch>",
    prompt: [
      "lane done。",
      "下一步由 owner 选择 next business lane suggestion。",
      "不要自动 merge、push 或启动 " + "t" + "mux。",
    ],
    nextBusinessLaneSuggestion: "根据 trunk 最新业务需求开启下一条独立 lane。",
    recommendedBranch: state?.branch || "<branch>",
    recommendedWorktreePath: "/home/dev/projects/platform-v22.worktrees/next-business-lane",
    workspaceDiscipline,
    disallowedActions,
  };
}

function createOwnerActionPack({ lane }) {
  return {
    ok: true,
    command: "owner-action-pack",
    window: lane.nextWindow || lane.owner,
    stableStatus: lane.status,
    branch: lane.branch,
    prompt: [
      `继续 lane ${lane.id}: ${lane.goal}`,
      `branch: ${lane.branch}`,
      `worktree: ${lane.worktree}`,
      `next action: ${lane.nextAction}`,
      "A/C/D 写文件默认在独立 worktree；B 的人工审计闸门不能被绕过。",
    ],
    verificationCommands: lane.verificationCommands,
    recommendedBranch: lane.branch,
    recommendedWorktreePath: lane.worktree,
    workspaceDiscipline,
    disallowedActions,
  };
}

function createCheckpointPack() {
  return {
    ok: true,
    command: "checkpoint-pack",
    window: "B",
    recommendedBranch: "recovery/platform-v22-trunk",
    recommendedWorktreePath: "/home/dev/projects/platform-v22",
    workspaceDiscipline,
    prompt: "B push 前 checkpoint：只做人工确认清单和下一步建议；本脚本不执行任何合并或推送。",
    checklist: [
      workspaceDiscipline.mainWorkspaceRole,
      "确认当前分支是 recovery/platform-v22-trunk。",
      "确认工作区干净。",
      "确认本地 trunk 包含已审分支 commit。",
      "确认 remote 不含 token/PAT，且 push 由 B 窗口人工执行。",
      "确认验证命令、审查结果、C 只读 QA 结果已经记录。",
      "确认没有未授权真实外部系统动作。",
    ],
    nextRecommendation: "checkpoint 通过后，B 才能人工执行 push；checkpoint 不通过时回到对应窗口修正。",
    disallowedActions,
  };
}

function createIngestTransitionPack({ stableStatus, state }) {
  if (stableStatus === "A_COMMITTED") {
    const pack = createReviewPack({ branch: state.branch || "<branch>", base: state.base || "recovery/platform-v22-trunk" });
    return { next: { window: "B", action: "review-pack" }, pack };
  }
  if (stableStatus === "B_BLOCKER") {
    const pack = createFixPack({ state, window: "A" });
    return { next: { window: "A", action: "fix-pack" }, pack };
  }
  if (stableStatus === "A_FIXED") {
    const pack = createReReviewPack({ state });
    return { next: { window: "B", action: "re-review-pack" }, pack };
  }
  if (stableStatus === "B_MERGED") {
    const pack = createCheckpointPack();
    return { next: { window: "B", action: "checkpoint-pack" }, pack };
  }
  if (stableStatus === "B_PUSHED") {
    const pack = createQaPack({ surface: state.surface || "overview" });
    return { next: { window: "C", action: "qa-pack" }, pack };
  }
  if (stableStatus === "C_BLOCKER") {
    const pack = createFixPack({ state, window: "A" });
    return { next: { window: "A", action: "fix-pack" }, pack };
  }
  if (stableStatus === "C_PASS") {
    const pack = createDonePack({ state });
    return { next: { window: "D", action: "done" }, pack };
  }
  throw new Error(`unknown_state_status:${stableStatus}`);
}

function createWritePack({ window, state }) {
  const stableStatus = state.stableStatus || assertKnownStatus(state.status);
  if (window === "A") {
    if (stableStatus === "B_BLOCKER" || stableStatus === "C_BLOCKER") {
      return createFixPack({ state: { ...state, stableStatus }, window: "A" });
    }
    return {
      ok: true,
      command: "write-pack",
      window,
      stableStatus,
      branch: state.branch || "<branch>",
      prompt: [
        `A write-pack：为 ${state.branch || "<branch>"} 生成待复制 prompt。`,
        `当前状态: ${stableStatus}`,
      ],
      recommendedBranch: state.branch || "<branch>",
      recommendedWorktreePath: `${worktreeRoot}/${laneSlug(state.branch || "a-lane")}`,
      workspaceDiscipline,
      disallowedActions,
    };
  }
  if (window === "B") {
    if (stableStatus === "A_COMMITTED") {
      return createReviewPack({ branch: state.branch || "<branch>", base: state.base || "recovery/platform-v22-trunk" });
    }
    if (stableStatus === "A_FIXED") {
      return createReReviewPack({ state: { ...state, stableStatus } });
    }
    if (stableStatus === "B_MERGED") {
      return createCheckpointPack();
    }
    return {
      ok: true,
      command: "write-pack",
      window,
      stableStatus,
      branch: state.branch || "<branch>",
      prompt: [
        `B write-pack：为 ${state.branch || "<branch>"} 生成待复制 prompt。`,
        `当前状态: ${stableStatus}`,
      ],
      recommendedBranch: state.branch || "<branch>",
      recommendedWorktreePath: "/home/dev/projects/platform-v22",
      workspaceDiscipline,
      disallowedActions,
    };
  }
  if (window === "C") {
    if (stableStatus === "B_PUSHED") {
      return createQaPack({ surface: state.surface || "overview" });
    }
    if (stableStatus === "C_PASS") {
      return createDonePack({ state: { ...state, stableStatus } });
    }
    return {
      ok: true,
      command: "write-pack",
      window,
      stableStatus,
      branch: state.branch || "<branch>",
      prompt: [
        `C write-pack：为 ${state.branch || "<branch>"} 生成只读 QA prompt。`,
        `当前状态: ${stableStatus}`,
      ],
      recommendedBranch: state.branch || "<branch>",
      recommendedWorktreePath: `${worktreeRoot}/${laneSlug(`c-${state.surface || "qa"}`)}`,
      workspaceDiscipline,
      disallowedActions,
    };
  }
  if (window === "D") {
    return createDonePack({ state: { ...state, stableStatus } });
  }
  throw new Error(`unknown_window:${window || "(missing)"}`);
}

function createStatusPack({ state = null } = {}) {
  const branch = currentBranchName();
  const worktree = currentWorktreePath();
  const stableStatus = state ? (state.stableStatus || assertKnownStatus(state.status)) : "STATE_REQUIRED";
  const pendingOwner = state?.next?.window || (stableStatus === "STATE_REQUIRED" ? "A/B/C/D" : "owner");
  const nextAction = state?.next?.action || "ingest --from <A|B|C|D> --file <reply.txt>";
  return {
    ok: true,
    command: "status",
    laneStatus: stableStatus,
    branch: state?.branch || branch,
    worktree: state?.worktree || worktree,
    pendingOwner,
    nextAction,
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createIngestPack({ from, replyFile }) {
  if (!["A", "B", "C", "D"].includes(from)) {
    throw new Error(`unknown_from_window:${from || "(missing)"}`);
  }
  if (!replyFile || replyFile === true) {
    throw new Error("reply_file_required");
  }
  if (isSecretLikeReplyFile(replyFile)) {
    throw new Error("secret_like_reply_file_rejected");
  }
  const normalizedReplyFile = String(replyFile);
  const replyText = await readFile(normalizedReplyFile, "utf8");
  const state = parseReplyText(replyText, from, normalizedReplyFile);
  const transition = createIngestTransitionPack({ stableStatus: state.stableStatus, state });
  return {
    ok: true,
    command: "ingest",
    from,
    replyFile: normalizedReplyFile,
    state,
    stableStatus: state.stableStatus,
    next: transition.next,
    pack: transition.pack,
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createLaneInitPack(options) {
  const lane = createLaneRecord(options);
  await ensureLaneStateDir();
  await writeLane(lane);
  return {
    ok: true,
    command: "lane init",
    lane,
    message: "repo-governed lane state initialized",
    runtimeStatePath: lane.runtimeStatePath,
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createLaneIngestPack({ id, from, replyFile }) {
  const lane = await readLane(id);
  const ingest = await createIngestPack({ from, replyFile });
  const updatedLane = updateLaneFromIngest(lane, ingest.state, from, ingest);
  await writeLane(updatedLane);
  return {
    ok: true,
    command: "lane ingest",
    lane: updatedLane,
    stableStatus: ingest.stableStatus,
    next: ingest.next,
    pack: ingest.pack,
    runtimeStatePath: updatedLane.runtimeStatePath,
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createLaneNextPack({ id }) {
  const lane = await readLane(id);
  if (!stableStatusEnum.includes(lane.status)) {
    const pack = createOwnerActionPack({ lane });
    return {
      ok: true,
      command: "lane next",
      lane,
      stableStatus: lane.status,
      next: { window: lane.nextWindow, action: lane.nextAction },
      pack,
      workspaceDiscipline,
      disallowedActions,
    };
  }
  const state = {
    status: lane.status,
    stableStatus: assertKnownStatus(lane.status),
    branch: lane.branch,
    commit: lane.latestCommit,
    blocker: lane.blockers?.at(-1)?.text || "",
    surface: lane.surface || "overview",
  };
  const transition = nextForStableStatus(state.stableStatus, state);
  return {
    ok: true,
    command: "lane next",
    lane,
    stableStatus: state.stableStatus,
    next: transition.next,
    pack: transition.pack,
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createLaneBoardPack() {
  const lanes = await listLanes();
  const mainClean = mainWorkspaceClean();
  const rows = lanes.map((lane) => ({
    id: lane.id,
    branch: lane.branch,
    worktree: lane.worktree,
    owner: lane.owner,
    status: lane.status,
    latestCommit: lane.latestCommit,
    nextWindow: lane.nextWindow,
    nextAction: lane.nextAction,
    blockerCount: lane.blockerCount || 0,
    mainWorkspaceClean: mainClean,
    mergeReady: branchMergeReady(lane),
  }));
  return {
    ok: true,
    command: "lane board",
    lanes: rows,
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createLaneHandoffPack({ id }) {
  const lane = await readLane(id);
  const transition = stableStatusEnum.includes(lane.status)
    ? nextForStableStatus(lane.status, {
      status: lane.status,
      stableStatus: lane.status,
      branch: lane.branch,
      commit: lane.latestCommit,
      blocker: lane.blockers?.at(-1)?.text || "",
      surface: lane.surface || "overview",
    })
    : { next: { window: lane.nextWindow, action: lane.nextAction } };
  return {
    ok: true,
    command: "lane handoff",
    lane,
    bundle: {
      currentGoal: lane.goal,
      completed: lane.completed || [],
      currentBlocker: lane.blockers?.at(-1)?.text || "none",
      subscribedContracts: lane.subscribedContracts,
      worktree: lane.worktree,
      branch: lane.branch,
      verificationCommands: lane.verificationCommands,
      nextAction: transition.next.action,
      nextWindow: transition.next.window,
      forbiddenActions,
    },
    workspaceDiscipline,
    disallowedActions,
  };
}

async function createLaneClosePack({ id, status }) {
  const closeStatus = String(status || "");
  if (!["merged", "abandoned", "superseded"].includes(closeStatus)) {
    throw new Error(`invalid_lane_close_status:${status || "(missing)"}`);
  }
  const lane = await readLane(id);
  const timestamp = nowIso();
  const worktreeExists = await pathExists(lane.worktree);
  const clean = worktreeExists ? worktreeClean(lane.worktree) : false;
  const updatedLane = {
    ...lane,
    status: `LANE_${closeStatus.toUpperCase()}`,
    pendingOwner: "B",
    nextWindow: "B",
    nextAction: "cleanup checklist",
    updatedAt: timestamp,
    closed: {
      at: timestamp,
      status: closeStatus,
    },
    events: [
      ...(lane.events || []),
      {
        at: timestamp,
        from: "system",
        status: `LANE_${closeStatus.toUpperCase()}`,
        summary: "lane closed",
      },
    ],
  };
  await writeLane(updatedLane);
  return {
    ok: true,
    command: "lane close",
    lane: updatedLane,
    cleanupChecklist: [
      {
        item: "worktree 是否可删除",
        ok: worktreeExists && clean,
      },
      {
        item: "branch 是否可删除",
        ok: closeStatus !== "merged" ? true : false,
      },
      {
        item: "是否已 push",
        ok: closeStatus === "merged",
      },
      {
        item: "是否有未提交文件",
        ok: clean,
      },
      {
        item: "runtime state 需要归档或删除",
        ok: true,
      },
    ],
    workspaceDiscipline,
    disallowedActions,
  };
}

function renderPromptBlock(prompt) {
  if (Array.isArray(prompt)) {
    return humanList(prompt);
  }
  return String(prompt || "");
}

function renderActionPack(pack) {
  return [
    `# ${pack.window} ${pack.command}`,
    "",
    "## prompt",
    renderPromptBlock(pack.prompt),
    "",
    "## recommended branch",
    pack.recommendedBranch,
    "",
    "## recommended worktree",
    pack.recommendedWorktreePath,
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderIngestPack(pack) {
  return [
    `# ingest: ${pack.from} -> ${pack.stableStatus}`,
    "",
    `stableStatus: ${pack.stableStatus}`,
    `next: ${pack.next.window} ${pack.next.action}`,
    "",
    "## reply state",
    humanKeyValue([
      ["from", pack.from],
      ["branch", pack.state.branch],
      ["commit", pack.state.commit],
      ["worktree", pack.state.worktree],
      ["base", pack.state.base],
      ["surface", pack.state.surface],
      ["blocker", pack.state.blocker],
      ["summary", pack.state.summary],
      ["fix", pack.state.fix],
    ]),
    "",
    "## next pack",
    renderPack(pack.pack),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderStatusPack(pack) {
  return [
    "# lane status",
    "",
    humanKeyValue([
      ["laneStatus", pack.laneStatus],
      ["branch", pack.branch],
      ["worktree", pack.worktree],
      ["pendingOwner", pack.pendingOwner],
      ["nextAction", pack.nextAction],
    ]),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderLaneSummary(lane) {
  return humanKeyValue([
    ["lane id", lane.id],
    ["type", lane.type],
    ["goal", lane.goal],
    ["branch", lane.branch],
    ["worktree", lane.worktree],
    ["owner", lane.owner],
    ["status", lane.status],
    ["latest commit", lane.latestCommit],
    ["pending owner", lane.pendingOwner],
    ["next window", lane.nextWindow],
    ["next action", lane.nextAction],
    ["blockerCount", lane.blockerCount],
    ["runtime state", lane.runtimeStatePath],
    ["runtimeStateTracked", String(lane.runtimeStateTracked)],
  ]);
}

function renderLaneInitPack(pack) {
  return [
    "# lane init",
    "",
    pack.message,
    "",
    "## repo-governed lane state",
    renderLaneSummary(pack.lane),
    "",
    "## repo-tracked truth",
    humanList(repoGovernanceTruth),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderLaneIngestPack(pack) {
  return [
    `# lane ingest: ${pack.lane.id} -> ${pack.stableStatus}`,
    "",
    renderLaneSummary(pack.lane),
    "",
    `next: ${pack.next.window} ${pack.next.action}`,
    "",
    "## next pack",
    renderPack(pack.pack),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderLaneNextPack(pack) {
  return [
    `# lane next: ${pack.lane.id}`,
    "",
    renderLaneSummary(pack.lane),
    "",
    `next: ${pack.next.window} ${pack.next.action}`,
    "",
    "## next pack",
    renderPack(pack.pack),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderLaneBoardPack(pack) {
  const rows = pack.lanes.map((lane) => [
    `### ${lane.id}`,
    humanKeyValue([
      ["branch", lane.branch],
      ["worktree", lane.worktree],
      ["owner", lane.owner],
      ["status", lane.status],
      ["latest commit", lane.latestCommit],
      ["next window", lane.nextWindow],
      ["next action", lane.nextAction],
      ["blockerCount", lane.blockerCount],
      ["mainWorkspaceClean", String(lane.mainWorkspaceClean)],
      ["mergeReady", String(lane.mergeReady)],
    ]),
  ].join("\n")).join("\n\n");
  return [
    "# lane board",
    "",
    rows || "no lanes",
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderLaneHandoffPack(pack) {
  return [
    `# handoff bundle: ${pack.lane.id}`,
    "",
    "## 当前目标",
    pack.bundle.currentGoal,
    "",
    "## 已完成",
    pack.bundle.completed.length ? humanList(pack.bundle.completed) : "- none",
    "",
    "## 当前 blocker",
    pack.bundle.currentBlocker,
    "",
    "## 订阅合同",
    humanList(pack.bundle.subscribedContracts),
    "",
    "## worktree",
    pack.bundle.worktree,
    "",
    "## branch",
    pack.bundle.branch,
    "",
    "## verification commands",
    humanList(pack.bundle.verificationCommands),
    "",
    "## next action",
    `窗口 ${pack.bundle.nextWindow}: ${pack.bundle.nextAction}`,
    "",
    "## forbidden actions",
    humanList(pack.bundle.forbiddenActions),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderLaneClosePack(pack) {
  return [
    `# lane close: ${pack.lane.id}`,
    "",
    renderLaneSummary(pack.lane),
    "",
    "## cleanup checklist",
    pack.cleanupChecklist.map((item) => `- ${item.item}: ${item.ok}`).join("\n"),
    "",
    "## forbidden actions",
    humanList(forbiddenActions),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderPack(pack) {
  if (pack.command === "review-pack") return renderReview(pack);
  if (pack.command === "checkpoint-pack") return renderCheckpoint(pack);
  if (pack.command === "c-qa-pack") return renderQa(pack);
  if (pack.command === "lane init") return renderLaneInitPack(pack);
  if (pack.command === "lane ingest") return renderLaneIngestPack(pack);
  if (pack.command === "lane next") return renderLaneNextPack(pack);
  if (pack.command === "lane board") return renderLaneBoardPack(pack);
  if (pack.command === "lane handoff") return renderLaneHandoffPack(pack);
  if (pack.command === "lane close") return renderLaneClosePack(pack);
  if (pack.command === "fix-pack" || pack.command === "re-review-pack" || pack.command === "done" || pack.command === "write-pack") {
    return renderActionPack(pack);
  }
  return renderActionPack(pack);
}

function createNextPack({ state }) {
  const stableStatus = state.stableStatus || assertKnownStatus(state.status);
  const next = nextStateHandlers[stableStatus](state);
  return {
    ok: true,
    command: "next",
    state,
    stableStatus,
    next,
    workspaceDiscipline,
    disallowedActions,
  };
}

function renderStart(pack) {
  const a = pack.packages.A;
  const b = pack.packages.B;
  const c = pack.packages.C;
  return [
    `# A/B/C agent workflow start: ${pack.type}`,
    "",
    "## A 窗口任务包",
    humanList(a.prompt),
    "",
    "读取：",
    humanList(a.requiredReading),
    "",
    "订阅合同：",
    humanList(a.contracts),
    "",
    "验收命令：",
    humanList(a.validationCommands),
    "",
    "## B 窗口任务包",
    humanList(b.prompt),
    "",
    "验证命令：",
    humanList(b.validationCommands),
    "",
    "## C 窗口任务包",
    humanList(c.prompt),
    "",
    "推荐 surface：",
    humanList(c.recommendedSurfaces),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## 下一步建议",
    pack.nextRecommendation,
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderReview(pack) {
  return [
    `# B 审查包: ${pack.branch}`,
    "",
    `base: ${pack.base}`,
    "",
    "## 审查 prompt",
    humanList(pack.prompt),
    "",
    "## 验证命令",
    humanList(pack.verificationCommands),
    "",
    "## 合并条件",
    humanList(pack.mergeConditions),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderQa(pack) {
  return [
    `# C 只读 UI QA 包: ${pack.surface}`,
    "",
    "## QA prompt",
    pack.prompt,
    "",
    "## 截图要求",
    humanList(pack.screenshotRequirements),
    "",
    "## 边界检查项",
    humanList(pack.boundaryChecks),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderCheckpoint(pack) {
  return [
    "# B push 前 checkpoint 包",
    "",
    "## checkpoint prompt",
    pack.prompt,
    "",
    "## checklist",
    humanList(pack.checklist),
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## 下一步建议",
    pack.nextRecommendation,
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderNext(pack) {
  return [
    `# 下一步建议: ${pack.state.status}`,
    "",
    `发给：窗口 ${pack.next.window}`,
    `动作：${pack.next.action}`,
    "",
    "## 消息",
    pack.next.message,
    "",
    "## Owner Worktree 纪律",
    humanList(disciplineLines(pack.workspaceDiscipline)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderCloudOnboardingStatus(pack) {
  const taskRows = pack.taskPackets.map((packet) => [
    `### ${packet.id}`,
    humanKeyValue([
      ["title", packet.title],
      ["phase", `${packet.phaseId} ${packet.phaseName}`],
      ["status", packet.status],
      ["handoff target", packet.handoffTarget],
      ["needs user authorization", packet.needsUserAuthorization ? "true" : "false"],
      ["blocked reason", packet.blockedReason],
      ["user gate", packet.userGate],
    ]),
    packet.suggestedCommands.length ? humanList(packet.suggestedCommands) : "- no executable command; explicit user authorization required before any live path",
  ].join("\n")).join("\n\n");

  return [
    "# v22 cloud onboarding workflow",
    "",
    humanKeyValue([
      ["program id", pack.programId],
      ["current phase", pack.currentPhase],
      ["active lane", pack.activeLane],
      ["next lane", pack.nextLane],
      ["handoff target", pack.handoffTarget],
      ["user gate", pack.userGate],
    ]),
    "",
    "## phase summary",
    humanKeyValue([
      ["done", pack.phaseSummary.done.map((phase) => phase.phaseId).join(", ")],
      ["pending", pack.phaseSummary.pending.map((phase) => phase.phaseId).join(", ")],
      ["blocked", pack.phaseSummary.blocked.map((phase) => phase.phaseId).join(", ")],
      ["needs-user-authorization", pack.phaseSummary.needsUserAuthorization.map((phase) => phase.phaseId).join(", ")],
      ["active", pack.phaseSummary.active.map((phase) => phase.phaseId).join(", ")],
      ["starter-live-done", pack.phaseSummary.starterLiveDone.map((phase) => phase.phaseId).join(", ")],
    ]),
    "",
    "## required smoke",
    humanList(pack.requiredSmoke),
    "",
    "## task packets",
    taskRows,
    "",
    "## real external side effects are serial",
    humanList(pack.serialRealSideEffects),
    "",
    "## A/B/C/D handoff",
    humanList(Object.values(pack.handoffGuidance)),
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function renderCloudOnboardingNext(pack) {
  return [
    "# v22 cloud onboarding next task packet",
    "",
    humanKeyValue([
      ["program id", pack.programId],
      ["next task packet", pack.nextTaskPacket.id],
      ["handoff target", pack.nextTaskPacket.handoffTarget],
      ["status", pack.nextTaskPacket.status],
      ["user gate", pack.nextTaskPacket.userGate],
    ]),
    "",
    "## suggested commands",
    pack.nextTaskPacket.suggestedCommands.length
      ? humanList(pack.nextTaskPacket.suggestedCommands)
      : "- no executable command; explicit user authorization required before any live path",
    "",
    "## 边界确认",
    humanList(sharedBoundaries),
    "",
    "## JSON 摘要",
    JSON.stringify(pack, null, 2),
    "",
  ].join("\n");
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-agent-workflow.mjs start --type <cleanup|portal-ui|resource-billing|contract|ops-console> [--json]",
    "  node scripts/v22-agent-workflow.mjs review-pack --branch <branch> --base recovery/platform-v22-trunk [--json]",
    "  node scripts/v22-agent-workflow.mjs c-qa-pack --surface <resources|workspace|trace|billing|overview> [--json]",
    "  node scripts/v22-agent-workflow.mjs checkpoint-pack [--json]",
    "  node scripts/v22-agent-workflow.mjs next --state <json> [--json]",
    "  node scripts/v22-agent-workflow.mjs ingest --from A|B|C|D --file <reply.txt> [--json]",
    "  node scripts/v22-agent-workflow.mjs write-pack --window A|B|C|D --state <json> [--json]",
    "  node scripts/v22-agent-workflow.mjs status [--state <json>] [--json]",
    "  node scripts/v22-agent-workflow.mjs lane init --id <lane-id> --type <portal-ui|contract|ops-console|resource-billing|cleanup|workflow> --goal <text> --owner A|C|D --branch <branch> --worktree <path> [--json]",
    "  node scripts/v22-agent-workflow.mjs lane ingest --id <lane-id> --from A|B|C|D --file <reply.txt> [--json]",
    "  node scripts/v22-agent-workflow.mjs lane next --id <lane-id> [--json]",
    "  node scripts/v22-agent-workflow.mjs lane board [--json]",
    "  node scripts/v22-agent-workflow.mjs lane handoff --id <lane-id> [--json]",
    "  node scripts/v22-agent-workflow.mjs lane close --id <lane-id> --status <merged|abandoned|superseded> [--json]",
    "  node scripts/v22-agent-workflow.mjs cloud-onboarding status [--json]",
    "  node scripts/v22-agent-workflow.mjs cloud-onboarding next [--json]",
    "",
  ].join("\n"));
}

async function main() {
  const { mode, submode, options } = parseArgs(process.argv.slice(2));
  const jsonOnly = options.json === true;
  let pack;
  let rendered;

  if (mode === "start") {
    pack = createStartPack({ type: options.type });
    rendered = renderStart(pack);
  } else if (mode === "review-pack") {
    pack = createReviewPack({ branch: options.branch, base: options.base });
    rendered = renderReview(pack);
  } else if (mode === "c-qa-pack") {
    pack = createQaPack({ surface: options.surface });
    rendered = renderQa(pack);
  } else if (mode === "checkpoint-pack") {
    pack = createCheckpointPack();
    rendered = renderCheckpoint(pack);
  } else if (mode === "next") {
    pack = createNextPack({ state: parseState(options.state) });
    rendered = renderNext(pack);
  } else if (mode === "ingest") {
    pack = await createIngestPack({ from: options.from, replyFile: options.file });
    rendered = renderIngestPack(pack);
  } else if (mode === "write-pack") {
    pack = createWritePack({ window: options.window, state: parseState(options.state) });
    rendered = renderPack(pack);
  } else if (mode === "status") {
    pack = createStatusPack({ state: options.state && options.state !== true ? parseState(options.state) : null });
    rendered = renderStatusPack(pack);
  } else if (mode === "cloud-onboarding" && submode === "status") {
    pack = await createCloudOnboardingStatusPack();
    rendered = renderCloudOnboardingStatus(pack);
  } else if (mode === "cloud-onboarding" && submode === "next") {
    pack = await createCloudOnboardingNextPack();
    rendered = renderCloudOnboardingNext(pack);
  } else if (mode === "lane" && submode === "init") {
    pack = await createLaneInitPack({
      id: options.id,
      type: options.type,
      goal: options.goal,
      owner: options.owner,
      branch: options.branch,
      worktree: options.worktree,
    });
    rendered = renderLaneInitPack(pack);
  } else if (mode === "lane" && submode === "ingest") {
    pack = await createLaneIngestPack({ id: options.id, from: options.from, replyFile: options.file });
    rendered = renderLaneIngestPack(pack);
  } else if (mode === "lane" && submode === "next") {
    pack = await createLaneNextPack({ id: options.id });
    rendered = renderLaneNextPack(pack);
  } else if (mode === "lane" && submode === "board") {
    pack = await createLaneBoardPack();
    rendered = renderLaneBoardPack(pack);
  } else if (mode === "lane" && submode === "handoff") {
    pack = await createLaneHandoffPack({ id: options.id });
    rendered = renderLaneHandoffPack(pack);
  } else if (mode === "lane" && submode === "close") {
    pack = await createLaneClosePack({ id: options.id, status: options.status });
    rendered = renderLaneClosePack(pack);
  } else {
    printUsage();
    process.exitCode = 2;
    return;
  }

  process.stdout.write(jsonOnly ? `${JSON.stringify(pack, null, 2)}\n` : rendered);
}

export {
  createCheckpointPack,
  createCloudOnboardingNextPack,
  createCloudOnboardingStatusPack,
  createIngestPack,
  createNextPack,
  createQaPack,
  createReviewPack,
  createStartPack,
  createStatusPack,
  createWritePack,
  qaSurfaces,
  stableStatusEnum,
  workflowTypes,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
