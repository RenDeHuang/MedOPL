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
  assert.equal(result.status, 0, `go_user_credit_provider_key_flow_failed:${result.stderr || result.stdout}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(output.includes("local-rc-provider-key-material-that-must-stay-private"), false, "go_user_credit_provider_key_flow_must_not_print_raw_provider_key");
}

runGoTest("./internal/server/handlers", "TestControlPlaneHandlersExposeV22GoTakeoverProviderOpenShape");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_user_credit_provider_key_flow",
  owner: "services/medopl-go-backend",
  evidence: "go_v22_provider_key_prepare_credit_readiness",
}, null, 2));
