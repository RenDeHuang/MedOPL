#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  addedLinesSince,
  aheadCountForTrunk,
  changedFilesSince,
  changedFileStatusesSince,
  currentBranchName,
  originPushRemoteUrl,
  parseArgs,
  unique,
  statusPorcelain,
} from "./workflow-gate/git-diff.mjs";
import {
  currentCommandReferenceSources,
  findMissingLocalCommandReferences as findMissingLocalCommandReferencesImpl,
  reviewRequiredCommands,
} from "./workflow-gate/command-reference.mjs";
import {
  isChangePackagePath,
  isForbiddenPath,
  isFormalEngineeringChange,
  isRetiredChangePathWrite,
  isSecretLikePath,
  isServicesPath,
  isSpecPath,
  isStrictMonolithCleanupAuthorizedDelete,
  isV22EvalPath,
  remoteLooksSsh,
  remoteLooksTokenFree,
  secretLikeAddedLinesFrom,
} from "./workflow-gate/policy.mjs";
import { printUsage, renderCheckpointReport, renderReviewReport } from "./workflow-gate/report.mjs";
import { evaluateSliceAdmission, readSliceAdmission } from "./workflow-gate/admission.mjs";
import { lineBudgetDiffForChangedFiles } from "./workflow-gate/line-budget-diff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
// Source-level command reference retained for contract traceability:
// node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk
const closeoutOnlyFiles = new Set([
  "docs/active/README.md",
  "docs/delivery/README.md",
  "docs/history/README.md",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "tests/fixtures/v22/goal-current.json",
]);

export {
  currentCommandReferenceSources,
  reviewRequiredCommands,
};

export function findMissingLocalCommandReferences(options = {}) {
  return findMissingLocalCommandReferencesImpl(repoRoot, options);
}

export const findMissingLocalTestCommandReferences = (options = {}) => findMissingLocalCommandReferences(options);

export function resolveDefaultSliceAdmission(options = {}) {
  const explicitSliceId = options["slice-id"] || process.env.V22_SLICE_ID || "";
  if (explicitSliceId) return readSliceAdmission(repoRoot, explicitSliceId);
  const branchSliceId = currentBranchName(repoRoot);
  try {
    return readSliceAdmission(repoRoot, branchSliceId);
  } catch (error) {
    if (error?.message?.startsWith("slice_manifest_not_found:")) return null;
    throw error;
  }
}

