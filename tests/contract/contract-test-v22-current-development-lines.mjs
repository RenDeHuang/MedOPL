import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const expectedLines = [
  "current-stage-current-cursor",
  "portal-saas-control-plane-product-loop",
  "optional-resource-lifecycle-and-pricing-boundary",
  "portal-opl-runtime-managed-chain",
  "portal-canonical-data-postgres-redis-closure",
  "governance-verification-post-merge-closeout",
];

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function sectionForLine(source, lineId) {
  const heading = `### ${lineId}`;
  const start = source.indexOf(heading);
  assert(start >= 0, `development_line_missing:${lineId}`);
  const next = source.indexOf("\n### ", start + heading.length);
  return next >= 0 ? source.slice(start, next) : source.slice(start);
}

const [active, current] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readJson("tests/fixtures/v22/goal-current.json"),
]);

assert(active.includes("## Current Development Lines"), "active_must_have_current_development_lines");
for (const lineId of expectedLines) {
  const section = sectionForLine(active, lineId);
  for (const label of ["Current evidence:", "Gap:", "Next action:", "Done when:", "Verify:"]) {
    assert(section.includes(label), `development_line_missing_field:${lineId}:${label}`);
  }
}

const cursorSection = sectionForLine(active, "current-stage-current-cursor");
assert(cursorSection.includes(current.current_cursor), "cursor_line_must_reference_machine_cursor");
assert(cursorSection.includes(current.last_landed_commit), "cursor_line_must_reference_last_landed_commit");

const dataSection = sectionForLine(active, "portal-canonical-data-postgres-redis-closure");
const productLoopClosed = current.product_engineering_loop?.status === "closed";
if (productLoopClosed) {
  assert(dataSection.includes("slide-01 closed local production data truth"), "data_line_must_record_closed_local_data_truth");
} else {
  assert(dataSection.includes("status: `gated`"), "data_line_must_remain_gated");
}
assert(dataSection.includes("PostgreSQL"), "data_line_must_name_postgres");
assert(dataSection.includes("Redis"), "data_line_must_name_redis");
assert(dataSection.includes("fail-closed"), "data_line_must_require_fail_closed");

const governanceSection = sectionForLine(active, "governance-verification-post-merge-closeout");
assert(governanceSection.includes("post-merge closeout"), "governance_line_must_require_post_merge_closeout");
assert(governanceSection.includes("node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk"), "governance_line_must_include_verify_entrypoint");

const expectedCannotClaims = productLoopClosed
  ? [
    "不能宣称真实云生产闭环已完成",
    "不能写成 `future-authorized` 等于真实云",
    "不能跳过 post-merge closeout",
  ]
  : [
    "不能宣称 PostgreSQL/Redis、本地 production data layer",
    "不能写成 `future-authorized` 等于真实云",
    "不能跳过 post-merge closeout",
  ];

for (const cannotClaim of expectedCannotClaims) {
  assert(active.includes(cannotClaim), `cannot_claim_must_remain:${cannotClaim}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_current_development_lines",
  lines: expectedLines,
  currentCursor: current.current_cursor,
}, null, 2));
