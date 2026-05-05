import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { listLabPackages, labPackageCatalogPublicView } = await import("../services/portal/src/domain/lab-packages.mjs");
const { activateLabSubscription, purchaseLabStorageAddon, upgradeLabSubscription } = await import("../services/portal/src/domain/lab-subscriptions.mjs");

const packages = listLabPackages();
const starter = packages.find((item) => item.id === "starter");
const pro = packages.find((item) => item.id === "pro");
const catalog = labPackageCatalogPublicView();

assert.equal(starter?.compute?.cores, 2, "starter_cpu_must_be_2c");
assert.equal(starter?.storage?.includedGb, 10, "starter_storage_must_be_10gb");
assert.equal(pro?.compute?.cores, 8, "pro_cpu_must_be_8c");
assert.equal(pro?.storage?.includedGb, 100, "pro_storage_must_be_100gb");
assert.equal(catalog.starter?.id, "starter", "catalog_must_expose_starter");
assert.equal(catalog.pro?.id, "pro", "catalog_must_expose_pro");
assert.ok(Array.isArray(catalog.customOptions?.storageAddonSizesGb), "catalog_must_expose_custom_options");

const db = {
  wallets: [{ userId: "user-v20.34", balance: 500 }],
  ledger: [],
  labSubscriptions: [],
  labPackageEvents: [],
  labStorageAddons: [],
  labDailyCharges: [],
  storageOrders: [],
  workspaceFiles: [],
};
const user = { id: "user-v20.34", tenantId: "tenant-v20.34" };

const subscribeResult = activateLabSubscription(db, { user, packageId: "starter", idempotencyKey: "v20.34-starter" });
assert.equal(subscribeResult.ok, true, "starter_subscription_must_be_activatable");

const upgradeResult = upgradeLabSubscription(db, {
  user,
  subscriptionId: subscribeResult.subscription.id,
  packageId: "pro",
  idempotencyKey: "v20.34-pro",
});
assert.equal(upgradeResult.ok, true, "pro_subscription_must_be_activatable");

const addonResult = purchaseLabStorageAddon(db, {
  user,
  subscriptionId: upgradeResult.subscription.id,
  storageGb: 100,
  idempotencyKey: "v20.34-storage-100gb",
});
assert.equal(addonResult.ok, true, "storage_100gb_addon_must_be_activatable");

const packagesView = await readFile("services/portal/frontend/src/views/packages/PackagesView.vue", "utf8");
const portalApi = await readFile("services/portal/frontend/src/api/portal.ts", "utf8");
const packageRoutes = await readFile("services/portal/src/routes/lab-package.routes.mjs", "utf8");

assert.match(packagesView, /入门套餐[\s\S]*进阶套餐[\s\S]*自定义/, "packages_view_must_show_three_columns");
assert.doesNotMatch(packagesView, /推荐套餐|开通推荐套餐|CPU 2C4G \+ 10GB 存储 \+ OPL 实验室/, "packages_view_must_not_use_old_recommended_copy");
assert.match(packagesView, /处理中\.\.\.|已成功|失败|未订阅时不能扩容，请先开通套餐。/, "packages_view_must_have_cn_feedback");
assert.match(packagesView, /packageCatalog\.value|packagesPayload\.catalog/, "packages_view_must_read_catalog");
assert.match(portalApi, /businessMessage/, "portal_api_must_support_business_message");
assert.match(portalApi, /normalizePortalBusinessError/, "portal_api_must_normalize_business_errors");
assert.match(packageRoutes, /catalog: labPackageCatalogPublicView\(\)/, "route_must_expose_package_catalog");
assert.match(packageRoutes, /businessMessage: result\.businessMessage/, "route_must_return_business_message");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.34_lab_package_commercial_contract",
  packageIds: packages.map((item) => item.id),
}, null, 2));
