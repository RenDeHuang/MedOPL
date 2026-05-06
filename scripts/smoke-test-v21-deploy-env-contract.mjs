import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = mkdtempSync(path.join(tmpdir(), "v21-deploy-env-contract-"));

function writeEnv(name, lines) {
  const file = path.join(root, name);
  writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
  return file;
}

function runCheck(envFile, secretsFile = "") {
  const args = ["scripts/check-v21-deploy-env.mjs", "--deploy-env-file", envFile, "--json"];
  if (secretsFile) args.push("--deploy-secrets-env-file", secretsFile);
  const result = spawnSync(process.execPath, args, {
    cwd: path.resolve("."),
    encoding: "utf8",
  });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout || "{}");
  } catch (error) {
    throw new Error(`deploy_env_check_must_print_json:${error.message}:stdout=${result.stdout}:stderr=${result.stderr}`);
  }
  return { result, payload };
}

const goodEnvLines = [
  "NAMESPACE=portal-v21-gray",
  "RUNTIME_NAMESPACE=portal-v21-runtime",
  "INGRESS_CLASS=nginx",
  "PORTAL_TLS_SECRET_NAME=portal-tls",
  "OPL_TLS_SECRET_NAME=opl-tls",
  "PORTAL_QCLOUD_CERT_ID=XEgpceaK",
  "OPL_QCLOUD_CERT_ID=XEfoDs5W",
  "PORTAL_HOST=portal.medopl.cn",
  "OPL_HOST=opl.medopl.cn",
  "BUILD_SHA=opl-v21",
  "PRODUCT_RUNTIME_MODE=platform_provisioned",
  "PRODUCT_OPS_PROFILE=0",
  "IMAGE_PULL_SECRET=gaofeng-tcr-key",
  "IMAGE_PULL_POLICY=Always",
  "PORTAL_IMAGE=uswccr.ccs.tencentyun.com/gaofenglab/portal-opl:opl-v21",
  "OPL_ADAPTER_IMAGE=uswccr.ccs.tencentyun.com/gaofenglab/portal-opl-adapter-opl:opl-v21",
  "OPL_WEB_GATEWAY_IMAGE=uswccr.ccs.tencentyun.com/gaofenglab/opl-web-gateway-opl:opl-v21",
  "OPL_WEB_IMAGE=uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl:opl-v21",
  "BILLING_IMAGE=uswccr.ccs.tencentyun.com/gaofenglab/billing-aggregator-opl:opl-v21",
  "V21_CLOUD_PROVISIONER_URL=http://cloud-provisioner:18893",
  "CLOUD_PROVISIONER_IMAGE_TAG=opl-v21",
  "RUNTIME_STORAGE_CLASS=cfs",
  "RUNTIME_STORAGE_SIZE=20Gi",
  "CLOUD_PROVISIONER_CPU_REQUEST=50m",
  "CLOUD_PROVISIONER_CPU_LIMIT=200m",
  "CLOUD_PROVISIONER_MEMORY_REQUEST=64Mi",
  "CLOUD_PROVISIONER_MEMORY_LIMIT=128Mi",
  "PORTAL_STORAGE_MODE=postgres_redis",
  "PORTAL_DB_NAMESPACE=portal_v21",
  "PORTAL_POSTGRES_URL=postgresql://portal:secret@10.0.0.10:5432/postgres?sslmode=disable",
  "PORTAL_REDIS_URL=redis://:secret@10.0.0.11:6379",
  "PORTAL_ADMIN_EMAIL=admin@medopl.cn",
  "PORTAL_ADMIN_NAME=Admin",
  "PORTAL_ADMIN_PASSWORD=secret-password",
  "PORTAL_INTERNAL_AUTH_TOKEN=long-internal-token",
  "PORTAL_OIDC_ENABLED=0",
  "PORTAL_IDENTITY_SYNC_MODE=local",
  "OPL_LAUNCH_SECRET=long-launch-secret",
  "OPL_RUNTIME_MODE=acp",
  "OPL_ACP_RUNTIME_DIR=/app/one-person-lab-upstream",
  "OPL_ACP_RUNTIME_TIMEOUT_MS=120000",
  "OPL_WEB_UPSTREAM_URL=http://opl-web-upstream:3000",
  "OPL_WEBUI_AUTH_MODE=none",
  "TENCENT_BILLING_ENABLED=1",
  "TENCENT_BILLING_REQUIRED=0",
  "TENCENT_PRICE_ENABLED=1",
  "TENCENT_CLOUD_REGION=na-siliconvalley",
  "TENCENT_COS_BILL_BUCKET=opl-1410708315",
  "TENCENT_COS_BILL_REGION=na-siliconvalley",
  "TENCENT_COS_BILL_PREFIX=daily/",
  "TENCENT_COS_BILL_ENDPOINT=https://opl-1410708315.cos.na-siliconvalley.myqcloud.com",
  "TENCENT_BILLING_SECRET_ID=billing-id",
  "TENCENT_BILLING_SECRET_KEY=billing-key",
  "TENCENT_COS_SECRET_ID=cos-id",
  "TENCENT_COS_SECRET_KEY=cos-key",
  "BILLING_RECONCILE_SCHEDULE=*/30 * * * *",
];

