#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const files = Object.freeze({
  active: "docs/active/README.md",
  history: "docs/history/README.md",
  current: "tests/fixtures/v22/goal-current.json",
  manifest: "tests/fixtures/v22/agent-verify-manifest.json",
});

const defaultRequiredPostMergeFields = Object.freeze([
  "landed_commit",
  "landing_gate_result",
  "post_push_verification",
  "post_merge_closeout",
  "next_cursor",
]);

const fullCommitPattern = /^[a-f0-9]{40}$/u;
const completionAuditFields = Object.freeze([
  "functional",
  "code_cleanup",
  "docs_foldback",
  "verification",
  "retired_entrypoints",
  "cannot_claim",
]);
const completionAuditStatuses = new Set(["done", "partial", "not_started", "blocked"]);
const cleanupResultFields = Object.freeze(["deleted", "folded", "retained", "reason", "next"]);

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

function repoFile(repoPath) {
  return path.join(repoRoot, repoPath);
}

function readRepoFile(repoPath) {
  return readFileSync(repoFile(repoPath), "utf8");
}

function writeRepoFile(repoPath, value) {
  writeFileSync(repoFile(repoPath), value);
}

function readJson(repoPath) {
  return JSON.parse(readRepoFile(repoPath));
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

function revParse(ref) {
  return runGit(["rev-parse", ref], { fallback: "" });
}

function revParseCommit(ref) {
  return runGit(["rev-parse", "--verify", `${ref}^{commit}`], { fallback: "" });
}

function commitsAfter(commit, ref) {
  if (!commit || !ref) return [];
  const output = runGit(["rev-list", "--reverse", `${commit}..${ref}`], { fallback: "" });
  return output ? output.split(/\r?\n/u).filter(Boolean) : [];
}

function changedFilesForCommit(commit) {
  if (!commit) return [];
  const output = runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", commit], { fallback: "" });
  return output ? output.split(/\r?\n/u).filter(Boolean) : [];
}

function closeoutCommitLooksLikeCloseout(commit) {
  const files = changedFilesForCommit(commit);
  if (files.length === 0) return false;
  const allowedPatterns = [
    /^docs\/(?:active|delivery|history)\/README\.md$/u,
    /^docs\/(?:product|runtime|source|specs)\/README\.md$/u,
    /^specs\/(?:product|runtime|source|framework|operations|evidence|policies)\/spec\.md$/u,
    /^changes\/archive\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\/(?:proposal|spec-delta|design|tasks|eval-plan|review|closeout)\.md$/u,
    /^changes\/active\/[a-z0-9-]+\/(?:proposal|spec-delta|design|tasks|eval-plan|review|closeout)\.md$/u,
    /^tests\/fixtures\/v22\/(?:goal-current|agent-verify-manifest)\.json$/u,
    /^tests\/contracts\/contract-test-v22-validate-active-platform\.mjs$/u,
    /^tests\/smoke\/smoke-test-v22-saas-control-plane-user-experience-boundary\.mjs$/u,
    /^scripts\/v22-landing-closeout\.mjs$/u,
  ];
  return files.every((file) => allowedPatterns.some((pattern) => pattern.test(file)));
}

function isAncestor(commit, ref) {
  if (!commit || !ref) return false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", commit, ref], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function parseSemicolonFields(value, label) {
  const entries = String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const result = {};
  for (const entry of entries) {
    const separator = entry.indexOf(":");
    if (separator <= 0) throw new Error(`invalid_${label}_entry:${entry}`);
    const key = entry.slice(0, separator).trim();
    const fieldValue = entry.slice(separator + 1).trim();
    if (!key || !fieldValue) throw new Error(`invalid_${label}_entry:${entry}`);
    result[key] = fieldValue;
  }
  return result;
}

function parseCompletionAudit(value) {
  if (!String(value || "").trim()) throw new Error("missing_plan_completion_audit");
  const audit = parseSemicolonFields(value, "plan_completion_audit");
  for (const field of completionAuditFields) {
    if (!audit[field]) throw new Error(`missing_plan_completion_audit_field:${field}`);
    if (!completionAuditStatuses.has(audit[field])) {
      throw new Error(`invalid_plan_completion_audit_status:${field}:${audit[field]}`);
    }
  }
  return audit;
}

function parseCleanupResult(value) {
  if (!String(value || "").trim()) throw new Error("missing_cleanup_result");
  const cleanup = parseSemicolonFields(value, "cleanup_result");
  for (const field of cleanupResultFields) {
    if (!cleanup[field]) throw new Error(`missing_cleanup_result_field:${field}`);
  }
  return cleanup;
}

function missingCloseoutFields(closeout, requiredPostMergeFields) {
  return requiredPostMergeFields.filter((field) => {
    if (field === "landed_commit") return !closeout?.landed_commit;
    if (field === "landing_gate_result") return !closeout?.landing_gate_result;
    if (field === "post_push_verification") {
      return !Array.isArray(closeout?.post_push_verification) || closeout.post_push_verification.length === 0;
    }
    if (field === "post_merge_closeout") return !closeout?.post_merge_closeout;
    if (field === "next_cursor") return !closeout?.next_cursor;
    return !Object.hasOwn(closeout || {}, field);
  });
}

function shouldEnforceTrunkHeadSync(manifest, trunkRef) {
  if (manifest.requires_trunk_head_sync !== true) return false;
  return trunkRef === manifest.latest_landed_commit_source;
}

function checkCloseout({ trunkRef = "origin/recovery/platform-v22-trunk" } = {}) {
  const active = readRepoFile(files.active);
  const current = readJson(files.current);
  const manifest = readJson(files.manifest);
  const latest = current.latest_landed_closeout || null;
  const requiredPostMergeFields = manifest.required_post_merge_fields || defaultRequiredPostMergeFields;
  const requiresTrunkHeadSync = shouldEnforceTrunkHeadSync(manifest, trunkRef);
  const missingPostMergeFields = missingCloseoutFields(latest, requiredPostMergeFields);
  const trunkHead = revParse(trunkRef);
  const findings = [];

  if (!trunkHead) findings.push({ code: "trunk_ref_missing", trunkRef });
  if (!latest) findings.push({ code: "goal_current_latest_landed_closeout_missing" });
  if (latest && !isAncestor(latest.landed_commit, trunkRef)) {
    findings.push({
      code: "latest_landed_commit_not_on_trunk",
      branch: latest.branch,
      landedCommit: latest.landed_commit,
      trunkRef,
    });
  }
  if (requiresTrunkHeadSync && latest && trunkHead) {
    const afterLatest = commitsAfter(latest.landed_commit, trunkRef);
    const nonCloseoutCommits = afterLatest.filter((commit) => !closeoutCommitLooksLikeCloseout(commit));
    if (nonCloseoutCommits.length > 0) {
      findings.push({
        code: "non_closeout_commits_after_latest_landed",
        branch: latest.branch,
        landedCommit: latest.landed_commit,
        commits: nonCloseoutCommits,
        trunkRef,
      });
    }
  }
  if (latest && current.last_landed_commit !== latest.landed_commit) {
    findings.push({
      code: "goal_current_last_landed_commit_mismatch",
      expected: latest.landed_commit,
      actual: current.last_landed_commit,
    });
  }
  if (latest && current.base_trunk_head !== latest.landed_commit) {
    findings.push({
      code: "goal_current_base_trunk_head_mismatch",
      expected: latest.landed_commit,
      actual: current.base_trunk_head,
    });
  }
  if (latest && current.last_landed_branch !== latest.branch) {
    findings.push({
      code: "goal_current_last_landed_branch_mismatch",
      expected: latest.branch,
      actual: current.last_landed_branch,
    });
  }
  if (latest && current.history_latest_branch !== latest.branch) {
    findings.push({
      code: "goal_current_history_latest_branch_mismatch",
      expected: latest.branch,
      actual: current.history_latest_branch,
    });
  }
  if (latest && latest.status !== "landed / pushed / post-push verified") {
    findings.push({ code: "goal_current_latest_landed_closeout_status_invalid", status: latest.status || "" });
  }
  if (latest && latest.next_cursor !== current.current_cursor) {
    findings.push({
      code: "goal_current_latest_landed_closeout_next_cursor_mismatch",
      expected: current.current_cursor,
      actual: latest.next_cursor || "",
    });
  }
  if (current.post_merge_closeout_completed !== true) {
    findings.push({ code: "goal_current_post_merge_closeout_not_completed" });
  }
  if (missingPostMergeFields.length > 0) {
    findings.push({
      code: "history_latest_landed_run_missing_fields",
      fields: missingPostMergeFields,
    });
  }
  if (latest && !active.includes(latest.landed_commit)) {
    findings.push({
      code: "active_truth_missing_latest_landed_commit",
      landedCommit: latest.landed_commit,
    });
  }
  if (latest && !active.includes(latest.branch)) {
    findings.push({
      code: "active_truth_missing_latest_landed_branch",
      branch: latest.branch,
    });
  }

  return {
    ok: findings.length === 0,
    trunkRef,
    trunkHead,
    lastLandedCommit: current.last_landed_commit,
    lastLandedBranch: current.last_landed_branch || "",
    latestHistoryBranch: "",
    latestHistoryLandedCommit: "",
    postMergeCloseoutCompleted: current.post_merge_closeout_completed === true,
    missingPostMergeFields,
    staleReadySections: [],
    findings,
  };
}

function validateGenerateInput({ branch, landedCommit, trunkRef }) {
  if (!fullCommitPattern.test(landedCommit)) {
    throw new Error(`invalid_landed_commit:${landedCommit}`);
  }

  const resolvedLandedCommit = revParseCommit(landedCommit);
  if (resolvedLandedCommit !== landedCommit) {
    throw new Error(`landed_commit_not_found:${landedCommit}`);
  }

  const branchHead = revParseCommit(branch);
  const current = readJson(files.current);
  const latest = current.latest_landed_closeout || {};
  const currentBranchMatches = branch === current.last_landed_branch || branch === latest.branch;
  if (!branchHead && !currentBranchMatches) throw new Error(`branch_ref_missing:${branch}`);

  const expectedCommit = branchHead || current.last_landed_commit || latest.landed_commit || "";
  if (landedCommit !== expectedCommit) {
    throw new Error(`landed_commit_mismatch:${landedCommit}:${expectedCommit}`);
  }

  if (trunkRef) {
    const trunkHead = revParseCommit(trunkRef);
    if (!trunkHead) throw new Error(`trunk_ref_missing:${trunkRef}`);
    if (!isAncestor(landedCommit, trunkRef)) {
      throw new Error(`landed_commit_not_reachable_from_trunk:${landedCommit}:${trunkRef}`);
    }
  }

  return { branchHead, expectedCommit };
}

function parseVerificationSummary(verificationSummary) {
  const verificationLines = String(verificationSummary || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  return verificationLines.length > 0 ? verificationLines : ["post-push workflow gate and required verify commands passed."];
}

function renderCurrentProblem({ currentProblem, branch, landedCommit }) {
  const base = String(currentProblem || "").trim();
  const repoGateSentence = `The latest repo/gate closeout is ${branch} at ${landedCommit}`;
  const closeoutSentence = `The latest landed closeout is ${branch} at ${landedCommit}.`;
  if (!base) return `${repoGateSentence}. ${closeoutSentence}`;
  const withoutPreviousLanding = base.replace(/\s+The latest landed closeout is [^.]+ at [a-f0-9]{40}\./u, "");
  const withRepoGate = withoutPreviousLanding.replace(
    /The latest repo\/gate closeout is [^ ]+ at [a-f0-9]{40}/u,
    repoGateSentence,
  );
  const next = withRepoGate.includes(repoGateSentence) ? withRepoGate : `${withRepoGate} ${repoGateSentence}.`;
  return `${next} ${closeoutSentence}`;
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`${label}_section_missing`);
  return source.replace(pattern, replacement);
}

function renderActiveTruth({ active, branch, landedCommit }) {
  let next = active;
  next = replaceRequired(
    next,
    /\| latest repo closeout \| `[^`]+` \/ `[a-f0-9]{40}` \|/u,
    `| latest repo closeout | \`${branch}\` / \`${landedCommit}\` |`,
    "active_latest_repo_closeout",
  );
  next = replaceRequired(
    next,
    /最新 repo\/gate closeout 是 `[^`]+` \/ `[a-f0-9]{40}`，/u,
    `最新 repo/gate closeout 是 \`${branch}\` / \`${landedCommit}\`，`,
    "active_summary_latest_repo_closeout",
  );
  return next;
}

