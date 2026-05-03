import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(os.tmpdir(), "opl-v20-2-acp-nested-"));

const runtimeParent = path.join(root, "runtime-parent");
const nestedRuntime = path.join(runtimeParent, "one-person-lab-upstream");
const cliPath = path.join(nestedRuntime, "src", "cli.ts");

await mkdir(path.dirname(cliPath), { recursive: true });
await writeFile(cliPath, `
import { createInterface } from "node:readline";

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  const result = request.command === "prompt"
    ? { response: "nested runtime reply", session_id: "nested-session" }
    : { surface_id: "nested-runtime", commands: ["initialize", "prompt"] };
  process.stdout.write(JSON.stringify({ id: request.id, command: request.command, ok: true, result }) + "\\n");
}
`, "utf8");

const previous = {
  OPL_RUNTIME_MODE: process.env.OPL_RUNTIME_MODE,
  OPL_ACP_RUNTIME_DIR: process.env.OPL_ACP_RUNTIME_DIR,
  OPL_ACP_RUNTIME_COMMAND_JSON: process.env.OPL_ACP_RUNTIME_COMMAND_JSON,
  OPL_ACP_RUNTIME_TIMEOUT_MS: process.env.OPL_ACP_RUNTIME_TIMEOUT_MS,
};

try {
  process.env.OPL_RUNTIME_MODE = "acp";
  process.env.OPL_ACP_RUNTIME_DIR = runtimeParent;
  delete process.env.OPL_ACP_RUNTIME_COMMAND_JSON;
  process.env.OPL_ACP_RUNTIME_TIMEOUT_MS = "5000";

  const { promptAcpRuntime } = await import("../services/opl-runtime-bridge/src/opl-acp-runtime-client.mjs");
  const result = await promptAcpRuntime({ prompt: "hello nested runtime" });

  assert.equal(result.response, "nested runtime reply", "nested_runtime_cli_must_be_used");
  assert.equal(result.session_id, "nested-session", "nested_runtime_session_id_must_be_preserved");

  console.log(JSON.stringify({
    ok: true,
    checked: [
      "nested_one_person_lab_upstream_dir",
      "source_cli_discovered",
      "acp_prompt_reply_non_empty",
    ],
  }, null, 2));
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
}
