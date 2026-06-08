import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const [active, product, runtime, delivery, history, current] = await Promise.all([
  readRepoFile("docs/active/README.md"),
  readRepoFile("docs/product/README.md"),
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("docs/delivery/README.md"),
  readRepoFile("docs/history/README.md"),
  readJson("tests/fixtures/v22/goal-current.json"),
]);

assertIncludes(active, "current phase", "active_must_have_phase_field");
assertIncludes(active, current.current_cursor, "active_must_reference_machine_cursor");
assertIncludes(active, current.last_landed_commit, "active_must_reference_last_landed_commit");
assertIncludes(active, "current blocker", "active_must_have_blocker_field");
assertIncludes(active, "next owner", "active_must_have_next_owner_field");
assertIncludes(active, "default verification", "active_must_have_default_verification_field");
assertIncludes(active, "## Open Blockers", "active_must_have_open_blockers");
assertIncludes(active, "## Verification Entry", "active_must_have_verification_entry");
assertIncludes(active, "## Cannot Claim", "active_must_have_cannot_claim");

for (const forbidden of [
  "## Current Development Lines",
  "### portal-saas-control-plane-product-loop",
  "### optional-resource-lifecycle-and-pricing-boundary",
  "### portal-opl-runtime-managed-chain",
  "### portal-canonical-data-postgres-only-closure",
  "### governance-verification-post-merge-closeout",
  "proposal.md",
  "spec-delta.md",
  "design.md",
  "tasks.md",
  "eval-plan.md",
  "review.md",
  "closeout.md",
]) {
  assertExcludes(active, forbidden, "active_must_not_carry_development_line_sections");
}

assertIncludes(active, "Open change detail belongs in `changes/active/<change-id>`", "active_must_delegate_open_change_detail");

assertIncludes(product, "Core User Loop", "product_must_own_user_loop");
assertIncludes(product, "Optional Resource Lifecycle", "product_must_own_resource_lifecycle");
assertIncludes(product, "120min", "product_must_own_stop_billing_window");
assertIncludes(product, "T+1", "product_must_own_audit_window");
assertIncludes(runtime, "PostgreSQL", "runtime_must_own_postgres_truth");
assertIncludes(runtime, "Redis is not a required production dependency", "runtime_must_record_redis_optional_boundary");
assertIncludes(runtime, "PostgreSQL-only required data plane", "runtime_must_own_postgres_only_required_data_plane");
assertExcludes(runtime, "缺 PostgreSQL/Redis production-mode 连接", "runtime_must_not_require_redis_connection");
assertIncludes(runtime, "fail closed", "runtime_must_keep_fail_closed_language");
assertIncludes(delivery, current.current_cursor, "delivery_must_reference_current_cursor");
assertIncludes(delivery, "Go Control Plane MVP Takeover Lane", "delivery_must_own_go_control_plane_takeover_lane");
assertIncludes(history, current.last_landed_commit, "history_must_reference_latest_landed_commit");
assertIncludes(history, "post_merge_closeout", "history_must_own_closeout_schema");

for (const cannotClaim of [
  "不能宣称真实云生产闭环已完成",
  "不能写成 `future-authorized` 等于真实云",
  "不能跳过 post-merge closeout",
]) {
  assertIncludes(active, cannotClaim, `cannot_claim_must_remain:${cannotClaim}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_current_development_lines",
  currentCursor: current.current_cursor,
  activeRole: "narrow_current_state_control_surface",
}, null, 2));
