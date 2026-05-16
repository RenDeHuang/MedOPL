import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const matrixPath = "docs/recovery/system-domain-truth-layer-matrix.md";
const gapMatrixPath = "docs/recovery/v22-current-vs-ideal-gap-matrix.md";

const activeCodeRoots = [
  "services/portal/src",
  "services/portal/frontend/src",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];

const activeDocRoots = [
  "docs/contracts",
  "docs/recovery",
];

const activeDocFiles = [
  "README.md",
  "docs/product.md",
  "docs/architecture.md",
];

const allowedGuardianScripts = new Set([
  "scripts/smoke-test-v22-system-domain-truth-layer-zero-old-context-gate.mjs",
  "scripts/smoke-test-v22-zero-compat-active-surface-gate.mjs",
  "scripts/smoke-test-v22-strict-monolith-legacy-retirement-gate.mjs",
  "scripts/smoke-test-v22-retire-user-owned-primary-path.mjs",
  "scripts/smoke-test-v22-retire-resource-order-primary-path.mjs",
  "scripts/smoke-test-v22-cleanup-completion-truth.mjs",
  "scripts/smoke-test-v22-default-entry-narrative-gate.mjs",
  "scripts/smoke-test-v22-product-goal-harness.mjs",
  "scripts/smoke-test-v22-physical-legacy-file-retirement-goal.mjs",
  "scripts/smoke-test-v22-physical-legacy-file-retirement-inventory.mjs",
  "scripts/smoke-test-v22-physical-legacy-batch-run-manifest.mjs",
]);

const retirementRecordFiles = new Set([
  "docs/recovery/physical-legacy-file-retirement-goal.md",
  "docs/recovery/physical-legacy-file-retirement-inventory.md",
  "docs/recovery/physical-legacy-file-retirement-run-manifest.json",
]);

const oldCurrentNamingPatterns = [
  /\bPortal OPL Adapter\b/gu,
  /\bOPL Adapter\b/gu,
  /\bPortal OPL adapter\b/gu,
  /\bportal-opl-adapter\b/gu,
  /\bportal_opl_adapter\b/gu,
  /\bportalOplAdapter\b/gu,
  /\bPORTAL_OPL_ADAPTER(?:_[A-Z0-9]+)?\b/gu,
  /\boplAdapter(?:Client)?\b/gu,
  /\badapterClient\b/gu,
  /\badapterTraceRows\b/gu,
  /\bfetchOplAdapter(?:Runs|Costs|TraceRows)\b/gu,
  /\brequestAdapterApi\b/gu,
  /\bassertStableAdapterPath\b/gu,
  /\badapterContractVersion\b/gu,
  /\badapterBoundary\b/gu,
  /\bmanaged_runtime\b/gu,
  /\bruntime-bridge-managed-runs\.mjs\b/gu,
  /\/portal-adapter\b/gu,
  /Adapter \/ Runtime Agent 合同包/gu,
];

const oldRoutePatterns = [
  /portal-legacy-redirect\.routes\.mjs/gu,
  /\bcreatePortalLegacyRedirectRoutes\b/gu,
  /\bhandlePortalLegacyRedirectRoutes\b/gu,
  /\/portal\/app\b/gu,
  /\/portal\/app\//gu,
  /\\\/portal\\\/app\b/gu,
  /\\\/portal\\\/app\\\//gu,
  /\/portal\/admin\/docs\//gu,
  /\/portal\/app\/admin\//gu,
  /\\\/portal\\\/admin\\\/docs\\\//gu,
  /\\\/portal\\\/app\\\/admin\\\//gu,
  /\btask-space\.routes\.mjs\b/gu,
  /\bcreatePortalTaskSpaceRoutes\b/gu,
  /\bhandlePortalTaskSpaceRoutes\b/gu,
  /\/portal\/tasks\b/gu,
  /\/portal\/tasks\//gu,
  /\\\/portal\\\/tasks\b/gu,
  /\\\/portal\\\/tasks\\\//gu,
  /legacy task-space/giu,
  /legacy redirect/giu,
];

const oldNarrativeCompletionPatterns = [
  /\bkeep_tombstone\b/iu,
  /\barchive_reference\b/iu,
  /\bcompat alias\b/iu,
  /\blegacy redirect\b[^.\n]*(?:完成态|完成|current|default|active|默认|保留|兼容)/iu,
  /\bAdapter\b[^.\n]*(?:当前主线|正式入口|产品主叙事|default active|active surface|完成态)/iu,
  /\bdeploy\/adapters\/infra\b[^.\n]*(?:当前|默认|active|完成态|保留)/iu,
  /\blive\/canary\b[^.\n]*(?:当前|默认|active|完成态|保留)/iu,
  /用户(?:购买|选择)[^。\n]*(?:CVM|COS|K8s|TKE|节点池|云控制台)/iu,
];

