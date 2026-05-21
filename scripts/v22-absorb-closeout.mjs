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

const defaultRequiredPostAbsorbFields = Object.freeze([
  "absorbed_commit",
  "b_review_result",
  "post_push_verification",
  "post_absorb_truth_closeout",
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
      absorbedCommit: extractInlineField(source, "absorbed_commit"),
      handoffCommit: extractInlineField(source, "handoff_commit"),
      postAbsorbTruthCloseout: extractInlineField(source, "post_absorb_truth_closeout"),
      nextCursor: extractInlineField(source, "next_cursor"),
    };
  });
}

function sectionHasRequiredField(section, field) {
  if (field === "post_push_verification") return section.source.includes("post_push_verification:");
  return Boolean(extractInlineField(section.source, field));
}

function latestAbsorbedSection(sections) {
  return sections.find((section) => section.status === "absorbed / pushed / post-push verified" && section.absorbedCommit);
}

function readySectionHasReachedTrunk(section, trunkRef) {
  const commit = section.handoffCommit || revParse(section.branch);
  return Boolean(commit && isAncestor(commit, trunkRef));
}

function staleReadySections(sections, trunkRef) {
  return sections
    .filter((section) => section.status === "ready_for_b_review")
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
  const latest = latestAbsorbedSection(sections);
  const requiredPostAbsorbFields = manifest.required_post_absorb_fields || defaultRequiredPostAbsorbFields;
  const missingPostAbsorbFields = latest
    ? requiredPostAbsorbFields.filter((field) => !sectionHasRequiredField(latest, field))
    : [...requiredPostAbsorbFields];
  const trunkHead = revParse(trunkRef);
  const staleReady = staleReadySections(sections, trunkRef);
  const findings = [];

  if (!trunkHead) findings.push({ code: "trunk_ref_missing", trunkRef });
  if (!latest) findings.push({ code: "history_latest_absorbed_run_missing" });
  if (latest && !isAncestor(latest.absorbedCommit, trunkRef)) {
    findings.push({
      code: "latest_absorbed_commit_not_on_trunk",
      branch: latest.branch,
      absorbedCommit: latest.absorbedCommit,
      trunkRef,
    });
  }
  if (latest && current.last_absorbed_commit !== latest.absorbedCommit) {
    findings.push({
      code: "goal_current_last_absorbed_commit_mismatch",
      expected: latest.absorbedCommit,
      actual: current.last_absorbed_commit,
    });
  }
  if (latest && current.base_trunk_head !== latest.absorbedCommit) {
    findings.push({
      code: "goal_current_base_trunk_head_mismatch",
      expected: latest.absorbedCommit,
      actual: current.base_trunk_head,
    });
  }
  if (latest && current.last_absorbed_branch !== latest.branch) {
    findings.push({
      code: "goal_current_last_absorbed_branch_mismatch",
      expected: latest.branch,
      actual: current.last_absorbed_branch,
    });
  }
  if (current.post_absorb_truth_closeout_completed !== true) {
    findings.push({ code: "goal_current_post_absorb_closeout_not_completed" });
  }
  if (missingPostAbsorbFields.length > 0) {
    findings.push({
      code: "history_latest_absorbed_run_missing_fields",
      fields: missingPostAbsorbFields,
    });
  }
  for (const section of staleReady) {
    findings.push({
      code: "ready_for_b_review_reachable_from_trunk",
      branch: section.branch,
      handoffCommit: section.handoffCommit,
    });
  }
  if (latest && !active.includes(latest.absorbedCommit)) {
    findings.push({
      code: "active_truth_missing_latest_absorbed_commit",
      absorbedCommit: latest.absorbedCommit,
    });
  }
  if (latest && !active.includes(latest.branch)) {
    findings.push({
      code: "active_truth_missing_latest_absorbed_branch",
      branch: latest.branch,
    });
  }

  return {
    ok: findings.length === 0,
    trunkRef,
    trunkHead,
    lastAbsorbedCommit: current.last_absorbed_commit,
    lastAbsorbedBranch: current.last_absorbed_branch || "",
    latestHistoryBranch: latest?.branch || "",
    latestHistoryAbsorbedCommit: latest?.absorbedCommit || "",
    postAbsorbTruthCloseoutCompleted: current.post_absorb_truth_closeout_completed === true,
    missingPostAbsorbFields,
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

function validateGenerateInput({ history, branch, absorbedCommit, trunkRef }) {
  if (!fullCommitPattern.test(absorbedCommit)) {
    throw new Error(`invalid_absorbed_commit:${absorbedCommit}`);
  }

  const resolvedAbsorbedCommit = revParseCommit(absorbedCommit);
  if (resolvedAbsorbedCommit !== absorbedCommit) {
    throw new Error(`absorbed_commit_not_found:${absorbedCommit}`);
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
  if (absorbedCommit !== expectedCommit) {
    throw new Error(`absorbed_commit_mismatch:${absorbedCommit}:${expectedCommit}`);
  }

  if (trunkRef) {
    const trunkHead = revParseCommit(trunkRef);
    if (!trunkHead) throw new Error(`trunk_ref_missing:${trunkRef}`);
    if (!isAncestor(absorbedCommit, trunkRef)) {
      throw new Error(`absorbed_commit_not_reachable_from_trunk:${absorbedCommit}:${trunkRef}`);
    }
  }

  return { section, branchHead, expectedCommit };
}

function renderCloseoutBlock({ absorbedCommit, nextCursor, verificationSummary }) {
  const verificationLines = verificationSummary
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);
  return [
    "",
    `absorbed_commit: \`${absorbedCommit}\``,
    "",
    "b_review_result: `passed / ff-only absorbed / pushed`",
    "",
    "post_push_verification:",
    "",
    ...(verificationLines.length > 0 ? verificationLines : ["- post-push workflow gate and required verify commands passed."]),
    "",
    "post_absorb_truth_closeout: `completed`",
    "",
    `next_cursor: \`${nextCursor}\``,
    "",
  ].join("\n");
}

function generateCloseout({
  branch,
  absorbedCommit,
  nextCursor,
  trunkRef,
  verificationSummary,
  dryRun = false,
} = {}) {
  if (!branch) throw new Error("missing_branch");
  if (!absorbedCommit) throw new Error("missing_absorbed_commit");
  if (!nextCursor) throw new Error("missing_next_cursor");

  const history = readRepoFile(files.history);
  const validation = validateGenerateInput({ history, branch, absorbedCommit, trunkRef });
  const current = readJson(files.current);
  const active = readRepoFile(files.active);
  const updatedHistory = replaceSection(history, branch, (section) => {
    let next = section.replace("Status: `ready_for_b_review`", "Status: `absorbed / pushed / post-push verified`");
    if (!next.includes("absorbed_commit:")) {
      next = `${next.trimEnd()}\n${renderCloseoutBlock({ absorbedCommit, nextCursor, verificationSummary })}`;
    }
    return next;
  });
  const updatedCurrent = {
    ...current,
    base_trunk_head: absorbedCommit,
    last_absorbed_commit: absorbedCommit,
    last_absorbed_branch: branch,
    last_absorbed_at: new Date().toISOString().slice(0, 10),
    history_latest_branch: branch,
    post_absorb_truth_closeout_completed: true,
    current_problem: current.current_problem.replace(/[a-f0-9]{40}/u, absorbedCommit),
  };
  const updatedActive = active
    .replace(
      /最近已吸收的治理闭环是 `[^`]+`，absorbed commit 为 `[a-f0-9]{40}`。/u,
      `最近已吸收的治理闭环是 \`${branch}\`，absorbed commit 为 \`${absorbedCommit}\`。`,
    )
    .replace(
      /Current evidence: latest absorbed governance closeout is `[a-f0-9]{40}`;/u,
      `Current evidence: latest absorbed governance closeout is \`${absorbedCommit}\`;`,
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
    absorbedCommit,
    branchHead: validation.branchHead,
    expectedCommit: validation.expectedCommit,
    nextCursor,
    trunkRef: trunkRef || "",
    dryRun,
    files: [files.history, files.current, files.active],
  };
}

function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-absorb-closeout.mjs check [--trunk-ref origin/recovery/platform-v22-trunk] [--json]",
    "  node scripts/v22-absorb-closeout.mjs generate --branch <branch> --absorbed-commit <sha> --next-cursor <leaf> [--trunk-ref <ref>] [--verification-summary <a; b>] [--dry-run] [--json]",
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
      absorbedCommit: options["absorbed-commit"],
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