function renderHistoryIndex({ history, branch, landedCommit, nextCursor }) {
  const pattern =
    /## Latest Machine Cursor\n\n- latest landed branch: `[^`]+`\n- latest landed commit: `[a-f0-9]{40}`\n- next cursor: `[^`]+`/u;
  const replacement = [
    "## Latest Machine Cursor",
    "",
    `- latest landed branch: \`${branch}\``,
    `- latest landed commit: \`${landedCommit}\``,
    `- next cursor: \`${nextCursor}\``,
  ].join("\n");
  return replaceRequired(history, pattern, replacement, "history_latest_machine_cursor");
}

function generateCloseout({
  branch,
  landedCommit,
  nextCursor,
  trunkRef,
  verificationSummary,
  completionAudit: completionAuditInput,
  cleanupResult: cleanupResultInput,
  dryRun = false,
} = {}) {
  if (!branch) throw new Error("missing_branch");
  if (!landedCommit) throw new Error("missing_landed_commit");
  if (!nextCursor) throw new Error("missing_next_cursor");

  const validation = validateGenerateInput({ branch, landedCommit, trunkRef });
  const completionAudit = parseCompletionAudit(completionAuditInput);
  const cleanupResult = parseCleanupResult(cleanupResultInput);
  const current = readJson(files.current);
  const active = readRepoFile(files.active);
  const history = readRepoFile(files.history);
  const postPushVerification = parseVerificationSummary(verificationSummary);
  const updatedHistory = renderHistoryIndex({ history, branch, landedCommit, nextCursor });
  const updatedCurrent = {
    ...current,
    base_trunk_head: landedCommit,
    last_landed_commit: landedCommit,
    last_landed_branch: branch,
    last_landed_at: new Date().toISOString().slice(0, 10),
    history_latest_branch: branch,
    post_merge_closeout_completed: true,
    latest_landed_closeout: {
      schema_version: 1,
      status: "landed / pushed / post-push verified",
      branch,
      landed_commit: landedCommit,
      landing_gate_result: "passed / ff-only landed / pushed",
      post_push_verification: postPushVerification,
      plan_completion_audit: completionAudit,
      cleanup_result: cleanupResult,
      post_merge_closeout: "completed",
      next_cursor: nextCursor,
    },
    current_problem: renderCurrentProblem({ currentProblem: current.current_problem, branch, landedCommit }),
  };
  const updatedActive = renderActiveTruth({ active, branch, landedCommit });

  if (!dryRun) {
    writeRepoFile(files.history, updatedHistory);
    writeRepoFile(files.current, `${JSON.stringify(updatedCurrent, null, 2)}\n`);
    writeRepoFile(files.active, updatedActive);
  }

  return {
    ok: true,
    mode: "generate",
    branch,
    landedCommit,
    branchHead: validation.branchHead,
    expectedCommit: validation.expectedCommit,
    nextCursor,
    trunkRef: trunkRef || "",
    dryRun,
    completionAudit,
    cleanupResult,
    updatedCurrentProblem: updatedCurrent.current_problem,
    files: [files.history, files.current, files.active],
  };
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-landing-closeout.mjs check [--trunk-ref origin/recovery/platform-v22-trunk] [--json]",
    "  node scripts/v22-landing-closeout.mjs generate --branch <branch> --landed-commit <sha> --next-cursor <leaf> --completion-audit <functional:done;...> --cleanup-result <deleted:x;...> [--trunk-ref <ref>] [--verification-summary <a; b>] [--dry-run] [--json]",
    "",
  ].join("\n"));
}

const { mode, options } = parseArgs(process.argv.slice(2));

try {
  if (mode === "check") {
    const payload = checkCloseout({ trunkRef: options["trunk-ref"] || "origin/recovery/platform-v22-trunk" });
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : `${JSON.stringify(payload, null, 2)}\n`);
    if (!payload.ok) process.exitCode = 1;
  } else if (mode === "generate") {
    const payload = generateCloseout({
      branch: options.branch,
      landedCommit: options["landed-commit"],
      nextCursor: options["next-cursor"],
      trunkRef: options["trunk-ref"] || "",
      verificationSummary: options["verification-summary"] || "",
      completionAudit: options["completion-audit"] || "",
      cleanupResult: options["cleanup-result"] || "",
      dryRun: Boolean(options["dry-run"]),
    });
    process.stdout.write(options.json ? `${JSON.stringify(payload, null, 2)}\n` : `${JSON.stringify(payload, null, 2)}\n`);
  } else {
    printUsage();
    process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
