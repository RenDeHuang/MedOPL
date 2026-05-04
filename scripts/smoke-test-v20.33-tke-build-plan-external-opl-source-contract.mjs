import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  REQUIRED_SYNC_SOURCES,
  resolvePlan,
  renderShellPlan,
} = await import("../deploy/tke-package/scripts/build-and-push-tcr.mjs");

function writeText(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
}

function makeWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), "v20-33-tke-external-opl-"));
  for (const relative of REQUIRED_SYNC_SOURCES) {
    if (relative === ".runtime/one-person-lab-upstream") continue;
    writeText(path.join(root, relative, ".contract"), relative);
  }

  for (const file of [
    "portal.Dockerfile",
    "opl-runtime-bridge.Dockerfile",
    "opl-web-gateway.Dockerfile",
    "billing-aggregator.Dockerfile",
    "resource-provisioner.Dockerfile",
    "med-autoscience-runner-orchestrator.Dockerfile",
    "opl-web-upstream.local-node.Dockerfile",
  ]) {
    writeText(path.join(root, "deploy/tke-package/build/dockerfiles", file), `FROM scratch\n# ${file}\n`);
  }

  writeText(
    path.join(root, "deploy/tke-package/env/tke.env.example"),
    [
      "NAMESPACE=default",
      "RUNTIME_NAMESPACE=portal-runtime-v20-32-staging",
      "INGRESS_CLASS=nginx",
      "TLS_SECRET_NAME=portal-tls",
      "PORTAL_HOST=portal.medopl.cn",
      "OPL_HOST=opl.medopl.cn",
      "BASE_DOMAIN=medopl.cn",
      "TRACE_TLS_SECRET_NAME=trace-tls",
      "IMAGE_PULL_SECRET=tcr-pull",
      "IMAGE_PULL_POLICY=Always",
      "MED_AUTOSCIENCE_RUNNER_IMAGE=placeholder/workload:old",
      "",
    ].join("\n"),
  );

  writeText(path.join(root, "deploy/tke-package/manifests/00-namespaces.yaml"), "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: __NAMESPACE__\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

const workspace = makeWorkspace();
const externalRuntime = mkdtempSync(path.join(tmpdir(), "one-person-lab-upstream-"));
const externalWeb = mkdtempSync(path.join(tmpdir(), "opl-aion-shell-"));

try {
  writeText(path.join(externalRuntime, "package.json"), "{\"name\":\"one-person-lab-upstream\"}\n");
  writeText(path.join(externalWeb, "package.json"), "{\"name\":\"opl-aion-shell\"}\n");
  writeText(path.join(externalWeb, "bun.lock"), "# bun lock fixture\n");
  writeText(path.join(externalWeb, "scripts/build-server.mjs"), "console.log('build server fixture');\n");
  writeText(path.join(externalWeb, "patches/fixture.patch"), "fixture\n");

  const plan = resolvePlan({
    argv: [
      "--tag",
      "opl-v20.33",
      "--sync-source",
      "1",
      "--skip-login",
      "1",
      "--allow-tracked-env",
      "1",
      "--env-file",
      "deploy/tke-package/env/tke.env.example",
      "--manifest-out-dir",
      "deploy/tke-package/rendered-v20.33-plan",
      "--opl-runtime-source",
      externalRuntime,
      "--opl-web-source",
      externalWeb,
      "--runner-workload-image",
      "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.33",
    ],
    repoRoot: workspace,
    env: { TCR_PASSWORD: "" },
  });

  assert.equal(plan.pushBlocked, false, `external_upstream_must_not_block_push:${plan.validationErrors.join(";")}`);
  assert.equal(plan.oplRuntime.sourcePath, externalRuntime, "runtime_bridge_sync_must_use_explicit_runtime_source");
  assert.equal(plan.oplWeb.sourcePath, externalWeb, "opl_web_build_must_use_explicit_webui_source");

  const upstreamSync = plan.sync.operations.find((operation) =>
    operation.target.endsWith("deploy/tke-package/source/.runtime/one-person-lab-upstream"),
  );
  assert.ok(upstreamSync, "upstream_sync_operation_must_still_materialize_expected_package_path");
  assert.equal(upstreamSync.source, externalRuntime, "sync_operation_must_copy_from_explicit_runtime_source");
  assert.equal(path.dirname(upstreamSync.target).endsWith("deploy/tke-package/source/.runtime"), true);

  const shellPlan = renderShellPlan(plan);
  assert.match(shellPlan, /^set -euo pipefail$/m, "release_shell_plan_must_fail_fast");
  assert.match(shellPlan, new RegExp(externalRuntime.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(shellPlan, new RegExp(externalWeb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(shellPlan, /--set 'BUILD_SHA=opl-v20\.33'/);
  assert.match(shellPlan, /--set 'PORTAL_IMAGE=uswccr\.ccs\.tencentyun\.com\/gaofenglab\/portal-opl:opl-v20\.33'/);
  assert.match(shellPlan, /--set 'OPL_WEB_IMAGE=uswccr\.ccs\.tencentyun\.com\/gaofenglab\/opl-web-opl:opl-v20\.33'/);
  assert.match(shellPlan, /--set 'MED_AUTOSCIENCE_RUNNER_IMAGE=uswccr\.ccs\.tencentyun\.com\/gaofenglab\/med-autoscience-runner-opl:opl-v20\.33'/);
  assert.doesNotMatch(shellPlan, /Sync source missing/, "shell_plan_must_not_include_validation_errors");

  const invalidWebPlan = resolvePlan({
    argv: [
      "--tag",
      "opl-v20.33",
      "--sync-source",
      "1",
      "--skip-login",
      "1",
      "--allow-tracked-env",
      "1",
      "--env-file",
      "deploy/tke-package/env/tke.env.example",
      "--manifest-out-dir",
      "deploy/tke-package/rendered-v20.33-plan",
      "--opl-runtime-source",
      externalRuntime,
      "--opl-web-source",
      externalRuntime,
      "--runner-workload-image",
      "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.33",
    ],
    repoRoot: workspace,
    env: { TCR_PASSWORD: "" },
  });
  assert.equal(invalidWebPlan.pushBlocked, true, "runtime_source_must_not_pass_as_webui_source");
  assert.match(
    invalidWebPlan.validationErrors.join("\n"),
    /OPL web source must contain bun\.lock/,
    "webui_source_validation_must_catch_missing_bun_lock",
  );

  console.log(JSON.stringify({ ok: true, contract: "v20.33_tke_external_opl_source" }, null, 2));
} finally {
  rmSync(workspace, { recursive: true, force: true });
  rmSync(externalRuntime, { recursive: true, force: true });
  rmSync(externalWeb, { recursive: true, force: true });
}
