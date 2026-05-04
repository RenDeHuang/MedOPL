import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scripts = [
  {
    path: "scripts/live-test-v20.33-production-preacceptance.mjs",
    contract: "v20.33_production_preacceptance",
    evidenceDir: "v20.33-production-preacceptance",
    skipReason: "RUN_V20_33_PREACCEPTANCE_not_enabled",
    stages: ["preacceptance_skip", "portal_build", "portal_login", "portal_pages", "portal_opl_jump"],
  },
  {
    path: "scripts/live-test-v20.33-portal-opl-message-loop.mjs",
    contract: "v20.33_portal_opl_message_loop",
    evidenceDir: "v20.33-portal-opl-message-loop",
    skipReason: "RUN_V20_33_LIVE_not_enabled",
    stages: ["portal_opl_message_skip", "portal_build", "portal_login", "opl_enter", "opl_message"],
  },
  {
    path: "scripts/live-test-v20.33-isolated-full-loop.mjs",
    contract: "v20.33_isolated_full_loop",
    evidenceDir: "v20.33-isolated-full-loop",
    skipReason: "RUN_V20_33_FULL_LOOP_not_enabled",
    stages: ["full_loop_skip", "admin_login", "resource_provision", "delete_node_pool"],
  },
];

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

for (const script of scripts) {
  const source = await readFile(script.path, "utf8");
  mustMatch(source, /from\s+["']\.\/lib\/v20\.33-evidence\.mjs["']/, `${script.path}:must_import_v20_33_evidence_lib`);
  mustMatch(source, /\bcreateEvidenceRecorder\b/, `${script.path}:must_create_evidence_recorder`);
  mustMatch(source, new RegExp(script.evidenceDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${script.path}:must_write_v20_33_evidence_dir`);
  mustMatch(source, new RegExp(script.contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${script.path}:must_record_v20_33_contract`);
  mustMatch(source, new RegExp(script.skipReason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${script.path}:must_keep_safe_skip_reason`);
  mustMatch(source, /\bblockingUser\b/, `${script.path}:must_record_blocking_user`);
  mustMatch(source, /\buserVisibleState\b/, `${script.path}:must_record_user_visible_state`);
  mustMatch(source, /\bwriteEvidence\b/, `${script.path}:must_write_evidence`);

  for (const stage of script.stages) {
    mustMatch(source, new RegExp(stage), `${script.path}:must_reference_stage:${stage}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  contract: "v20.33_live_evidence_integration_static",
  scripts: scripts.map((script) => script.path),
}, null, 2));
