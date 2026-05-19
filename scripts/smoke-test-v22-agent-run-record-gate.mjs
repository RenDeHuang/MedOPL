import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
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
