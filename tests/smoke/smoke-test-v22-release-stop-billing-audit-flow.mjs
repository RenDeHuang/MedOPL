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
  assert.equal(result.status, 0, `go_release_stop_billing_audit_flow_failed:${result.stderr || result.stdout}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(output.includes("local-rc-provider-key-material-that-must-stay-private"), false, "go_release_stop_billing_audit_flow_must_not_print_raw_provider_key");
}

runGoTest("./internal/domain/controlplane", "TestReleaseStopsBillingAndKeepsHistoryAuditable");
runGoTest("./internal/service/controlplane", "TestServiceOpenManagedEnvironmentCreatesCanonicalRuntimeLifecycleLedger");
runGoTest("./internal/service/controlplane", "TestServiceRuntimeGateProjectsRuntimeLifecycleLedgerState");
runGoTest("./internal/service/controlplane", "TestServiceReleaseIsIdempotentAndClosesRuntimeLifecycleLedger");
runGoTest("./internal/service/controlplane", "TestServiceOpenAfterReleaseReactivatesRuntimeLifecycleWithoutStaleReleaseTime");
runGoTest("./internal/service/controlplane", "TestServiceResourcesAreWorkspaceScopedAndReleaseFailsClosedWhenMissing");
runGoTest("./internal/service/controlplane", "TestServiceReleaseRetainsStorageUntilExplicitDestroyReceipt");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_release_stop_billing_audit_flow",
  owner: "services/medopl-go-backend",
  evidence: "go_runtime_lifecycle_release_stop_billing_audit_boundary",
}, null, 2));