const goodEnv = writeEnv("good.env", goodEnvLines);

const goodSecrets = writeEnv("good-secrets.env", [
  "export TCR_ID=tcr-user",
  "export TCR_SECRET=tcr-password",
]);

const badEnv = writeEnv("bad.env", [
  "NAMESPACE=portal-v20-32-staging",
  "PORTAL_HOST=portal.example.com",
  "OPL_HOST=opl.example.com",
  "BUILD_SHA=opl-v20.33",
  "PRODUCT_RUNTIME_MODE=user_owned",
  "PORTAL_IMAGE=ccr.ccs.tencentyun.com/your-namespace/portal:latest",
  "OPL_WEB_IMAGE=uswccr.ccs.tencentyun.com/gaofenglab/opl-web-opl:opl-v1",
  "RESOURCE_PROVISIONER_IMAGE=old",
  "RUNNER_ORCHESTRATOR_IMAGE=old",
  "OPENCOST_BASE_URL=http://opencost",
  "MINIO_API_URL=http://minio",
  "HARBOR_URL=http://harbor",
]);

const badCloudAliasEnv = writeEnv("bad-cloud-alias.env", [
  ...goodEnvLines.map((line) => (
    line === "PRODUCT_RUNTIME_MODE=platform_provisioned"
      ? "PRODUCT_RUNTIME_MODE=cloud_provisioned"
      : line
  )),
]);

try {
  const missing = spawnSync(process.execPath, ["scripts/check-v21-deploy-env.mjs", "--deploy-env-file", path.join(root, "missing.env"), "--json"], {
    cwd: path.resolve("."),
    encoding: "utf8",
  });
  assert.notEqual(missing.status, 0, "missing_env_file_must_fail");
  assert.match(missing.stdout, /env_file_missing/, "missing_env_failure_must_be_machine_readable");

  const bad = runCheck(badEnv);
  assert.notEqual(bad.result.status, 0, "old_stack_env_must_fail");
  assert.equal(bad.payload.ok, false, "bad_env_payload_must_not_be_ok");
  assert(bad.payload.violations.some((item) => item.code === "runtime_mode_not_platform_provisioned" && item.key === "PRODUCT_RUNTIME_MODE"), "must_reject_user_owned_runtime_mode");
  assert(bad.payload.violations.some((item) => item.code === "retired_key_present" && item.key === "RESOURCE_PROVISIONER_IMAGE"), "must_reject_resource_provisioner_env");
  assert(bad.payload.violations.some((item) => item.code === "image_tag_not_v21" && item.key === "OPL_WEB_IMAGE"), "must_reject_non_v21_opl_web_image");
  assert(bad.payload.violations.some((item) => item.code === "placeholder_value" && item.key === "PORTAL_HOST"), "must_reject_example_host");

  const badCloudAlias = runCheck(badCloudAliasEnv, goodSecrets);
  assert.notEqual(badCloudAlias.result.status, 0, "cloud_provisioned_runtime_alias_must_fail");
  assert.equal(badCloudAlias.payload.ok, false, "cloud_alias_env_payload_must_not_be_ok");
  assert(badCloudAlias.payload.violations.some((item) => item.code === "runtime_mode_not_platform_provisioned" && item.key === "PRODUCT_RUNTIME_MODE"), "must_reject_cloud_provisioned_runtime_mode");

  const good = runCheck(goodEnv, goodSecrets);
  assert.equal(good.result.status, 0, `good_v21_env_must_pass:${good.result.stdout}:${good.result.stderr}`);
  assert.equal(good.payload.ok, true, "good_env_payload_must_be_ok");
  assert.equal(good.payload.imageKeys.length, 6, "v21_default_image_surface_must_include_cloud_provisioner_control_plane_image");
  assert.equal(good.payload.tcrPasswordAvailable, true, "tcr_secret_must_satisfy_push_password_gate_without_printing_value");
  assert(good.payload.requiredKeys.includes("V21_CLOUD_PROVISIONER_URL"), "cloud_provisioner_url_must_be_required");
  assert(good.payload.requiredKeys.includes("CLOUD_PROVISIONER_IMAGE_TAG"), "cloud_provisioner_tag_must_be_required");
  assert(good.payload.requiredKeys.includes("PORTAL_TLS_SECRET_NAME"), "portal_tls_secret_must_be_required");
  assert(good.payload.requiredKeys.includes("OPL_TLS_SECRET_NAME"), "opl_tls_secret_must_be_required");
  assert(good.payload.requiredKeys.includes("PORTAL_QCLOUD_CERT_ID"), "portal_qcloud_cert_id_must_be_required");
  assert(good.payload.requiredKeys.includes("OPL_QCLOUD_CERT_ID"), "opl_qcloud_cert_id_must_be_required");

  const source = execFileSync("node", ["-e", "process.stdout.write(require('fs').readFileSync('scripts/check-v21-deploy-env.mjs','utf8'))"], {
    cwd: path.resolve("."),
    encoding: "utf8",
  });
  assert.doesNotMatch(source, /TCR_SECRET\\s*[:+]/, "deploy_env_check_must_not_print_tcr_secret_values");

  console.log(JSON.stringify({
    ok: true,
    contract: "v21_deploy_env_contract",
  }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
