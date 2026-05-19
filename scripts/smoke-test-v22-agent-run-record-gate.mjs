import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const recordPath = "docs/recovery/agent-runs/2026-05-19-leaf-portal-workspace-file-action-closure.md";
const absorbedCommit = "6b9485c0a9a02e23524c4776e6e0d2ef76ac6670";

const requiredFields = Object.freeze([
  "leaf_id",
  "model",
  "base_trunk_head",
  "absorbed_commit",
  "contract_subscription",
  "verification_commands",
  "b_review_result",
  "non_goals",
]);

const boundaryPhrases = Object.freeze({
  noRealCloud: Object.freeze(["no real cloud", "不调用真实云", "不触发真实云", "不使用真实云"]),
  noSecret: Object.freeze(["no secret", "不读取 secret", "不读取密钥", "不读取秘密"]),
  noUpstream: Object.freeze(["no upstream", "不修改 upstream", "不触碰 upstream", "不改 upstream"]),
});

let recordText = "";
try {
  recordText = await readFile(path.join(repoRoot, recordPath), "utf8");
} catch (error) {
  if (error && error.code === "ENOENT") {
    assert.fail(`agent_run_record_missing:${recordPath}`);
  }
  throw error;
}

for (const field of requiredFields) {
  assert(recordText.includes(field), `agent_run_record_field_missing:${field}`);
}

assert(recordText.includes(absorbedCommit), `agent_run_record_absorbed_commit_missing:${absorbedCommit}`);

for (const [boundary, phrases] of Object.entries(boundaryPhrases)) {
  assert(
    phrases.some((phrase) => recordText.includes(phrase)),
    `agent_run_record_boundary_phrase_missing:${boundary}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_agent_run_record_gate",
  recordPath,
  absorbedCommit,
  requiredFields,
}, null, 2));
