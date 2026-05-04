import { strict as assert } from "node:assert";
import { buildKubectlDryRunArgs, runK8sPreflight } from "../adapters/med-autoscience-runner/src/runner-k8s-preflight.mjs";

const dryRunArgs = buildKubectlDryRunArgs({
  namespace: "default",
  manifestPath: "/tmp/job.yaml",
});
assert.deepEqual(dryRunArgs, ["apply", "-n", "default", "--dry-run=server", "-f", "/tmp/job.yaml"]);

const calls = [];
await runK8sPreflight({
  namespace: "default",
  manifestPath: "/tmp/job.yaml",
  jobName: "job-a",
  correlationId: "corr-preflight-ok",
  kubectl: async (args) => {
    calls.push(args);
    if (args[0] === "auth") {
      return { stdout: "yes", stderr: "" };
    }
    return { stdout: "ok", stderr: "" };
  },
});
assert.equal(calls.length, 3, "preflight 必须执行 namespace/rbac/dry-run 三步");

let namespaceErr = null;
try {
  await runK8sPreflight({
    namespace: "default",
    manifestPath: "/tmp/job.yaml",
    jobName: "job-a",
    correlationId: "corr-preflight-1",
    kubectl: async (args) => {
      if (args[0] === "get") {
        const err = new Error("namespaces \"default\" not found");
        err.stderr = "Error from server (NotFound)";
        throw err;
      }
      return { stdout: "", stderr: "" };
    },
  });
} catch (error) {
  namespaceErr = error;
}
assert(namespaceErr, "namespace 失败必须抛出结构化错误");
assert.equal(namespaceErr.code, "RUNNER_NAMESPACE_NOT_FOUND");
assert.equal(namespaceErr.stage, "k8s_apply");
assert.equal(namespaceErr.correlationId, "corr-preflight-1");
assert.equal(namespaceErr.details.correlationId, "corr-preflight-1");

let rbacErr = null;
try {
  await runK8sPreflight({
    namespace: "default",
    manifestPath: "/tmp/job.yaml",
    jobName: "job-a",
    correlationId: "corr-rbac-1",
    kubectl: async (args) => {
      if (args[0] === "auth") return { stdout: "no", stderr: "forbidden" };
      return { stdout: "ok", stderr: "" };
    },
  });
} catch (error) {
  rbacErr = error;
}
assert(rbacErr, "rbac 失败必须抛出结构化错误");
assert.equal(rbacErr.code, "RUNNER_K8S_RBAC_DENIED");
assert.equal(rbacErr.stage, "k8s_apply");

let manifestErr = null;
try {
  await runK8sPreflight({
    namespace: "default",
    manifestPath: "/tmp/job.yaml",
    jobName: "job-a",
    correlationId: "corr-manifest-1",
    kubectl: async (args) => {
      if (args[0] === "auth") return { stdout: "yes", stderr: "" };
      if (args.includes("--dry-run=server")) {
        const err = new Error("error validating data: invalid manifest");
        err.stderr = "error validating data: invalid manifest";
        throw err;
      }
      return { stdout: "ok", stderr: "" };
    },
  });
} catch (error) {
  manifestErr = error;
}
assert(manifestErr, "manifest dry-run 失败必须抛出结构化错误");
assert.equal(manifestErr.code, "RUNNER_MANIFEST_INVALID");
assert.equal(manifestErr.stage, "k8s_apply");

console.log(JSON.stringify({
  ok: true,
  verified: [
    "dry_run_args_contract",
    "preflight_three_steps_contract",
    "namespace_error_classification_contract",
  ],
}, null, 2));
