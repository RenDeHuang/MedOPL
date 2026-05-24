import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runGoTest(packagePath, testName) {
  const result = spawnSync("go", ["test", packagePath, "-run", testName, "-count=1"], {
    cwd: "services/medopl-go-backend",
    env: {
      ...process.env,
      GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
      GOSUMDB: process.env.GOSUMDB || "sum.golang.google.cn",
    },
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `go_managed_environment_open_flow_failed:${result.stderr || result.stdout}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(output.includes("local-rc-provider-key-material-that-must-stay-private"), false, "go_managed_environment_open_flow_must_not_print_raw_provider_key");
}

runGoTest("./internal/server/handlers", "TestControlPlaneHandlersExposeProviderLaunchBillingResourceLocalRC");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_managed_environment_open_flow",
  owner: "services/medopl-go-backend",
  evidence: "go_provider_preflight_launch_resource_projection",
}, null, 2));
