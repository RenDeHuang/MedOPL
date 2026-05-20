import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const zoningPath = "docs/recovery/repo-zoning.md";
const backlogPath = "docs/recovery/legacy-cleanup-backlog.md";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const zoning = await readFile(zoningPath, "utf8");
const backlog = await readFile(backlogPath, "utf8");

for (const requiredHeading of [
  "# MedOPL v22 Repo Zoning Ledger",
  "## Branch Declaration",
  "## Zone Definitions",
  "## Zone 1: Mainline Truth Surface",
  "## Zone 2: Migration Observation Surface",
  "## Zone 3: Historical Archive Surface",
  "## Zone 4: Authorization Forbidden Surface",
  "## Initial Asset Ledger",
  "## Adjudication Rules",
  "## Non Goals",
]) {
  assertIncludes(zoning, requiredHeading, "repo_zoning_heading");
}

for (const requiredToken of [
  "model: gpt-5.4",
  "cleanup/v22-repo-zoning-ledger",
  "Zone 1",
  "Zone 2",
  "Zone 3",
  "Zone 4",
  "keep",
  "rewrite",
  "archive",
  "delete",
  "tombstone",
  "forbidden_without_authorization",
  "docs/contracts/v22-*",
  "docs/recovery/*",
  "services/portal/**",
  "services/opl-web-gateway/**",
  "services/opl-runtime-bridge/**",
  "tests/**/*.mjs",
  "services/portal/src/routes/user-owned-resource.routes.mjs",
  "physical-delete completed: `services/portal/src/domain/user-owned-resources.mjs`",
  "physical-delete completed: `services/portal/src/state/portal-user-owned-resource-store.mjs`",
  "services/portal/src/domain/resource-orders.mjs",
  "services/portal/src/routes/resource-order*.mjs",
  "services/portal/src/integrations/resource-provisioner-client.mjs",
  "scripts/smoke-test-v19-*",
  "scripts/smoke-test-v20*",
  "scripts/smoke-test-v21-*",
  "scripts/live-test-*",
  "deploy/**",
  ".sentrux/**",
  "adapters/**",
]) {
  assertIncludes(zoning, requiredToken, "repo_zoning_required_token");
}

assertIncludes(
  zoning,
  "| `scripts/live-test-*` | Zone 3 | delete |",
  "repo_zoning_authorized_live_test_delete",
);

for (const forbiddenInstruction of [
  "move scripts",
  "delete files in this branch",
  "modify cloud-lane implementation",
  "modify Portal cloud handlers",
  "run live-test",
  "kubectl",
  "build/push",
]) {
  assertExcludes(zoning, `ALLOW: ${forbiddenInstruction}`, "repo_zoning_must_not_authorize_forbidden_work");
}

for (const requiredHeading of [
  "# MedOPL v22 Legacy Cleanup Backlog",
  "## Execution Model",
  "## Cleanup Slices",
  "## Slice 1: Default Entry Legacy Narrative",
  "## Slice 2: user_owned Primary Path Retirement",
  "## Slice 3: resource-order Primary Path Retirement",
  "## Slice 4: Legacy Script Archive Boundary",
  "## Slice 5: OpenCost and Langfuse Primary Narrative Retirement",
  "## Gate Pattern",
  "## Current Hold Points",
]) {
  assertIncludes(backlog, requiredHeading, "legacy_cleanup_backlog_heading");
}

for (const requiredToken of [
  "smoke = prove the intended v22 path still works",
  "gate = prevent the retired legacy meaning from returning",
  "tests/contract/contract-test-v22-default-entry-narrative-gate.mjs",
  "tests/health/health-check-v22-archive-smoke-contract-physical-retirement-gate.mjs",
  "tests/regression/portal/regression-test-v22-observability-billing-narrative-boundary.mjs",
  "B review",
  "cloud-lane",
  "portal",
]) {
  assertIncludes(backlog, requiredToken, "legacy_cleanup_backlog_required_token");
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_repo_zoning_boundary",
  zoningPath,
  backlogPath,
  zones: [
    "mainline_truth_surface",
    "migration_observation_surface",
    "historical_archive_surface",
    "authorization_forbidden_surface",
  ],
}, null, 2));
