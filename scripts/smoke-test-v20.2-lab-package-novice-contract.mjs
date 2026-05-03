import assert from "node:assert/strict";

const forbiddenUserCopy = /K8s|Kubernetes|CVM|TKE|COS|node pool|对象存储开通/i;

const {
  listLabPackages,
  packagePublicView,
} = await import("../services/portal/src/domain/lab-packages.mjs");
const {
  activateLabSubscription,
} = await import("../services/portal/src/domain/lab-subscriptions.mjs");
const {
  resolveLabEntitlement,
} = await import("../services/portal/src/domain/lab-entitlements.mjs");

const packages = listLabPackages().map(packagePublicView);
const starter = packages.find((item) => item.packageId === "starter" || item.id === "starter");

assert.ok(starter, "starter_package_missing");
assert.equal(starter.name, "入门套餐");
assert.equal(starter.headline, "适合小型文件分析和轻量任务");
assert.equal(starter.includedStorageGb, 10);
assert.equal(starter.weeklyFreezeAmountCents, 8400);
assert.ok(starter.plainIncluded.includes("10GB 套餐存储"));
assert.ok(starter.plainIncluded.includes("可上传文件"));
assert.ok(starter.plainIncluded.includes("可下载结果"));
assert.ok(starter.plainLimits.some((item) => item.includes("余额不足")));
assert.match(starter.overageCopy, /扩容|清理旧文件/);
assert.doesNotMatch(JSON.stringify(starter), forbiddenUserCopy);

const db = {
  wallets: [{ userId: "user-v202-novice", balance: 1000 }],
  ledger: [],
  labSubscriptions: [],
  labPackageEvents: [],
  labStorageAddons: [],
  labDailyCharges: [],
  workspaceFiles: [],
};
const user = { id: "user-v202-novice", tenantId: "tenant-v202-novice" };
const activated = activateLabSubscription(db, {
  user,
  workspaceId: "default",
  packageId: "starter",
  idempotencyKey: "v202-novice-activation",
  now: "2026-05-03T00:00:00.000Z",
});
assert.equal(activated.ok, true, `activation_failed:${activated.error}`);

const entitlement = resolveLabEntitlement(db, { user, workspaceId: "default" });
assert.equal(entitlement.packageId, "starter");
assert.equal(entitlement.packageName, "入门套餐");
assert.equal(entitlement.storage.includedGb, 10);
assert.equal(entitlement.storage.availableGb, 10);
assert.equal(entitlement.storage.retentionDays, 7);
assert.equal(entitlement.actions.canCreateWorkspace, true);
assert.equal(entitlement.actions.canUploadFile, true);
assert.equal(entitlement.actions.canStartPaidRun, true);
assert.equal(entitlement.actions.canDownloadExistingOutputs, true);
assert.match(entitlement.nextStepCopy, /上传文件|启动/);
assert.doesNotMatch(JSON.stringify(entitlement), forbiddenUserCopy);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.2_lab_package_novice",
  packageId: starter.packageId || starter.id,
  includedStorageGb: starter.includedStorageGb,
}, null, 2));
