import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(".");
const portalRoot = path.join(repoRoot, "services", "portal");
const portalPackagePath = path.join(portalRoot, "package.json");
const portalLockPath = path.join(portalRoot, "package-lock.json");
const sdkPackageName = "tencentcloud-sdk-nodejs";
const liveSecretPathProof = ["/home/dev", ".secrets", "medopl", "tencent-readonly-inventory.env"].join("/");

function assertNotContainsForbidden(value, label) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const forbidden = [
    "SecretId",
    "SecretKey",
    "token",
    "kubeconfig",
    "authorization",
    "headers",
    "raw response",
    "rawResponse",
    "rawEndpoint",
    "objectKey",
    "storageKey",
    "cosPrefix",
    "signedUrl",
    liveSecretPathProof,
  ];
  for (const phrase of forbidden) {
    assert.equal(serialized.includes(phrase), false, `${label}_must_not_contain:${phrase}`);
  }
}

function moduleRoot(value = {}) {
  return value?.default && typeof value.default === "object" ? value.default : value;
}

function hasClient(root, service, version) {
  return typeof root?.[service]?.[version]?.Client === "function";
}

const portalPackage = JSON.parse(await readFile(portalPackagePath, "utf8"));
const lock = JSON.parse(await readFile(portalLockPath, "utf8"));
assert(portalPackage.dependencies?.[sdkPackageName], "portal_package_must_declare_tencentcloud_sdk_nodejs");
assert(lock.packages?.[`node_modules/${sdkPackageName}`], "portal_lock_must_pin_tencentcloud_sdk_nodejs");
assert.equal(portalPackage.dependencies?.["cos-nodejs-sdk-v5"], undefined, "portal_package_must_not_add_cos_nodejs_sdk_v5_in_this_branch");
assert.equal(lock.packages?.["node_modules/cos-nodejs-sdk-v5"], undefined, "portal_lock_must_not_add_cos_nodejs_sdk_v5_in_this_branch");

let sdkRoot;
let installed = false;
let packageVersion = lock.packages[`node_modules/${sdkPackageName}`]?.version || "";
try {
  const requireFromPortal = createRequire(path.join(portalRoot, "package.json"));
  sdkRoot = moduleRoot(requireFromPortal(sdkPackageName));
  installed = true;
  const installedPackage = requireFromPortal(`${sdkPackageName}/package.json`);
  packageVersion = installedPackage.version || packageVersion;
} catch (error) {
  if (error?.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

if (installed) {
  assert.equal(hasClient(sdkRoot, "sts", "v20180813"), true, "sdk_shape_must_include_sts_v20180813_client");
  assert.equal(hasClient(sdkRoot, "cvm", "v20170312"), true, "sdk_shape_must_include_cvm_v20170312_client");
  assert.equal(hasClient(sdkRoot, "tke", "v20180525"), true, "sdk_shape_must_include_tke_v20180525_client");
  assert.equal(hasClient(sdkRoot, "billing", "v20180709"), true, "sdk_shape_must_include_billing_v20180709_client");
  assert.equal(hasClient(sdkRoot, "tag", "v20180813"), true, "sdk_shape_must_include_tag_v20180813_client");
  assert.equal(hasClient(sdkRoot, "cos", "v20180530"), false, "sdk_shape_must_record_cos_v20180530_absent_from_tencentcloud_sdk_nodejs");
}

const result = {
  ok: true,
  contract: "v22_tencent_readonly_inventory_official_sdk_shape_preflight",
  installed,
  packageName: sdkPackageName,
  packageVersion,
  checked: [
    "package_json_declares_tencentcloud_sdk_nodejs",
    "package_lock_pins_tencentcloud_sdk_nodejs",
    "no_cos_nodejs_sdk_v5_added",
    "does_not_read_secret_or_call_cloud",
    installed ? "sts_cvm_tke_billing_tag_client_shape_present" : "sdk_package_not_installed_in_this_worktree",
    installed ? "cos_v20180530_client_absent_from_tencentcloud_sdk_nodejs" : "shape_import_deferred_until_local_dependency_install",
  ],
  cosBoundary: "cos.v20180530.Client is not provided by tencentcloud-sdk-nodejs; COS readonly support requires a separate cos-nodejs-sdk-v5 contract or dedicated implementation path.",
};

assertNotContainsForbidden(result, "shape_preflight_result");
console.log(JSON.stringify(result, null, 2));
