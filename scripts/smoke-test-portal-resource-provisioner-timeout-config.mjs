import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const { stdout } = await execFileAsync(process.execPath, [
  "--input-type=module",
  "-e",
  "import { RESOURCE_PROVISIONER_TIMEOUT_MS } from './services/portal/src/config/portal-config.mjs'; console.log(JSON.stringify({ RESOURCE_PROVISIONER_TIMEOUT_MS }));",
], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    RESOURCE_PROVISIONER_TIMEOUT_MS: "123456",
  },
});

const parsed = JSON.parse(stdout);
assert.equal(parsed.RESOURCE_PROVISIONER_TIMEOUT_MS, 123456);

console.log(JSON.stringify({ ok: true, contract: "portal_resource_provisioner_timeout_config" }, null, 2));
