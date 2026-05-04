import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const modulePath = "./lib/v20.33-evidence.mjs";
const {
  createEvidenceRecorder,
  redactSensitiveEvidence,
  sanitizeText,
} = await import(modulePath);

function assertNoSecretText(value) {
  assert.doesNotMatch(
    JSON.stringify(value),
    /super-secret|Bearer\s+[A-Za-z0-9_-]+|AKID[A-Za-z0-9_-]+|q-ak:[A-Za-z0-9._:-]+|x-cos-security-token:[A-Za-z0-9._:-]+/i,
    "evidence_must_not_expose_sensitive_values",
  );
}

const tmpDir = await mkdtemp(path.join(os.tmpdir(), "v20-33-evidence-"));

try {
  const recorder = createEvidenceRecorder({
    evidenceDir: tmpDir,
    contract: "v20.33_evidence_contract",
  });

  const successfulResult = await recorder.runStage(
    "portal_shell",
    {
      blockingUser: false,
      userVisibleState: "Portal shell visible",
    },
    async () => ({
      ok: true,
      nested: {
        providerKey: "super-secret-provider-key",
        note: "authorization Bearer super-secret-token",
      },
    }),
    (result) => ({
      resultOk: result.ok,
      providerKey: result.nested.providerKey,
      tokenPreview: result.nested.note,
    }),
  );
  assert.equal(successfulResult.ok, true, "run_stage_must_return_task_result");

  await assert.rejects(
    () => recorder.runStage(
      "opl_interactive",
      {
        blockingUser: true,
        userVisibleState: "正在准备 OPL",
      },
      async () => {
        throw new Error("providerKey super-secret-token leaked");
      },
    ),
    /providerKey/,
    "run_stage_must_rethrow_original_failure",
  );

  const payload = {
    ok: false,
    status: "failed",
    authorization: "Bearer super-secret-token",
    cookie: "portal_session=super-secret-cookie",
    stages: recorder.stages,
  };
  const evidencePath = await recorder.writeEvidence(payload);
  const written = JSON.parse(await readFile(evidencePath, "utf8"));

  assert.equal(written.contract, "v20.33_evidence_contract", "write_evidence_must_include_contract");
  assert.equal(Array.isArray(written.stages), true, "evidence_must_include_stage_array");
  assert.equal(written.stages.length, 2, "evidence_must_record_success_and_failure_stages");

  for (const stage of written.stages) {
    assert.equal(typeof stage.stage, "string", "stage_must_have_stage_name");
    assert.match(stage.startedAt, /^\d{4}-\d{2}-\d{2}T/, "stage_must_have_started_at_iso");
    assert.match(stage.endedAt, /^\d{4}-\d{2}-\d{2}T/, "stage_must_have_ended_at_iso");
    assert.equal(typeof stage.latencyMs, "number", "stage_must_have_latency_ms");
    assert.equal(typeof stage.ok, "boolean", "stage_must_have_ok_boolean");
    assert.equal(typeof stage.blockingUser, "boolean", "stage_must_have_blocking_user_boolean");
    assert.equal(typeof stage.userVisibleState, "string", "stage_must_have_user_visible_state");
  }

  const failedStage = written.stages.find((stage) => stage.stage === "opl_interactive");
  assert(failedStage, "failed_stage_must_be_written");
  assert.equal(failedStage.ok, false, "failed_stage_must_have_ok_false");
  assert.equal(failedStage.blockingUser, true, "failed_stage_must_preserve_blocking_user");
  assert.equal(failedStage.userVisibleState, "正在准备 OPL", "failed_stage_must_preserve_user_visible_state");
  assert.match(failedStage.error, /providerKey/, "failed_stage_must_keep_sanitized_failure_context");

  assertNoSecretText(written);
  assertNoSecretText(redactSensitiveEvidence({
    nested: {
      password: "super-secret-password",
      api: "q-ak:super-secret-qak x-cos-security-token:super-secret-token AKIDabcdefghijklmnop",
    },
  }));
  assertNoSecretText(sanitizeText("authorization Bearer super-secret-token providerKey super-secret-provider-key"));

  console.log(JSON.stringify({
    ok: true,
    contract: "v20.33_evidence_schema",
    evidencePath,
  }, null, 2));
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}
