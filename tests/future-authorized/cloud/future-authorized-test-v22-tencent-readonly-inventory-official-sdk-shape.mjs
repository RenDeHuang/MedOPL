import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(".");
const rootPackagePath = path.join(repoRoot, "package.json");
const rootLockPath = path.join(repoRoot, "package-lock.json");
const portalRoot = path.join(repoRoot, "services", "portal");
const portalPackagePath = path.join(portalRoot, "package.json");
const portalLockPath = path.join(portalRoot, "package-lock.json");
const tencentSdkPackageName = "tencentcloud-sdk-nodejs";
const cosSdkPackageName = "cos-nodejs-sdk-v5";
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

function hasClientMethod(root, service, version, methodName) {
  const Client = root?.[service]?.[version]?.Client;
  return typeof Client?.prototype?.[methodName] === "function";
}

function hasFunction(value, methodName) {
  return typeof value?.prototype?.[methodName] === "function";
}

const rootPackage = JSON.parse(await readFile(rootPackagePath, "utf8"));
const rootLock = JSON.parse(await readFile(rootLockPath, "utf8"));
const portalPackage = JSON.parse(await readFile(portalPackagePath, "utf8"));
const portalLock = JSON.parse(await readFile(portalLockPath, "utf8"));
assert.equal(rootPackage.dependencies?.[tencentSdkPackageName], "^4.1.245", "root_cloud_tooling_must_own_tencentcloud_sdk_nodejs_dependency");
assert.equal(rootPackage.dependencies?.[cosSdkPackageName], "^2.15.4", "root_cloud_tooling_must_own_cos_nodejs_sdk_v5_dependency");
assert.equal(
  rootLock.packages?.[""]?.dependencies?.[tencentSdkPackageName],
  "^4.1.245",
  "root_lock_must_record_tencentcloud_sdk_nodejs_dependency",
);
assert.equal(
  rootLock.packages?.[""]?.dependencies?.[cosSdkPackageName],
  "^2.15.4",
  "root_lock_must_record_cos_nodejs_sdk_v5_dependency",
);
assert.equal(rootLock.packages?.[`node_modules/${tencentSdkPackageName}`]?.version, "4.1.245", "root_lock_must_pin_tencentcloud_sdk_nodejs_shape");
assert.equal(rootLock.packages?.[`node_modules/${cosSdkPackageName}`]?.version, "2.15.4", "root_lock_must_pin_cos_nodejs_sdk_v5_shape");
assert.equal(portalPackage.dependencies?.[tencentSdkPackageName], undefined, "portal_package_must_not_own_tencentcloud_sdk_nodejs");
assert.equal(portalPackage.devDependencies?.[tencentSdkPackageName], undefined, "portal_dev_package_must_not_own_tencentcloud_sdk_nodejs");
assert.equal(portalPackage.dependencies?.[cosSdkPackageName], undefined, "portal_package_must_not_own_cos_nodejs_sdk_v5");
assert.equal(portalPackage.devDependencies?.[cosSdkPackageName], undefined, "portal_dev_package_must_not_own_cos_nodejs_sdk_v5");
assert.equal(portalLock.packages?.[""]?.dependencies?.[tencentSdkPackageName], undefined, "portal_lock_must_not_own_tencentcloud_sdk_nodejs_dependency");
assert.equal(portalLock.packages?.[""]?.dependencies?.[cosSdkPackageName], undefined, "portal_lock_must_not_own_cos_nodejs_sdk_v5_dependency");

