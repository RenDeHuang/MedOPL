import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function runWorkflow(args) {
  return spawnSync(process.execPath, ["scripts/v22-agent-workflow.mjs", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function parseJson(stdout, label) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label}_json_invalid:${error.message}`);
  }
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

function findPacket(payload, id) {
  const packet = payload.taskPackets.find((item) => item.id === id);
  assert(packet, `task_packet_missing:${id}`);
  return packet;
}

const forbiddenOutputPhrases = [
  "SecretId",
  "SecretKey",
  "token",
  "kubeconfig",
  "raw cloud response",
  "rawCloudResponse",
  "/home/dev/" + ".secrets",
  "real secret directory",
  "--secret-file",
  "--enable-real-fetch",
  "--live-readonly",
];

const statusResult = runWorkflow(["cloud-onboarding", "status", "--json"]);
assert.equal(statusResult.status, 0, `cloud_onboarding_status_must_exit_zero:${statusResult.stderr}`);
assertNotIncludesAny(statusResult.stdout, forbiddenOutputPhrases, "cloud_onboarding_status_stdout");

const statusPayload = parseJson(statusResult.stdout, "cloud_onboarding_status");
assert.equal(statusPayload.ok, true, "status_ok");
assert.equal(statusPayload.command, "cloud-onboarding status", "status_command");
assert.equal(statusPayload.programId, "v22-cloud-onboarding", "program_id");
assert.equal(statusPayload.currentPhase, "starter minimal production cloud loop recorded; B rebase review pending; legacy CO phases are historical aliases only", "current_phase");
assert.equal(statusPayload.activeLane, "starter minimal live evidence reconciliation + rebase verification", "active_lane");
assert.equal(statusPayload.nextLane, "B review / ff-only absorption decision; future pro, upgrade, add-storage and full matrix live reruns require separate authorization", "next_lane");
assert.equal(statusPayload.handoffTarget, "B", "handoff_target");
assert.deepEqual(statusPayload.requiredSmoke, [
  "scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs",
  "scripts/smoke-test-v22-portal-runtime-startup-config.mjs",
  "scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs",
  "scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs",
  "scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs",
  "scripts/smoke-test-v22-portal-production-cloud-operation-loop.mjs",
  "scripts/smoke-test-v22-portal-production-cloud-operation-resource-lifecycle-loop.mjs",
  "scripts/smoke-test-v22-portal-cloud-operation-postgres-canonical-store.mjs",
  "scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs",
  "scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs",
  "scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs",
  "scripts/smoke-test-v22-portal-frontend-surface-eval.mjs",
  "scripts/smoke-test-v22-mvp-contract-suite.mjs",
], "active_required_smoke");
assert.equal(statusPayload.userGate, "starter minimal live loop is recorded; future pro, upgrade, add-storage, dedicated node pool, or full matrix live reruns need separate authorization; node pool baseline desired/current must remain 2 and cleanup must return to 2", "active_user_gate");

assert(statusPayload.phaseSummary.done.some((phase) => phase.phaseId === "CO-01"), "summary_done_must_include_co01");
assert(statusPayload.phaseSummary.done.some((phase) => phase.phaseId === "CO-04"), "summary_done_must_include_co04");
assert(statusPayload.phaseSummary.done.some((phase) => phase.phaseId === "CO-05"), "summary_done_must_include_co05");
assert(statusPayload.phaseSummary.blocked.some((phase) => phase.phaseId === "CO-08"), "summary_blocked_must_include_co08");
assert(statusPayload.phaseSummary.needsUserAuthorization.some((phase) => phase.phaseId === "CO-06"), "summary_needs_user_auth_must_include_co06");
assert.equal(statusPayload.phaseSummary.active.some((phase) => phase.phaseId === "CO-04"), false, "summary_active_must_not_include_done_co04");
assert.deepEqual(statusPayload.phaseSummary.starterLiveDone, [], "co_phase_summary_must_not_reclassify_legacy_co_as_starter_live_done");

assert.deepEqual(statusPayload.serialRealSideEffects, [
  "真实云 live",
  "create/release",
  "deploy/build/push/kubectl",
  "依赖安装",
  "merge/push",
], "serial_real_side_effects");

assertIncludesAll(JSON.stringify(statusPayload.handoffGuidance), [
  "窗口 A：",
  "窗口 B：",
  "窗口 C：",
  "窗口 D：",
], "handoff_guidance");

const checkConfigPacket = findPacket(statusPayload, "check-config");
assert.equal(checkConfigPacket.handoffTarget, "A", "check_config_handoff");
assert.equal(checkConfigPacket.status, "done", "check_config_status");
assert(checkConfigPacket.suggestedCommands.includes("node scripts/smoke-test-v22-tencent-readonly-inventory-local-guard.mjs"), "check_config_smoke_command");
assert(checkConfigPacket.suggestedCommands.includes("node scripts/smoke-test-v22-tencent-readonly-inventory-official-sdk-shape.mjs"), "check_config_shape_smoke_command");

const defaultGatePacket = findPacket(statusPayload, "default-gate");
assert.equal(defaultGatePacket.handoffTarget, "B", "default_gate_handoff");
assert.equal(defaultGatePacket.status, "done", "default_gate_status");

const harnessPacket = findPacket(statusPayload, "cloud-harness-l1-l4-refactor");
assert.equal(harnessPacket.handoffTarget, "B", "harness_packet_handoff");
assert.equal(harnessPacket.status, "starter-live-done", "harness_packet_status");
assert.equal(harnessPacket.requiresManualMergeDecision, true, "harness_packet_manual");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-cloud-harness-manifest-selector.mjs"), "harness_packet_must_include_manifest_selector_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-portal-runtime-startup-config.mjs"), "harness_packet_must_include_l1_runtime_config_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-cloud-live-cleanup-gate.mjs"), "harness_packet_must_include_cleanup_gate_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-portal-cloud-operation-worker-entrypoint.mjs"), "harness_packet_must_include_worker_entrypoint_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-portal-cloud-operation-async-worker-loop.mjs"), "harness_packet_must_include_async_worker_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-portal-package-click-cloud-resource-loop.mjs"), "harness_packet_must_include_package_click_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-release-stop-billing-audit-flow.mjs"), "harness_packet_must_include_l3_release_billing_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-portal-files-billing-trace-flow.mjs"), "harness_packet_must_include_l3_files_billing_trace_smoke");
assert(harnessPacket.suggestedCommands.includes("node scripts/smoke-test-v22-portal-frontend-surface-eval.mjs"), "harness_packet_must_include_l4_frontend_surface_smoke");
assertIncludesAll(harnessPacket.userGate, [
  "baseline desired/current",
  "must remain 2",
  "cleanup must return to 2",
], "harness_packet_must_record_baseline_two");
assert(harnessPacket.userGate.includes("future pro, upgrade, add-storage"), "harness_packet_must_not_claim_full_matrix_live");

const userLivePacket = findPacket(statusPayload, "user-authorized-readonly-live");
assert.equal(userLivePacket.handoffTarget, "D", "user_live_handoff");
assert.equal(userLivePacket.status, "needs-user-authorization", "user_live_status");
assert.equal(userLivePacket.needsUserAuthorization, true, "user_live_needs_auth");
assert.deepEqual(userLivePacket.suggestedCommands, [], "user_live_must_not_have_executable_commands");
assert.equal(userLivePacket.blockedReason, "needs_explicit_user_authorization", "user_live_blocked_reason");

const bReviewMergePacket = findPacket(statusPayload, "b-review-merge");
assert.equal(bReviewMergePacket.handoffTarget, "B", "b_review_merge_handoff");
assert.equal(bReviewMergePacket.requiresManualMergeDecision, true, "b_review_merge_manual");
assert.equal(bReviewMergePacket.suggestedCommands.some((command) => command.startsWith("git merge")), false, "b_review_merge_must_not_auto_merge");
assert.equal(bReviewMergePacket.suggestedCommands.some((command) => command.startsWith("git push")), false, "b_review_merge_must_not_auto_push");

const nextResult = runWorkflow(["cloud-onboarding", "next", "--json"]);
assert.equal(nextResult.status, 0, `cloud_onboarding_next_must_exit_zero:${nextResult.stderr}`);
assertNotIncludesAny(nextResult.stdout, forbiddenOutputPhrases, "cloud_onboarding_next_stdout");
const nextPayload = parseJson(nextResult.stdout, "cloud_onboarding_next");
assert.equal(nextPayload.command, "cloud-onboarding next", "next_command");
assert.equal(nextPayload.nextTaskPacket.id, "cloud-harness-l1-l4-refactor", "next_task_packet_id");
assert.equal(nextPayload.nextTaskPacket.handoffTarget, "B", "next_task_handoff");
assert.equal(nextPayload.nextTaskPacket.requiresManualMergeDecision, true, "next_task_must_need_b_review_after_starter_live");
assert.equal(nextPayload.nextTaskPacket.suggestedCommands.some((command) => command.includes("kubectl")), false, "next_task_must_not_emit_kubectl_command");

const humanStatus = runWorkflow(["cloud-onboarding", "status"]);
assert.equal(humanStatus.status, 0, `cloud_onboarding_human_status_must_exit_zero:${humanStatus.stderr}`);
assertNotIncludesAny(humanStatus.stdout, forbiddenOutputPhrases, "cloud_onboarding_human_stdout");
assertIncludesAll(humanStatus.stdout, [
  "v22 cloud onboarding workflow",
  "program id: v22-cloud-onboarding",
  "active lane: starter minimal live evidence reconciliation + rebase verification",
  "next lane: B review / ff-only absorption decision; future pro, upgrade, add-storage and full matrix live reruns require separate authorization",
  "needs-user-authorization",
  "starter-live-done",
  "A/B/C/D handoff",
  "JSON 摘要",
], "cloud_onboarding_human_status");

const suite = await readFile(path.join(repoRoot, "scripts/smoke-test-v22-mvp-contract-suite.mjs"), "utf8");
assert(suite.includes("smoke-test-v22-agent-workflow-cloud-onboarding.mjs"), "mvp_suite_must_include_cloud_onboarding_agent_workflow_smoke");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_agent_workflow_cloud_onboarding",
  covered: [
    "cloud_onboarding_status_json",
    "current_phase_active_lane_next_lane",
    "phase_summary_done_pending_blocked_needs_user_authorization",
    "required_smoke_user_gate_handoff_target",
    "harness_l1_l4_check_config_default_gate_user_authorized_live_and_b_review_merge_packets",
    "needs_user_authorization_has_no_executable_live_command",
    "serial_real_side_effects",
    "stable_a_b_c_d_handoff_copy",
    "redacted_output",
    "mvp_suite_includes_smoke",
  ],
}, null, 2));
