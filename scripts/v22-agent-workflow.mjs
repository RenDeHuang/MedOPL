#!/usr/bin/env node

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
  B_BLOCKED: (state) => ({
    window: "A",
    action: "fix",
    message: `窗口 A 根据 B blocker 修复并补验证；保持同一分支 ${state.branch || "<branch>"}，修复后重新 commit。`,
  }),
  B_MERGED: () => ({
    window: "B",
    action: "checkpoint-pack",
    message: "窗口 B 执行 checkpoint-pack，确认 push 前工作区、remote、secret hygiene 和验证记录。",
  }),
  B_PUSHED: () => ({
    window: "B",
    action: "收尾",
    message: "窗口 B 收尾：记录 push 结果、GitHub 状态和后续分支建议；不要继续做新功能。",
  }),
  C_BLOCKER: (state) => ({
    window: "A",
    action: "C blocker triage",
    message: `窗口 A 处理 C blocker：读取只读 QA 证据，判断是否需要修复 ${state.branch || "<branch>"} 或拆出新分支。`,
  }),
  C_PASS: () => ({
    window: "B",
    action: "checkpoint-pack",
    message: "窗口 B 汇总 C 只读 QA PASS 证据，进入 checkpoint-pack；仍需 B 复审后才可合入或 push。",
  }),
};

function parseArgs(argv) {
  const [mode, ...rest] = argv;
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
  return { mode, options };
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
  if (!state.status || !nextStateHandlers[state.status]) {
    throw new Error(`unknown_state_status:${state.status || "(missing)"}`);
  }
  return state;
}

function humanList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function createStartPack({ type }) {
  const workflow = workflowForType(type);
  const packages = {
    A: {
      window: "A",
      title: `A 窗口任务包：${workflow.label}`,
      prompt: [
        `从 ${workflow.branchPrefix}<name> 开始，只做一个明确意图：${workflow.intent}`,
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
      prompt: [
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
      prompt: [
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
    packages,
    nextRecommendation: "先把 A 窗口任务包发给开发窗口；B 等 A_COMMITTED 后使用 review-pack；C 可并行使用 c-qa-pack 做只读 QA。",
    disallowedActions,
  };
}

function createReviewPack({ branch, base }) {
  if (!branch || branch === true) {
    throw new Error("branch_required");
  }
  const targetBase = base && base !== true ? base : "recovery/platform-v22-trunk";
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
  ];
  return {
    ok: true,
    command: "review-pack",
    branch,
    base: targetBase,
    prompt: [
      `审查 ${branch} 相对 ${targetBase} 的 diff。`,
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
  return {
    ok: true,
    command: "c-qa-pack",
    surface,
    prompt: selected.prompt,
    screenshotRequirements: selected.screenshots,
    boundaryChecks: selected.checks,
    disallowedActions,
  };
}

function createCheckpointPack() {
  return {
    ok: true,
    command: "checkpoint-pack",
    prompt: "B push 前 checkpoint：只做人工确认清单和下一步建议；本脚本不执行任何合并或推送。",
    checklist: [
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

function createNextPack({ state }) {
  const next = nextStateHandlers[state.status](state);
  return {
    ok: true,
    command: "next",
    state,
    next,
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
    "",
  ].join("\n"));
}

async function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));
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
  } else {
    printUsage();
    process.exitCode = 2;
    return;
  }

  process.stdout.write(jsonOnly ? `${JSON.stringify(pack, null, 2)}\n` : rendered);
}

export {
  createCheckpointPack,
  createNextPack,
  createQaPack,
  createReviewPack,
  createStartPack,
  qaSurfaces,
  workflowTypes,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
