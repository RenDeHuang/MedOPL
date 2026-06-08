import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const serviceOwnedTest = "services/opl-runtime-bridge/src/runtime-bridge-session-run-file-provider-keyref-flow.test.mjs";

const result = spawnSync(process.execPath, [serviceOwnedTest], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