const positiveOldContextRetentionPatterns = [
  /(?:实现|当前实现|内部实现)[^。\n]*(?:可以|可)[^。\n]*保留内部旧路径/iu,
];

const requiredTruthPhrases = [
  "用户真相 / UX truth",
  "服务商品真相 / product truth",
  "交付真相 / delivery truth",
  "OPL 衔接真相 / OPL connection truth",
  "云/资源真相 / cloud-resource truth",
  "运营真相 / ops truth",
  "风险授权真相 / risk-authorization truth",
  "Portal",
  "Portal 与 OPL 的衔接",
  "Portal 与云的衔接",
  "云",
  "OPL",
];

const requiredUserTruthPhrases = [
  "买了什么",
  "可以做什么",
  "现在能不能用",
  "下一步",
  "文件",
  "任务",
  "结果",
  "费用",
];

const requiredDeliveryTruthPhrases = [
  "开通",
  "隔离",
  "resourceBinding",
  "计费",
  "审计",
  "释放",
  "停止计费",
];

function normalizeRepoPath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\.\//u, "");
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

function isTextFile(filePath) {
  return /\.(?:mjs|js|ts|tsx|vue|json|md|yaml|yml|css|html)$/iu.test(filePath);
}

async function listFiles(rootPath) {
  if (!(await exists(rootPath))) return [];
  const absoluteRoot = path.join(repoRoot, rootPath);
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

function lineOf(source, index) {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

function contextAround(source, index, radius = 220) {
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + radius));
}

function isNegativeRetirementContext(context = "") {
  return /(?:不得|禁止|delete|deleted|retired|forbidden|must not|must_not|not restore|not retain|not active|not default|not a completion state|不把|不得把|不属于|不是|不等于|不能|不允许|不可|不保留|不再|退役|删除|已删除|清退|旧.*不得恢复|只.*禁词|只.*删除记录|作为.*删除记录|forbidden-token)/iu.test(context);
}

function asGlobalPattern(pattern) {
  return pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}

function addPatternFindings(findings, { type, file, source, patterns, detail, allowNegative = true }) {
  for (const pattern of patterns) {
    for (const match of source.matchAll(asGlobalPattern(pattern))) {
      const index = match.index ?? 0;
      if (allowNegative && isNegativeRetirementContext(contextAround(source, index))) continue;
      findings.push({
        type,
        file,
        line: lineOf(source, index),
        match: match[0],
        detail,
      });
    }
  }
}

function shouldSkipOldNamingFile(file) {
  return allowedGuardianScripts.has(file) || retirementRecordFiles.has(file);
}

async function assertMatrix(findings) {
  if (!(await exists(matrixPath))) {
    findings.push({
      type: "system_domain_truth_layer_matrix_missing",
      file: matrixPath,
      line: 1,
      match: matrixPath,
      detail: "Recovery truth must contain a system-domain x truth-layer matrix.",
    });
    return;
  }
  const matrix = await readRepoFile(matrixPath);
  for (const phrase of requiredTruthPhrases) {
    if (!matrix.includes(phrase)) {
      findings.push({
        type: "system_domain_truth_layer_matrix_incomplete",
        file: matrixPath,
        line: 1,
        match: phrase,
        detail: "Matrix must cover every system domain and truth layer.",
      });
    }
  }
  for (const phrase of requiredUserTruthPhrases) {
    if (!matrix.includes(phrase)) {
      findings.push({
        type: "ux_truth_incomplete",
        file: matrixPath,
        line: 1,
        match: phrase,
        detail: "UX truth must explain what the user bought, what it can do, readiness, next step, and where files/tasks/results/costs are.",
      });
    }
  }
  for (const phrase of requiredDeliveryTruthPhrases) {
    if (!matrix.includes(phrase)) {
      findings.push({
        type: "delivery_truth_incomplete",
        file: matrixPath,
        line: 1,
        match: phrase,
        detail: "Delivery truth must cover provisioning, isolation, resourceBinding, billing, audit, release, and stop-billing.",
      });
    }
  }
}

