import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateReview } from "../../scripts/v22-workflow-gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const workflowSource = await readFile(path.join(repoRoot, "scripts/v22-workflow-gate.mjs"), "utf8");
const manifest = JSON.parse(await readFile(path.join(repoRoot, "tests/fixtures/v22/agent-verify-manifest.json"), "utf8"));

const review = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "docs/active/README.md",
    "tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs",
    "services/medopl-go-backend/internal/server/router.go",
  ],
  changedStatuses: new Map([
    ["docs/active/README.md", "M"],
    ["tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs", "A"],
    ["services/medopl-go-backend/internal/server/router.go", "M"],
  ]),
  branchName: "cleanup/v22-opl-docs-engineering-loop-closure",
  addedLines: [
    "+ const example = 'safe text';",
  ],
});

for (const command of [
  "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-verify.mjs suite local-contract --base origin/recovery/platform-v22-trunk",
  "node scripts/v22-workflow-gate.mjs review --base origin/recovery/platform-v22-trunk",
  "git diff --check -- docs tests scripts services",
]) {
  assert(review.recommendedCommands.includes(command), `review_recommended_command_missing:${command}`);
}

const secretLineReview = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: ["docs/active/README.md"],
  changedStatuses: new Map([["docs/active/README.md", "M"]]),
  branchName: "cleanup/v22-opl-docs-engineering-loop-closure",
  addedLines: [`+ ${["OPENAI", "API", "KEY"].join("_")}=${["sk", "1234567890abcdefghijklmnopqrstuvwxyz1234567890"].join("-")}`],
});

assert.equal(secretLineReview.ok, false, "secret_added_line_must_block_review");
assert(secretLineReview.findings.some((finding) => finding.code === "secret_like_added_line"), "secret_added_line_finding_missing");

const forbiddenDiffReview = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: ["deploy/prod.yaml"],
  changedStatuses: new Map([["deploy/prod.yaml", "M"]]),
  branchName: "cleanup/v22-opl-docs-engineering-loop-closure",
  addedLines: [],
});

assert.equal(forbiddenDiffReview.ok, false, "forbidden_diff_must_block_review");
assert(forbiddenDiffReview.findings.some((finding) => finding.code === "forbidden_path_changed"), "forbidden_diff_finding_missing");

const archivedPackageMoveReview = evaluateReview({
  base: "origin/recovery/platform-v22-trunk",
  changedFiles: [
    "changes/active/portal-typed-api-contract/proposal.md",
    "changes/active/portal-typed-api-contract/spec-delta.md",
    "changes/active/portal-typed-api-contract/eval-plan.md",
    "changes/active/portal-typed-api-contract/closeout.md",
    "changes/archive/2026-05-24-portal-typed-api-contract/proposal.md",
    "changes/archive/2026-05-24-portal-typed-api-contract/spec-delta.md",
    "changes/archive/2026-05-24-portal-typed-api-contract/eval-plan.md",
    "changes/archive/2026-05-24-portal-typed-api-contract/closeout.md",
    "docs/active/README.md",
  ],
  changedStatuses: new Map([
    ["changes/active/portal-typed-api-contract/proposal.md", "D"],
    ["changes/active/portal-typed-api-contract/spec-delta.md", "D"],
    ["changes/active/portal-typed-api-contract/eval-plan.md", "D"],
    ["changes/active/portal-typed-api-contract/closeout.md", "D"],
    ["changes/archive/2026-05-24-portal-typed-api-contract/proposal.md", "A"],
    ["changes/archive/2026-05-24-portal-typed-api-contract/spec-delta.md", "A"],
    ["changes/archive/2026-05-24-portal-typed-api-contract/eval-plan.md", "A"],
    ["changes/archive/2026-05-24-portal-typed-api-contract/closeout.md", "A"],
    ["docs/active/README.md", "M"],
  ]),
  branchName: "feat/medopl-gap-typed-api-closeout",
  addedLines: [],
  missingLocalCommandReferences: [],
});

assert(
  archivedPackageMoveReview.reviewPackages.every((record) => record.path !== "changes/active/portal-typed-api-contract"),
  "archived_change_move_must_not_validate_deleted_active_package",
);
assert.equal(
  archivedPackageMoveReview.findings.some((finding) => finding.code === "formal_change_package_missing_spec_or_eval_plan"),
  false,
  "archived_change_move_must_not_report_deleted_active_package_as_incomplete",
);

assert(workflowSource.includes("secretLikeAddedLines"), "workflow_gate_must_report_secret_added_lines");
assert(workflowSource.includes("reviewRequiredCommands"), "workflow_gate_must_have_unified_review_required_commands");

const reviewSuite = manifest.suites.find((suite) => suite.id === "review");
assert(reviewSuite, "review_suite_missing");
assert(reviewSuite.commands.includes("node tests/contract/contract-test-v22-review-secret-hygiene-gate.mjs"), "review_suite_must_run_secret_hygiene_gate");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_review_secret_hygiene_gate",
  recommendedCommands: review.recommendedCommands,
}, null, 2));
