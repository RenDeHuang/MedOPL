export function renderReviewReport(review) {
  return `${JSON.stringify({
    ok: review.ok,
    mode: "review",
    base: review.base,
    changedFiles: review.changedFiles,
    authorizedCleanupDeletions: review.authorizedCleanupDeletions,
    retiredChangePathWrites: review.retiredChangePathWrites,
    forbiddenPaths: review.forbiddenPaths,
    secretLikePaths: review.secretLikePaths,
    secretLikeAddedLines: review.secretLikeAddedLines,
    missingLocalCommandReferences: review.missingLocalCommandReferences,
    findings: review.findings,
    recommendedCommands: review.recommendedCommands,
  }, null, 2)}\n`;
}

export function renderCheckpointReport(checkpoint) {
  return `${JSON.stringify({
    ok: checkpoint.ok,
    mode: "checkpoint",
    checks: checkpoint.checks,
    pushChecklist: checkpoint.pushChecklist,
  }, null, 2)}\n`;
}

export function printUsage() {
  process.stderr.write([
    "Usage:",
    "  node scripts/v22-workflow-gate.mjs review --base recovery/platform-v22-trunk",
    "  node scripts/v22-workflow-gate.mjs checkpoint",
    "",
  ].join("\n"));
}
