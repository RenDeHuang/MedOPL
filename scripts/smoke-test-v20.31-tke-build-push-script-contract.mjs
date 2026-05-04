import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "deploy/tke-package/scripts/build-and-push-tcr.mjs");
const moduleUrl = `${pathToFileURL(scriptPath).href}?contract=${Date.now()}`;
const {
  DEFAULT_TAG,
  REQUIRED_SYNC_SOURCES,
  REQUIRED_BUILD_IMAGE_KEYS,
  parseArgs,
  resolvePlan,
  renderShellPlan,
} = await import(moduleUrl);

function makeWorkspace() {
  const root = mkdtempSync(path.join(tmpdir(), "tke-build-push-contract-"));
  for (const relative of REQUIRED_SYNC_SOURCES) {
    const target = path.join(root, relative);
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, ".contract"), relative, "utf8");
  }
  mkdirSync(path.join(root, "deploy/tke-package/build/dockerfiles"), { recursive: true });
  mkdirSync(path.join(root, "deploy/tke-package/manifests"), { recursive: true });
  mkdirSync(path.join(root, "deploy/tke-package/env"), { recursive: true });
  mkdirSync(path.join(root, "deploy/tke-package/source"), { recursive: true });

  for (const file of [
    "portal.Dockerfile",
    "opl-runtime-bridge.Dockerfile",
    "opl-web-gateway.Dockerfile",
    "billing-aggregator.Dockerfile",
    "resource-provisioner.Dockerfile",
    "med-autoscience-runner-orchestrator.Dockerfile",
    "opl-web-upstream.local-node.Dockerfile",
  ]) {
    writeFileSync(path.join(root, "deploy/tke-package/build/dockerfiles", file), `FROM scratch\n# ${file}\n`, "utf8");
  }

  writeFileSync(
    path.join(root, "deploy/tke-package/manifests/01-platform-config.yaml"),
    [
      "apiVersion: v1",
      "kind: ConfigMap",
      "metadata:",
      "  name: portal-platform-config",
      "data:",
      '  BUILD_SHA: "__BUILD_SHA__"',
      '  BUILD_TIME: "__BUILD_TIME__"',
      '  PORTAL_IMAGE: "__PORTAL_IMAGE__"',
      '  OPL_ADAPTER_IMAGE: "__OPL_ADAPTER_IMAGE__"',
      '  OPL_WEB_GATEWAY_IMAGE: "__OPL_WEB_GATEWAY_IMAGE__"',
      '  OPL_WEB_IMAGE: "__OPL_WEB_IMAGE__"',
      '  BILLING_IMAGE: "__BILLING_IMAGE__"',
      '  RESOURCE_PROVISIONER_IMAGE: "__RESOURCE_PROVISIONER_IMAGE__"',
      '  RUNNER_ORCHESTRATOR_IMAGE: "__RUNNER_ORCHESTRATOR_IMAGE__"',
      '  MED_AUTOSCIENCE_RUNNER_IMAGE: "__MED_AUTOSCIENCE_RUNNER_IMAGE__"',
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(path.join(root, "deploy/tke-package/manifests/05-platform-workloads.yaml"), 'image: "__PORTAL_IMAGE__"\n', "utf8");
  writeFileSync(path.join(root, "deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml"), 'image: "__BILLING_IMAGE__"\n', "utf8");
  writeFileSync(path.join(root, "deploy/tke-package/manifests/08-langfuse-stack.yaml"), "kind: Namespace\nmetadata:\n  name: langfuse-system\n", "utf8");

  writeFileSync(
    path.join(root, "deploy/tke-package/env/tke.env.example"),
    [
      "NAMESPACE=portal-staging",
      "RUNTIME_NAMESPACE=portal-runtime-staging",
      "INGRESS_CLASS=nginx",
      "TLS_SECRET_NAME=portal-tls",
      "PORTAL_HOST=portal.example.com",
      "OPL_HOST=opl.example.com",
      "BASE_DOMAIN=example.com",
      "TRACE_TLS_SECRET_NAME=trace-tls",
      "BUILD_SHA=stale-build-sha",
      "BUILD_TIME=2020-01-01T00:00:00Z",
      "IMAGE_PULL_SECRET=tcr-pull",
      "IMAGE_PULL_POLICY=Always",
      "PORTAL_IMAGE=placeholder/portal:old",
      "OPL_ADAPTER_IMAGE=placeholder/adapter:old",
      "OPL_WEB_GATEWAY_IMAGE=placeholder/gateway:old",
      "OPL_WEB_IMAGE=placeholder/opl-web:old",
      "BILLING_IMAGE=placeholder/billing:old",
      "RESOURCE_PROVISIONER_IMAGE=placeholder/provisioner:old",
      "RUNNER_ORCHESTRATOR_IMAGE=placeholder/orchestrator:old",
      "MED_AUTOSCIENCE_RUNNER_IMAGE=placeholder/workload:old",
      "",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    path.join(root, "deploy/tke-package/env/tke.env"),
    [
      "NAMESPACE=portal-staging",
      "RUNTIME_NAMESPACE=portal-runtime-staging",
      "INGRESS_CLASS=nginx",
      "TLS_SECRET_NAME=portal-tls",
      "PORTAL_HOST=portal.example.com",
      "OPL_HOST=opl.example.com",
      "BASE_DOMAIN=example.com",
      "TRACE_TLS_SECRET_NAME=trace-tls",
      "BUILD_SHA=stale-build-sha",
      "BUILD_TIME=2020-01-01T00:00:00Z",
      "IMAGE_PULL_SECRET=tcr-pull",
      "IMAGE_PULL_POLICY=Always",
      "PORTAL_IMAGE=placeholder/portal:old",
      "OPL_ADAPTER_IMAGE=placeholder/adapter:old",
      "OPL_WEB_GATEWAY_IMAGE=placeholder/gateway:old",
      "OPL_WEB_IMAGE=placeholder/opl-web:old",
      "BILLING_IMAGE=placeholder/billing:old",
      "RESOURCE_PROVISIONER_IMAGE=placeholder/provisioner:old",
      "RUNNER_ORCHESTRATOR_IMAGE=placeholder/orchestrator:old",
      "MED_AUTOSCIENCE_RUNNER_IMAGE=placeholder/workload:old",
      "",
    ].join("\n"),
    "utf8",
  );

  const oplWebSource = path.join(root, ".runtime/one-person-lab-upstream");
  writeFileSync(path.join(oplWebSource, "Dockerfile"), "FROM scratch\n", "utf8");
  writeFileSync(path.join(oplWebSource, "package.json"), "{\"name\":\"opl-web-fixture\"}\n", "utf8");
  writeFileSync(path.join(oplWebSource, "bun.lock"), "# fixture\n", "utf8");
  mkdirSync(path.join(oplWebSource, "scripts"), { recursive: true });
  writeFileSync(path.join(oplWebSource, "scripts/build-server.mjs"), "console.log('fixture');\n", "utf8");
  mkdirSync(path.join(oplWebSource, "patches"), { recursive: true });
  writeFileSync(path.join(oplWebSource, "patches/fixture.patch"), "fixture\n", "utf8");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "contract@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "contract"], { cwd: root });
  execFileSync(
    "git",
    [
      "add",
      "deploy/tke-package/env/tke.env",
      "deploy/tke-package/env/tke.env.example",
      "deploy/tke-package/manifests/01-platform-config.yaml",
      "deploy/tke-package/manifests/05-platform-workloads.yaml",
      "deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml",
      "deploy/tke-package/manifests/08-langfuse-stack.yaml",
    ],
    { cwd: root },
  );
  return root;
}

{
  assert.equal(DEFAULT_TAG, "opl-v20.31", "default_tag_must_lock_current_release");
  assert.deepEqual(REQUIRED_SYNC_SOURCES, [
    "services/portal",
    "services/opl-runtime-bridge",
    "services/opl-web-gateway",
    "adapters/resource-provisioner",
    "adapters/med-autoscience-runner",
    "adapters/shared",
    "adapters/billing-aggregator",
    "infra/kubernetes",
    "scripts",
    ".runtime/one-person-lab-upstream",
  ]);
  assert.deepEqual(REQUIRED_BUILD_IMAGE_KEYS, [
    "portal",
    "portal-opl-adapter",
    "opl-web-gateway",
    "billing-aggregator",
    "resource-provisioner",
    "med-autoscience-runner-orchestrator",
  ]);
}

{
  const parsed = parseArgs([
    "--sync-source",
    "1",
    "--env-file",
    "deploy/tke-package/env/tke.env.example",
    "--runner-workload-image",
    "registry/workload:opl-v20.31",
    "--skip-login",
    "1",
  ]);

  assert.equal(parsed.syncSource, "1");
  assert.equal(parsed.envFile, "deploy/tke-package/env/tke.env.example");
  assert.equal(parsed.runnerWorkloadImage, "registry/workload:opl-v20.31");
  assert.equal(parsed.skipLogin, "1");
  assert.equal(parsed.tag, undefined);
}

{
  const workspace = makeWorkspace();
  try {
    const plan = resolvePlan({ argv: [], repoRoot: workspace });
    assert.equal(plan.releaseTag, "opl-v20.31");
    assert.equal(plan.options.syncSource, false, "default_must_not_sync_source");
    assert.equal(plan.options.dryRun, true, "default_must_be_dry_run");
    assert.equal(plan.options.skipLogin, false, "skip_login_default_must_be_false");
    assert.equal(path.basename(plan.manifest.outDir), "rendered-v20.31-plan");
    assert.equal(plan.envFile.isTracked, true, "example_env_is_git_tracked");
    assert.equal(plan.envFile.allowTrackedEnv, false);
    assert.equal(plan.buildImages.portal.tag, "opl-v20.31");
    assert.equal(plan.buildImages.portal.image.includes(":opl-v20.31"), true);
    assert.equal(plan.validationErrors.some((value) => /git tracked env file/i.test(value)), true);
    assert.equal(plan.validationErrors.some((value) => /runner workload image/i.test(value)), true);
    assert.equal(plan.validationErrors.some((value) => /docker login/i.test(value)), true);
    assert.equal(plan.pushBlocked, true, "validation_failures_must_block_push");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

{
  const workspace = makeWorkspace();
  try {
    const plan = resolvePlan({
      argv: [
        "--env-file",
        "deploy/tke-package/env/tke.env.example",
        "--allow-tracked-env",
        "1",
        "--skip-login",
        "1",
        "--runner-workload-image",
        "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.31",
      ],
      repoRoot: workspace,
    });

    assert.equal(plan.validationErrors.length, 0);
    assert.equal(plan.pushBlocked, false);
    assert.equal(plan.runnerWorkload.source.type, "image");
    assert.equal(plan.runnerWorkload.image, "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.31");
    assert.equal(plan.login.required, false);
    assert.equal(plan.manifest.allImagesUseReleaseTag, true);
    assert.equal(plan.manifest.buildSha, "opl-v20.31");
    assert.equal(plan.manifest.outDirTracked, false, "manifest_must_render_to_untracked_dir");
    assert.equal(plan.sync.operations.length, REQUIRED_SYNC_SOURCES.length);
    assert.equal(plan.sync.operations.every((item) => item.mode === "cpSync"), true);
    assert.equal(plan.sync.enabled, false);
    assert.equal(plan.oplWeb.exists, true, "opl_web_source_must_exist");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

{
  const workspace = makeWorkspace();
  try {
    const plan = resolvePlan({
      argv: [
        "--env-file",
        "deploy/tke-package/env/tke.env.example",
        "--allow-tracked-env",
        "1",
        "--skip-login",
        "1",
        "--runner-workload-dockerfile",
        "deploy/tke-package/build/dockerfiles/med-autoscience-runner-orchestrator.Dockerfile",
        "--runner-workload-image-repo",
        "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl",
        "--sync-source",
        "1",
      ],
      repoRoot: workspace,
    });

    assert.equal(plan.sync.enabled, true);
    assert.equal(plan.validationErrors.length, 0);
    assert.equal(plan.runnerWorkload.source.type, "dockerfile");
    assert.equal(plan.runnerWorkload.dockerfile.endsWith("med-autoscience-runner-orchestrator.Dockerfile"), true);
    assert.equal(plan.runnerWorkload.image.endsWith(":opl-v20.31"), true);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

{
  const workspace = makeWorkspace();
  try {
    const plan = resolvePlan({
      argv: [
        "--env-file",
        "deploy/tke-package/env/tke.env.example",
        "--allow-tracked-env",
        "1",
        "--runner-workload-image",
        "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.31",
      ],
      repoRoot: workspace,
      env: { TCR_PASSWORD: "super-secret-value" },
    });

    const shellPlan = renderShellPlan(plan);
    assert.match(shellPlan, /docker login/);
    assert.match(shellPlan, /BUILD_SHA=opl-v20\.31/);
    assert.match(shellPlan, /BUILD_TIME=/);
    assert.match(shellPlan, /docker build/);
    assert.match(shellPlan, /docker push/);
    assert.match(shellPlan, /render-tke-manifests\.mjs/);
    assert.match(shellPlan, /--set 'BUILD_SHA=opl-v20\.31'/);
    assert.match(shellPlan, /--set 'PORTAL_IMAGE=uswccr\.ccs\.tencentyun\.com\/gaofenglab\/portal-opl:opl-v20\.31'/);
    assert.match(shellPlan, /--set 'OPL_WEB_IMAGE=uswccr\.ccs\.tencentyun\.com\/gaofenglab\/opl-web-opl:opl-v20\.31'/);
    assert.match(shellPlan, /--set 'MED_AUTOSCIENCE_RUNNER_IMAGE=uswccr\.ccs\.tencentyun\.com\/gaofenglab\/med-autoscience-runner-opl:opl-v20\.31'/);
    assert.doesNotMatch(shellPlan, /super-secret-value/, "shell_plan_must_not_print_secret");
    assert.doesNotMatch(shellPlan, /dify_bundle-med-autoscience:latest/, "runner_workload_must_not_fallback_to_latest_bundle");
    assert.equal(shellPlan.includes("services/portal"), true);
    assert.equal(shellPlan.includes(".runtime/one-person-lab-upstream"), true);
    assert.equal(shellPlan.includes("kubectl apply"), false);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

{
  const workspace = makeWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        "--env-file",
        "deploy/tke-package/env/tke.env.example",
        "--allow-tracked-env",
        "1",
        "--skip-login",
        "1",
        "--runner-workload-image",
        "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.31",
      ],
      {
        cwd: workspace,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, `cli_must_honor_args:${result.stderr}`);
    assert.match(result.stdout, /# env file: deploy\/tke-package\/env\/tke\.env\.example/);
    assert.match(result.stdout, /# docker login skipped by --skip-login 1/);
    assert.doesNotMatch(result.stderr, /Refusing git tracked env file policy for default secrets path/);
    assert.doesNotMatch(result.stdout, /kubectl apply/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({ ok: true, contract: "v20_31_tke_build_push_script" }, null, 2));
