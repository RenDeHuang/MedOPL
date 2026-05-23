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
    /^docs\/(?:product|source|specs)\/README\.md$/u,
    /^specs\/(?:product|source|framework)\/spec\.md$/u,
    /^changes\/archive\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\/(?:proposal|spec-delta|design|tasks|eval-plan|review|closeout)\.md$/u,
    /^changes\/active\/[a-z0-9-]+\/(?:proposal|spec-delta|design|tasks|eval-plan|review|closeout)\.md$/u,
    /^tests\/fixtures\/v22\/(?:goal-current|agent-verify-manifest)\.json$/u,
    /^tests\/contract\/contract-test-v22-(?:landing-closeout-automation|current-state-index-loop|cleanup-lifecycle-system|product-engineering-loop-index|agent-verify-entrypoint|current-development-lines|framework-truth-layering|backend-go-convergence-program|mvp-contract-suite)\.mjs$/u,
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

function normalizeBackticks(value) {
  return String(value || "").replace(/`/gu, "").trim();
}

function extractInlineField(section, field) {
  const match = section.match(new RegExp(`^${field}:\\s*\`?([^\`\\n]+)\`?\\s*$`, "mu"));
  return match ? normalizeBackticks(match[1]) : "";
}

function extractStatus(section) {
  return extractInlineField(section, "Status");
}

function extractBranch(section) {
  return extractInlineField(section, "Branch");
}