export function evaluateReview({
  base = "recovery/platform-v22-trunk",
  changedFiles = changedFilesSince(repoRoot, base),
  branchName = currentBranchName(repoRoot),
  changedStatuses = changedFileStatusesSince(repoRoot, base),
  addedLines = addedLinesSince(repoRoot, base),
  missingLocalCommandReferences = findMissingLocalCommandReferences(repoRoot),
  sliceAdmission,
  lineBudgetDiff,
} = {}) {
  const normalizedFiles = changedFiles.map((file) => String(file || "").replaceAll("\\", "/").replace(/^\.\//, "")).filter(Boolean);
  const authorizedCleanupDeletions = normalizedFiles.filter((file) =>
    isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const retiredChangePathWrites = normalizedFiles.filter((file) => isRetiredChangePathWrite(file, changedStatuses.get(file)));
  const forbiddenPaths = normalizedFiles.filter((file) =>
    isForbiddenPath(file)
    && !isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const secretLikePaths = normalizedFiles.filter((file) =>
    isSecretLikePath(file)
    && !String(changedStatuses.get(file) || "").startsWith("D")
    && !isV22EvalPath(file)
    && !isStrictMonolithCleanupAuthorizedDelete(file, changedStatuses.get(file), branchName));
  const secretLikeAddedLines = secretLikeAddedLinesFrom(addedLines);
  const servicesChanged = normalizedFiles.some(isServicesPath);
  const specsChanged = normalizedFiles.some(isSpecPath);
  const contractsChanged = normalizedFiles.some((file) => file.startsWith("contracts/"));
  const evalChanged = normalizedFiles.some(isV22EvalPath);
  const closeoutOnly = normalizedFiles.length > 0 && normalizedFiles.every((file) => closeoutOnlyFiles.has(file));
  const formalEngineeringChanged = normalizedFiles.some((file) => isFormalEngineeringChange(file) && !isChangePackagePath(file));
  const findings = [];
  findings.push(...evaluateSliceAdmission({
    changedFiles: normalizedFiles,
    changedStatuses,
    sliceAdmission,
    lineBudgetDiff,
    repoRoot,
    skipCommercialLaunchFreezeAdmission: closeoutOnly,
  }));

  if (retiredChangePathWrites.length > 0) findings.push({ code: "retired_changes_path_write", severity: "blocker", files: retiredChangePathWrites });
  if (forbiddenPaths.length > 0) findings.push({ code: "forbidden_path_changed", severity: "blocker", files: forbiddenPaths });
  if (secretLikePaths.length > 0) findings.push({ code: "secret_like_path_changed", severity: "blocker", files: secretLikePaths });
  if (secretLikeAddedLines.length > 0) findings.push({ code: "secret_like_added_line", severity: "blocker", matches: secretLikeAddedLines });
  if (missingLocalCommandReferences.length > 0) findings.push({ code: "missing_local_command_reference", severity: "blocker", references: missingLocalCommandReferences });
  if (servicesChanged && !evalChanged) findings.push({ code: "services_changed_without_registered_eval_update", severity: "blocker", message: "services/* 改动必须同时修改/新增已注册 eval；changes/ package 不再作为豁免。" });
  if ((specsChanged || contractsChanged) && !evalChanged) findings.push({ code: "contracts_or_specs_changed_without_registered_eval_update", severity: "blocker", message: "specs/contracts 改动必须同时修改/新增已注册 eval 或 active-platform runner；changes/ package 不再作为豁免。" });
  if (formalEngineeringChanged && !evalChanged && !contractsChanged && !closeoutOnly) findings.push({ code: "formal_change_without_machine_evidence_update", severity: "blocker", message: "正式工程变更必须绑定 source/test/runner/fixture/contract evidence；不得新增 change package。" });

  const recommendedCommands = [...reviewRequiredCommands];
  if (normalizedFiles.some((file) => file.startsWith("services/portal/"))) recommendedCommands.push("npm --prefix services/portal/frontend run typecheck");
  if (normalizedFiles.some((file) => file.startsWith("services/portal/frontend/"))) recommendedCommands.push("npm --prefix services/portal/frontend run typecheck");
  if (normalizedFiles.some((file) => file.startsWith("services/opl-web-gateway/"))) {
    recommendedCommands.push("npm --prefix services/opl-web-gateway run check");
    recommendedCommands.push("node tests/regression/opl/regression-test-v22-opl-gateway-upstream-proxy-local.mjs");
  }
  if (normalizedFiles.some((file) => file.startsWith("services/opl-runtime-bridge/"))) recommendedCommands.push("node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs");
  if (specsChanged) recommendedCommands.push("git diff --check -- docs/specs tests scripts");

  return {
    ok: findings.every((finding) => finding.severity !== "blocker"),
    base,
    changedFiles: normalizedFiles,
    authorizedCleanupDeletions,
    retiredChangePathWrites,
    forbiddenPaths,
    secretLikePaths,
    secretLikeAddedLines,
    missingLocalCommandReferences,
    missingLocalTestCommandReferences: missingLocalCommandReferences,
    closeoutOnly,
    findings,
    sliceAdmission: sliceAdmission || null,
    recommendedCommands: unique(recommendedCommands),
  };
}

export function evaluateCheckpoint({
  branchName = currentBranchName(repoRoot),
  statusPorcelain: status = statusPorcelain(repoRoot),
  aheadCount = aheadCountForTrunk(repoRoot),
  remoteUrl = originPushRemoteUrl(repoRoot),
} = {}) {
  const checks = {
    onTrunk: { ok: branchName === "recovery/platform-v22-trunk", detail: branchName || "(unknown)" },
    worktreeClean: { ok: status.trim().length === 0, detail: status.trim() ? "dirty" : "clean" },
    aheadOrigin: { ok: aheadCount > 0, detail: String(aheadCount) },
    remoteSsh: { ok: remoteLooksSsh(remoteUrl), detail: remoteUrl || "(missing)" },
    remoteNoToken: { ok: remoteLooksTokenFree(remoteUrl), detail: remoteUrl ? "token-free" : "(missing)" },
  };
  return {
    ok: Object.values(checks).every((check) => check.ok),
    checks,
    pushChecklist: [
      "确认工作区干净。",
      "确认没有 secret 被 tracked，包含 kubeconfig、token、SecretId、SecretKey、SSH private key、.env 和本地 github 配置。",
      "确认 remote 是 SSH，且 remote URL 不含 token/PAT。",
      "确认本地 trunk ahead origin/recovery/platform-v22-trunk。",
      "只由 landing operator 在 landing gate 通过后执行 push；本 gate 不自动 push。",
    ],
  };
}

async function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));
  if (mode === "start") {
    process.stderr.write("workflow_start_template_retired: changes/ package templates are retired; start from contracts/, docs/active, specs, tests and validate:active-platform.\n");
    process.exitCode = 2;
    return;
  }
  if (mode === "review") {
    const base = options.base || "recovery/platform-v22-trunk";
    const changedFiles = changedFilesSince(repoRoot, base);
    return void process.stdout.write(renderReviewReport(evaluateReview({
      base,
      changedFiles,
      sliceAdmission: resolveDefaultSliceAdmission(options),
      lineBudgetDiff: lineBudgetDiffForChangedFiles(repoRoot, { base, changedFiles }),
    })));
  }
  if (mode === "checkpoint") return void process.stdout.write(renderCheckpointReport(evaluateCheckpoint()));
  printUsage();
  process.exitCode = 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
