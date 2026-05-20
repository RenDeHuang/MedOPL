import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const currentPath = "docs/recovery/v22-goal-current.json";
const current = JSON.parse(await readFile(path.join(repoRoot, currentPath), "utf8"));
const portalOplAbsorbedCommit = "8797ffc6f3ba3747cfac55554012b648fcbfb5c9";
const requiredRecords = [
  {
    leafId: "leaf-portal-workspace-file-action-closure",
    recordPath: "docs/recovery/agent-runs/2026-05-19-leaf-portal-workspace-file-action-closure.md",
    commitField: "absorbed_commit",
    commit: "6b9485c0a9a02e23524c4776e6e0d2ef76ac6670",
    requiredFields: [
      "leaf_id",
      "model",
      "base_trunk_head",
      "absorbed_commit",
      "contract_subscription",
      "verification_commands",
      "b_review_result",
      "non_goals",
    ],
  },
];

const schemaAdoptionRecords = [
  {
    recordPath: "docs/recovery/agent-runs/2026-05-20-cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization.md",
    leafId: "cleanup-v22-monolith-agent-workflow-entrypoint-and-trace-normalization",
    runKind: "cleanup",
    status: "pending_b_review",
    branch: "cleanup/v22-monolith-agent-workflow-entrypoint-and-trace-normalization",
    baseTrunkHead: "d35d65ed94cef7fac0493c21643e36a690f57e4c",
    branchOverrideId: "monolith-agent-workflow-entrypoint-and-trace-normalization",
  },
  {
    recordPath: "docs/recovery/agent-runs/2026-05-20-cleanup-v22-tests-taxonomy-hard-retirement.md",
    leafId: "cleanup-v22-tests-taxonomy-hard-retirement",
    runKind: "cleanup",
    status: "pending_b_review",
    branch: "cleanup/v22-tests-taxonomy-hard-retirement",
    baseTrunkHead: "69c08908b84f68e252884fa532c5aef71ef4230e",
    branchOverrideId: "tests-taxonomy-hard-retirement",
  },
];

const allowedModels = new Set(["gpt-5.4", "gpt-5.3-codex", "gpt-5.4-mini"]);

if (current.current_cursor === "leaf-portal-opl-file-run-artifact-closure") {
  requiredRecords.push({
    leafId: "leaf-portal-opl-file-run-artifact-closure",
    recordPath: "docs/recovery/agent-runs/2026-05-19-leaf-portal-opl-file-run-artifact-closure.md",
    commitField: "commit_sha",
    commit: "pending_B_review",
    requiredFields: [
      "leaf_id",
      "goal",
      "model",
      "subagents_and_models",
      "branch",
      "base_trunk_head",
      "commit_sha",
      "contract_subscription",
      "allowed_write_scope",
      "forbidden_scope",
      "implementation_summary",
      "eval_first_changes",
      "blocker_review_and_fix_log",
      "verification_commands",
      "b_review_result",
      "runtime_notes",
      "non_goals",
      "next_leaf",
    ],
  });
}

if (current.last_absorbed_commit === portalOplAbsorbedCommit) {
  requiredRecords.push({
    leafId: "leaf-portal-opl-file-run-artifact-closure",
    recordPath: "docs/recovery/agent-runs/2026-05-19-leaf-portal-opl-file-run-artifact-closure.md",
    commitField: "absorbed_commit",
    commit: portalOplAbsorbedCommit,
    requiredFields: [
      "leaf_id",
      "goal",
      "model",
      "subagents_and_models",
      "branch",
      "base_trunk_head",
      "commit_sha",
      "absorbed_commit",
      "contract_subscription",
      "allowed_write_scope",
      "forbidden_scope",
      "implementation_summary",
      "eval_first_changes",
      "blocker_review_and_fix_log",
      "verification_commands",
      "b_review_result",
      "post_absorb_verification",
      "runtime_notes",
      "non_goals",
      "next_leaf",
      "remaining_non_goals",
    ],
  });
}

const boundaryPhrases = Object.freeze({
  noRealCloud: Object.freeze(["no real cloud", "不调用真实云", "不触发真实云", "不使用真实云"]),
  noSecret: Object.freeze(["no secret", "不读取 secret", "不读取密钥", "不读取秘密"]),
  noUpstream: Object.freeze(["no upstream", "不修改 upstream", "不触碰 upstream", "不改 upstream"]),
});

const checked = [];