function extractHeadingBranch(heading) {
  return heading.replace(/^###\s+\d{4}-\d{2}-\d{2}\s+/u, "").trim();
}

function parseHistorySections(history) {
  const matches = [...history.matchAll(/^###\s+\d{4}-\d{2}-\d{2}\s+(.+)$/gmu)];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : history.length;
    const source = history.slice(start, end);
    const heading = match[0].trim();
    const branch = extractBranch(source) || match[1].trim();
    return {
      heading,
      branch,
      headingBranch: extractHeadingBranch(heading),
      source,
      status: extractStatus(source),
      landedCommit: extractInlineField(source, "landed_commit"),
      handoffCommit: extractInlineField(source, "handoff_commit"),
      postMergeCloseout: extractInlineField(source, "post_merge_closeout"),
      nextCursor: extractInlineField(source, "next_cursor"),
    };
  });
}

function sectionHasRequiredField(section, field) {
  if (field === "post_push_verification") return section.source.includes("post_push_verification:");
  return Boolean(extractInlineField(section.source, field));
}

function latestLandedSection(sections) {
  return sections.findLast((section) => section.status === "landed / pushed / post-push verified" && section.landedCommit);
}

function readySectionHasReachedTrunk(section, trunkRef) {
  const commit = section.handoffCommit || revParse(section.branch);
  return Boolean(commit && isAncestor(commit, trunkRef));
}

function staleReadySections(sections, trunkRef) {
  return sections
    .filter((section) => section.status === "ready_for_landing_review")
    .filter((section) => readySectionHasReachedTrunk(section, trunkRef))
    .map((section) => ({
      heading: section.heading,
      branch: section.branch,
      handoffCommit: section.handoffCommit || revParse(section.branch),
    }));
}

function checkCloseout({ trunkRef = "origin/recovery/platform-v22-trunk" } = {}) {
  const history = readRepoFile(files.history);
  const active = readRepoFile(files.active);
  const current = readJson(files.current);
  const manifest = readJson(files.manifest);
  const sections = parseHistorySections(history);
  const latest = latestLandedSection(sections);
  const requiredPostMergeFields = manifest.required_post_merge_fields || defaultRequiredPostMergeFields;
  const requiresTrunkHeadSync = manifest.requires_trunk_head_sync === true;
  const missingPostMergeFields = latest
    ? requiredPostMergeFields.filter((field) => !sectionHasRequiredField(latest, field))
    : [...requiredPostMergeFields];
  const trunkHead = revParse(trunkRef);
  const staleReady = staleReadySections(sections, trunkRef);
  const findings = [];

  if (!trunkHead) findings.push({ code: "trunk_ref_missing", trunkRef });
  if (!latest) findings.push({ code: "history_latest_landed_run_missing" });
  if (latest && !isAncestor(latest.landedCommit, trunkRef)) {
    findings.push({
      code: "latest_landed_commit_not_on_trunk",
      branch: latest.branch,
      landedCommit: latest.landedCommit,
      trunkRef,
    });
  }
  if (requiresTrunkHeadSync && latest && trunkHead) {
    const afterLatest = commitsAfter(latest.landedCommit, trunkRef);
    const nonCloseoutCommits = afterLatest.filter((commit) => !closeoutCommitLooksLikeCloseout(commit));
    if (nonCloseoutCommits.length > 0) {
      findings.push({
        code: "non_closeout_commits_after_latest_landed",
        branch: latest.branch,
        landedCommit: latest.landedCommit,
        commits: nonCloseoutCommits,
        trunkRef,
      });
    }
  }
  if (requiresTrunkHeadSync && latest && trunkHead && latest.landedCommit !== trunkHead && latest.branch.startsWith("cleanup/")) {
    findings.push({
      code: "latest_cleanup_landed_commit_not_trunk_head",
      branch: latest.branch,
      expected: trunkHead,
      actual: latest.landedCommit,
      trunkRef,
    });
  }
  if (latest && current.last_landed_commit !== latest.landedCommit) {
    findings.push({
      code: "goal_current_last_landed_commit_mismatch",
      expected: latest.landedCommit,
      actual: current.last_landed_commit,
    });
  }
  if (latest && current.base_trunk_head !== latest.landedCommit) {
    findings.push({
      code: "goal_current_base_trunk_head_mismatch",
      expected: latest.landedCommit,
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
  if (current.post_merge_closeout_completed !== true) {
    findings.push({ code: "goal_current_post_merge_closeout_not_completed" });
  }
  if (missingPostMergeFields.length > 0) {
    findings.push({
      code: "history_latest_landed_run_missing_fields",
      fields: missingPostMergeFields,
    });
  }
  for (const section of staleReady) {
    findings.push({
      code: "ready_for_landing_review_reachable_from_trunk",
      branch: section.branch,
      handoffCommit: section.handoffCommit,
    });
  }
  if (latest && !active.includes(latest.landedCommit)) {
    findings.push({
      code: "active_truth_missing_latest_landed_commit",
      landedCommit: latest.landedCommit,
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
    latestHistoryBranch: latest?.branch || "",
    latestHistoryLandedCommit: latest?.landedCommit || "",
    postMergeCloseoutCompleted: current.post_merge_closeout_completed === true,
    missingPostMergeFields,
    staleReadySections: staleReady,
    findings,
  };
}

function replaceSection(history, branch, replacer) {
  const sections = parseHistorySections(history);
  const selected = sections.find((section) => section.branch === branch || section.headingBranch === branch);
  if (!selected) throw new Error(`history_section_missing:${branch}`);
  const nextStart = history.indexOf(selected.source) + selected.source.length;
  return `${history.slice(0, history.indexOf(selected.source))}${replacer(selected.source)}${history.slice(nextStart)}`;
}

function sectionForBranch(history, branch) {
  const sections = parseHistorySections(history);
  return sections.find((section) => section.branch === branch || section.headingBranch === branch) || null;
}

function validateGenerateInput({ history, branch, landedCommit, trunkRef }) {
  if (!fullCommitPattern.test(landedCommit)) {
    throw new Error(`invalid_landed_commit:${landedCommit}`);
  }

  const resolvedLandedCommit = revParseCommit(landedCommit);
  if (resolvedLandedCommit !== landedCommit) {
    throw new Error(`landed_commit_not_found:${landedCommit}`);
  }

  const section = sectionForBranch(history, branch);
  if (!section) throw new Error(`history_section_missing:${branch}`);

  const branchHead = revParseCommit(branch);
  if (!branchHead) throw new Error(`branch_ref_missing:${branch}`);

  const expectedCommit = section.handoffCommit || branchHead;
  if (!fullCommitPattern.test(expectedCommit) || revParseCommit(expectedCommit) !== expectedCommit) {
    throw new Error(`history_handoff_commit_invalid:${expectedCommit || branch}`);
  }
  if (branchHead !== expectedCommit) {
    throw new Error(`branch_head_handoff_mismatch:${branch}:${branchHead}:${expectedCommit}`);
  }
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

  return { section, branchHead, expectedCommit };
}

function renderCloseoutBlock({ landedCommit, nextCursor, verificationSummary }) {
  const verificationLines = verificationSummary
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);
  return [
    "",
    `landed_commit: \`${landedCommit}\``,
    "",
    "landing_gate_result: `passed / ff-only landed / pushed`",
    "",
    "post_push_verification:",
    "",
    ...(verificationLines.length > 0 ? verificationLines : ["- post-push workflow gate and required verify commands passed."]),
    "",
    "post_merge_closeout: `completed`",
    "",
    `next_cursor: \`${nextCursor}\``,
    "",
  ].join("\n");
}

function renderCurrentProblem({ branch, landedCommit }) {
  return [
    "The next indexed local implementation leaf remains PostgreSQL/Redis local production data closure.",
    `The latest governance closeout branch ${branch} landed at ${landedCommit} and does not implement PostgreSQL/Redis.`,
  ].join(" ");
}

function generateCloseout({
  branch,
  landedCommit,
  nextCursor,
  trunkRef,
  verificationSummary,
  dryRun = false,
} = {}) {
  if (!branch) throw new Error("missing_branch");
  if (!landedCommit) throw new Error("missing_landed_commit");
  if (!nextCursor) throw new Error("missing_next_cursor");

  const history = readRepoFile(files.history);
  const validation = validateGenerateInput({ history, branch, landedCommit, trunkRef });
  const current = readJson(files.current);
  const active = readRepoFile(files.active);
  const updatedHistory = replaceSection(history, branch, (section) => {
    let next = section.replace("Status: `ready_for_landing_review`", "Status: `landed / pushed / post-push verified`");
    if (!next.includes("landed_commit:")) {
      next = `${next.trimEnd()}\n${renderCloseoutBlock({ landedCommit, nextCursor, verificationSummary })}`;
    }
    return next;
  });
  const updatedCurrent = {
    ...current,
    base_trunk_head: landedCommit,
    last_landed_commit: landedCommit,
    last_landed_branch: branch,
    last_landed_at: new Date().toISOString().slice(0, 10),
    history_latest_branch: branch,
    post_merge_closeout_completed: true,
    current_problem: renderCurrentProblem({ branch, landedCommit }),
  };
  const updatedActive = active
    .replace(
      /最近已通过 landing gate 的治理闭环是 `[^`]+`，landed commit 为 `[a-f0-9]{40}`。/u,
      `最近已通过 landing gate 的治理闭环是 \`${branch}\`，landed commit 为 \`${landedCommit}\`。`,
    )
    .replace(
      /Current evidence: latest landed governance closeout is `[a-f0-9]{40}`;/u,
      `Current evidence: latest landed governance closeout is \`${landedCommit}\`;`,
    );

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
    updatedCurrentProblem: updatedCurrent.current_problem,
    files: [files.history, files.current, files.active],
  };
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-landing-closeout.mjs check [--trunk-ref origin/recovery/platform-v22-trunk] [--json]",
    "  node scripts/v22-landing-closeout.mjs generate --branch <branch> --landed-commit <sha> --next-cursor <leaf> [--trunk-ref <ref>] [--verification-summary <a; b>] [--dry-run] [--json]",
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