let tencentSdkRoot;
let cosSdkRoot;
let tencentInstalled = false;
let cosInstalled = false;
let tencentPackageVersion = rootLock.packages[`node_modules/${tencentSdkPackageName}`]?.version || "";
let cosPackageVersion = rootLock.packages[`node_modules/${cosSdkPackageName}`]?.version || "";
try {
  const requireFromRoot = createRequire(rootPackagePath);
  tencentSdkRoot = moduleRoot(requireFromRoot(tencentSdkPackageName));
  tencentInstalled = true;
  const installedTencentPackage = requireFromRoot(`${tencentSdkPackageName}/package.json`);
  tencentPackageVersion = installedTencentPackage.version || tencentPackageVersion;

  cosSdkRoot = moduleRoot(requireFromRoot(cosSdkPackageName));
  cosInstalled = true;
  const installedCosPackage = requireFromRoot(`${cosSdkPackageName}/package.json`);
  cosPackageVersion = installedCosPackage.version || cosPackageVersion;
} catch (error) {
  if (error?.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

if (tencentInstalled) {
  assert.equal(hasClient(tencentSdkRoot, "sts", "v20180813"), true, "sdk_shape_must_include_sts_v20180813_client");
  assert.equal(hasClient(tencentSdkRoot, "cvm", "v20170312"), true, "sdk_shape_must_include_cvm_v20170312_client");
  assert.equal(hasClient(tencentSdkRoot, "tke", "v20180525"), true, "sdk_shape_must_include_tke_v20180525_client");
  assert.equal(hasClient(tencentSdkRoot, "billing", "v20180709"), true, "sdk_shape_must_include_billing_v20180709_client");
  assert.equal(hasClient(tencentSdkRoot, "tag", "v20180813"), true, "sdk_shape_must_include_tag_v20180813_client");
  assert.equal(
    hasClientMethod(tencentSdkRoot, "tag", "v20180813", "GetResources"),
    true,
    "sdk_shape_must_include_tag_v20180813_get_resources",
  );
  assert.equal(
    hasClientMethod(tencentSdkRoot, "tag", "v20180813", "DescribeTagResources"),
    false,
    "sdk_shape_must_not_include_tag_v20180813_describe_tag_resources",
  );
  assert.equal(hasClient(tencentSdkRoot, "cos", "v20180530"), false, "sdk_shape_must_record_cos_v20180530_absent_from_tencentcloud_sdk_nodejs");
}

if (cosInstalled) {
  assert.equal(typeof cosSdkRoot, "function", "cos_sdk_shape_must_export_constructor");
  assert.equal(hasFunction(cosSdkRoot, "getService"), true, "cos_sdk_shape_must_include_get_service_for_bucket_list");
  assert.equal(hasFunction(cosSdkRoot, "headObject"), true, "cos_sdk_shape_must_include_head_object_for_metadata");
  assert.equal(hasFunction(cosSdkRoot, "getObject"), true, "cos_sdk_shape_records_get_object_exists_but_loader_must_not_call_it");
  assert.equal(hasFunction(cosSdkRoot, "putObject"), true, "cos_sdk_shape_records_put_object_exists_but_loader_must_not_call_it");
  assert.equal(hasFunction(cosSdkRoot, "deleteObject"), true, "cos_sdk_shape_records_delete_object_exists_but_loader_must_not_call_it");
}

const result = {
  ok: true,
  contract: "v22_tencent_readonly_inventory_official_sdk_shape_preflight",
  installed: {
    tencentcloudSdk: tencentInstalled,
    cosSdk: cosInstalled,
  },
  packages: {
    tencentcloudSdk: {
      packageName: tencentSdkPackageName,
      packageVersion: tencentPackageVersion,
    },
    cosSdk: {
      packageName: cosSdkPackageName,
      packageVersion: cosPackageVersion,
    },
  },
  checked: [
    "root_cloud_tooling_owns_tencentcloud_sdk_nodejs",
    "root_cloud_tooling_owns_cos_nodejs_sdk_v5",
    "portal_package_does_not_own_tencentcloud_sdk_nodejs",
    "portal_package_does_not_own_cos_nodejs_sdk_v5",
    "portal_lock_does_not_own_tencentcloud_sdk_nodejs",
    "portal_lock_does_not_own_cos_nodejs_sdk_v5",
    "root_lock_has_tencentcloud_sdk_shape",
    "root_lock_has_cos_sdk_shape",
    "does_not_read_secret_or_call_cloud",
    tencentInstalled ? "sts_cvm_tke_billing_tag_client_shape_present" : "tencent_sdk_package_not_installed_in_this_worktree",
    tencentInstalled ? "tag_v20180813_get_resources_present" : "tag_method_shape_deferred_until_local_dependency_install",
    tencentInstalled ? "tag_v20180813_describe_tag_resources_absent" : "tag_method_absence_deferred_until_local_dependency_install",
    tencentInstalled ? "cos_v20180530_client_absent_from_tencentcloud_sdk_nodejs" : "tencent_shape_import_deferred_until_local_dependency_install",
    cosInstalled ? "cos_sdk_get_service_and_head_object_shape_present" : "cos_sdk_package_not_installed_in_this_worktree",
    cosInstalled ? "cos_sdk_mutation_methods_exist_but_are_not_loader_contract_methods" : "cos_mutation_method_shape_deferred_until_local_dependency_install",
  ],
  cosBoundary: "cos.v20180530.Client is not provided by tencentcloud-sdk-nodejs; COS readonly support must use cos-nodejs-sdk-v5 through metadata-only loader methods.",
};

assertNotContainsForbidden(result, "shape_preflight_result");
console.log(JSON.stringify(result, null, 2));
