import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function runGoTest(packagePath, testName) {
  const result = spawnSync("go", ["test", packagePath, "-run", `^${testName}$`, "-count=1", "-v"], {
    cwd: "services/medopl-go-backend",
    env: {
      ...process.env,
      GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct",
      GOSUMDB: process.env.GOSUMDB || "sum.golang.google.cn",
    },
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(result.status, 0, `go_portal_storage_usage_billing_flow_failed:${result.stderr || result.stdout}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, new RegExp(`=== RUN\\s+${testName}`), `go_portal_storage_usage_billing_flow_test_not_executed:${testName}`);
  assert.equal(output.includes("local-rc-provider-key-material-that-must-stay-private"), false, "go_portal_storage_usage_billing_flow_must_not_print_raw_provider_key");
}

runGoTest("./internal/service/controlplane", "TestServiceLocalProductRCUploadFileRunArtifactBillingAuditReleaseAndStorageDestroy");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_storage_usage_billing_flow",
  owner: "services/medopl-go-backend",
  evidence: "go_single_flow_local_product_rc",
}, null, 2));