async function assertGapMatrix(findings) {
  const source = await readRepoFile(gapMatrixPath);
  for (const phrase of [
    "System Domain × Truth Layer Ideal vs Current Gap",
    "ideal state",
    "current after cleanup",
    "remaining gaps",
    "next leaf recommendation",
    "cleanup gap",
    "UX expression gap",
    "delivery gap",
    "cloud gap",
    "OPL capability gap",
  ]) {
    if (!source.includes(phrase)) {
      findings.push({
        type: "ideal_current_gap_missing",
        file: gapMatrixPath,
        line: 1,
        match: phrase,
        detail: "Gap matrix must record ideal/current/remain/next-leaf truth after zero-old-context cleanup.",
      });
    }
  }
}

async function assertNoOldCurrentNaming(findings) {
  const roots = [...activeCodeRoots, "scripts", ...activeDocRoots];
  const files = [
    ...(await Promise.all(roots.map(listFiles))).flat(),
    ...activeDocFiles,
  ].filter((file, index, all) => all.indexOf(file) === index)
    .filter((file) => isTextFile(file))
    .filter((file) => !file.startsWith("docs/releases/"))
    .filter((file) => !file.startsWith("docs/reports/"))
    .filter((file) => !file.startsWith("docs/logs/"));

  for (const file of files) {
    if (shouldSkipOldNamingFile(file)) continue;
    const source = await readRepoFile(file);
    addPatternFindings(findings, {
      type: "old_current_naming_in_active_surface",
      file,
      source,
      patterns: oldCurrentNamingPatterns,
      detail: "Active surface must use Runtime Bridge / Gateway naming, not old Portal OPL Adapter context.",
    });
  }
}

async function assertNoOldRoutes(findings) {
  const files = (await listFiles("services/portal/src"))
    .concat(await listFiles("services/portal/frontend/src"))
    .concat(await listFiles("scripts"))
    .concat(activeDocFiles)
    .filter((file, index, all) => all.indexOf(file) === index)
    .filter(isTextFile);

  for (const file of files) {
    if (allowedGuardianScripts.has(file)) continue;
    const source = await readRepoFile(file);
    addPatternFindings(findings, {
      type: "old_route_or_entry_in_active_surface",
      file,
      source,
      patterns: oldRoutePatterns,
      detail: "Active Portal routes and v22 validation must not keep legacy redirect or task-space entrypoints.",
    });
  }
}

async function assertNoNonV22OplSmokeEntrypoints(findings) {
  const files = await listFiles("scripts");
  for (const file of files) {
    const name = path.basename(file);
    if (/^smoke-test-opl-.*\.mjs$/u.test(name)) {
      findings.push({
        type: "non_v22_opl_smoke_entrypoint",
        file,
        line: 1,
        match: name,
        detail: "OPL/Gateway/Runtime Bridge validation entrypoints must use scripts/smoke-test-v22-* naming.",
      });
    }
  }
}

async function assertNoOldNarrative(findings) {
  const files = [
    ...activeDocFiles,
    ...(await listFiles("docs/contracts")),
    ...(await listFiles("docs/recovery")),
  ].filter((file, index, all) => all.indexOf(file) === index)
    .filter(isTextFile)
    .filter((file) => !file.startsWith("docs/releases/"))
    .filter((file) => !file.startsWith("docs/reports/"))
    .filter((file) => !file.startsWith("docs/logs/"));

  for (const file of files) {
    const source = await readRepoFile(file);
    addPatternFindings(findings, {
      type: "old_explanation_as_current_truth",
      file,
      source,
      patterns: oldNarrativeCompletionPatterns,
      detail: "Current docs must not make legacy/compat/tombstone/archive/Adapter/deploy/live/canary a completion state or default context.",
    });
    addPatternFindings(findings, {
      type: "positive_old_context_retention_narrative",
      file,
      source,
      patterns: positiveOldContextRetentionPatterns,
      detail: "Current docs must not explain old paths as retainable implementation context.",
      allowNegative: false,
    });
  }
}

const findings = [];
await assertMatrix(findings);
await assertGapMatrix(findings);
await assertNoOldCurrentNaming(findings);
await assertNoOldRoutes(findings);
await assertNoNonV22OplSmokeEntrypoints(findings);
await assertNoOldNarrative(findings);

if (findings.length) {
  console.error(JSON.stringify({
    ok: false,
    contract: "v22_system_domain_truth_layer_zero_old_context_gate",
    findings,
  }, null, 2));
}

assert.deepEqual(findings, [], `system_domain_truth_layer_zero_old_context_findings:${findings.length}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_system_domain_truth_layer_zero_old_context_gate",
  matrix: matrixPath,
  gapMatrix: gapMatrixPath,
}, null, 2));
