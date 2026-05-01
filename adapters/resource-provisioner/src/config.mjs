import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const runtimeRoot = path.join(repoRoot, ".runtime", "resource-provisioner");
export const ordersFile = path.join(runtimeRoot, "orders.json");

export const PORT = Number(process.env.RESOURCE_PROVISIONER_PORT || process.env.PORT || 18893);
export const BUILD_SHA = String(process.env.BUILD_SHA || "dev").trim() || "dev";
export const BUILD_TIME = String(process.env.BUILD_TIME || "unknown").trim() || "unknown";

export const PROVISIONING_ENABLED = String(process.env.RESOURCE_PROVISIONING_ENABLED || "0") === "1";
export const TENCENT_CLOUD_SECRET_ID = String(process.env.TENCENT_CLOUD_SECRET_ID || process.env.TENCENTCLOUD_SECRET_ID || "").trim();
export const TENCENT_CLOUD_SECRET_KEY = String(process.env.TENCENT_CLOUD_SECRET_KEY || process.env.TENCENTCLOUD_SECRET_KEY || "").trim();
export const TENCENT_CLOUD_TOKEN = String(process.env.TENCENT_CLOUD_TOKEN || "").trim();
export const TENCENT_CLOUD_REGION = String(process.env.TENCENT_CLOUD_REGION || "na-siliconvalley").trim();
export const TENCENT_TKE_ENDPOINT = String(process.env.TENCENT_TKE_ENDPOINT || "tke.intl.tencentcloudapi.com").trim();
export const TENCENT_TKE_VERSION = String(process.env.TENCENT_TKE_VERSION || "2018-05-25").trim();
export const TENCENT_CVM_ENDPOINT = String(process.env.TENCENT_CVM_ENDPOINT || "cvm.tencentcloudapi.com").trim();
export const TENCENT_CVM_VERSION = String(process.env.TENCENT_CVM_VERSION || "2017-03-12").trim();

export const TENCENT_TKE_CLUSTER_ID = String(process.env.TENCENT_TKE_CLUSTER_ID || "cls-ngiq693i").trim();
export const TENCENT_TKE_ZONE = String(process.env.TENCENT_TKE_ZONE || "na-siliconvalley-1").trim();
export const TENCENT_VPC_ID = String(process.env.TENCENT_VPC_ID || "vpc-ahl6epyx").trim();
export const TENCENT_SUBNET_IDS = String(process.env.TENCENT_SUBNET_IDS || "subnet-mbehh5wi,subnet-r8mzuptu")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
export const TENCENT_SECURITY_GROUP_ID = String(process.env.TENCENT_SECURITY_GROUP_ID || "sg-6671l5we").trim();
export const TENCENT_DEFAULT_NODE_IMAGE_ID = "img-487zeit5";
export const TENCENT_TKE_NODE_IMAGE_ID = String(process.env.TENCENT_TKE_NODE_IMAGE_ID || process.env.TENCENT_PRICE_IMAGE_ID || TENCENT_DEFAULT_NODE_IMAGE_ID).trim();
export const TENCENT_TKE_NODE_IMAGE_SOURCE = process.env.TENCENT_TKE_NODE_IMAGE_ID
  ? "env:TENCENT_TKE_NODE_IMAGE_ID"
  : (process.env.TENCENT_PRICE_IMAGE_ID ? "env:TENCENT_PRICE_IMAGE_ID" : "siliconvalley_ubuntu_22_04_fallback");
export const TENCENT_TKE_MAX_NODES = Math.max(1, Number(process.env.TENCENT_TKE_MAX_NODES || 2));
export const TENCENT_TKE_MIN_NODES = Math.max(0, Number(process.env.TENCENT_TKE_MIN_NODES || 0));
export const TENCENT_TKE_SYSTEM_DISK_TYPE = String(process.env.TENCENT_TKE_SYSTEM_DISK_TYPE || "CLOUD_BSSD").trim();
export const TENCENT_TKE_SYSTEM_DISK_SIZE = Math.max(50, Number(process.env.TENCENT_TKE_SYSTEM_DISK_SIZE || 50));

export const COST_TAG_KEYS = ["resource_order_id", "run_id", "server_plan_id", "tenant_id", "workspace_id"];

export function tencentCloudConfigured() {
  return Boolean(TENCENT_CLOUD_SECRET_ID && TENCENT_CLOUD_SECRET_KEY);
}