function parseMeta(recordText, recordPath) {
  const match = recordText.match(/^## meta\n+([\s\S]*?)(?:\n## |\n$)/mu);
  assert(match, `agent_run_schema_meta_missing:${recordPath}`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const item = line.match(/^- ([a-zA-Z0-9_]+):\s*(.+)$/u);
    if (item) meta[item[1]] = item[2].trim();
  }
  return meta;
}

function assertSchemaRecord({ recordText, record }) {
  const meta = parseMeta(recordText, record.recordPath);
  assert.equal(meta.schema_version, "1", `agent_run_schema_version_mismatch:${record.recordPath}`);
  assert.equal(meta.leaf_id, record.leafId, `agent_run_schema_leaf_id_mismatch:${record.recordPath}`);
  assert.equal(meta.run_kind, record.runKind, `agent_run_schema_run_kind_mismatch:${record.recordPath}`);
  assert.equal(meta.status, record.status, `agent_run_schema_status_mismatch:${record.recordPath}`);
  assert(allowedModels.has(meta.model), `agent_run_schema_model_not_allowed:${record.recordPath}:${meta.model}`);
  assert.equal(meta.branch, record.branch, `agent_run_schema_branch_mismatch:${record.recordPath}`);
  assert.equal(meta.base_trunk_head, record.baseTrunkHead, `agent_run_schema_base_mismatch:${record.recordPath}`);
  assert.equal(meta.branch_override_id, record.branchOverrideId, `agent_run_schema_branch_override_mismatch:${record.recordPath}`);
  assert.equal(meta.absorbed_commit, "none", `pending_agent_run_absorbed_commit_must_be_none:${record.recordPath}`);
  assert(recordText.includes("## post_absorb_verification"), `agent_run_schema_post_absorb_section_missing:${record.recordPath}`);
  assert(recordText.includes("not_applicable_yet"), `pending_agent_run_post_absorb_must_be_not_applicable:${record.recordPath}`);
  for (const section of [
    "## goal",
    "## contract_subscription",
    "## allowed_write_scope",
    "## forbidden_scope",
    "## implementation_summary",
    "## eval_first_changes",
    "## blocker_review_and_fix_log",
    "## verification_commands",
    "## b_review_result",
    "## runtime_notes",
    "## non_goals",
    "## next_leaf",
  ]) {
    assert(recordText.includes(section), `agent_run_schema_section_missing:${record.recordPath}:${section}`);
  }
}

for (const record of requiredRecords) {
  let recordText = "";
  try {
    recordText = await readFile(path.join(repoRoot, record.recordPath), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      assert.fail(`agent_run_record_missing:${record.recordPath}`);
    }
    throw error;
  }

  for (const field of record.requiredFields) {
    assert(recordText.includes(field), `agent_run_record_field_missing:${record.recordPath}:${field}`);
  }

  assert(recordText.includes(record.leafId), `agent_run_record_leaf_id_missing:${record.recordPath}:${record.leafId}`);
  assert(recordText.includes(record.commitField), `agent_run_record_commit_field_missing:${record.recordPath}:${record.commitField}`);
  assert(recordText.includes(record.commit), `agent_run_record_commit_missing:${record.recordPath}:${record.commit}`);

  for (const [boundary, phrases] of Object.entries(boundaryPhrases)) {
    assert(
      phrases.some((phrase) => recordText.includes(phrase)),
      `agent_run_record_boundary_phrase_missing:${record.recordPath}:${boundary}`,
    );
  }
  checked.push(record.recordPath);
}

for (const record of schemaAdoptionRecords) {
  let recordText = "";
  try {
    recordText = await readFile(path.join(repoRoot, record.recordPath), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      assert.fail(`agent_run_schema_record_missing:${record.recordPath}`);
    }
    throw error;
  }
  assertSchemaRecord({ recordText, record });
  for (const [boundary, phrases] of Object.entries(boundaryPhrases)) {
    assert(
      phrases.some((phrase) => recordText.includes(phrase)),
      `agent_run_schema_boundary_phrase_missing:${record.recordPath}:${boundary}`,
    );
  }
  assert(recordText.includes("no build/deploy/kubectl/live-test"), `agent_run_schema_boundary_phrase_missing:${record.recordPath}:noBuildDeployKubectlLiveTest`);
  checked.push(record.recordPath);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_agent_run_record_gate",
  currentCursor: current.current_cursor,
  checked,
  requiredRecords: requiredRecords.map((record) => ({
    recordPath: record.recordPath,
    requiredFields: record.requiredFields,
  })),
}, null, 2));
