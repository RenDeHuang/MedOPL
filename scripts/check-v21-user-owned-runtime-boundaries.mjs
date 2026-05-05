import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const REQUIRED_FILES = {
  portalConfig: "services/portal/src/config/portal-config.mjs",
  composeProduct: "compose.product.yaml",
  platformWorkloads: "deploy/tke-package/manifests/05-platform-workloads.yaml",
};

const FORBIDDEN_PORTAL_DEFAULTS = [
  { key: "RANCHER_URL", literal: "https://127.0.0.1:30443" },
  { key: "OPENCOST_UI_URL", literal: "http://127.0.0.1:30090" },
  { key: "HARBOR_URL", literal: "http://127.0.0.1:30095" },
  { key: "MINIO_API_URL", literal: "http://127.0.0.1:30091" },
];

function normalize(filePath) {
  return path.resolve(repoRoot, filePath);
}

async function readRequiredFile(filePath) {
  try {
    return await readFile(normalize(filePath), "utf8");
  } catch (error) {
    throw new Error(`required_file_missing_or_unreadable:${filePath}:${error instanceof Error ? error.message : String(error)}`);
  }
}

function findLine(content, pattern) {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return null;
}

function checkPortalConfigDefaults(content, violations) {
  for (const item of FORBIDDEN_PORTAL_DEFAULTS) {
    const escaped = item.literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`export const\\s+${item.key}\\s*=\\s*process\\.env\\.${item.key}\\s*\\|\\|\\s*["']${escaped}["']`);
    if (regex.test(content)) {
      violations.push({
        rule: "portal_config_forbidden_default",
        file: REQUIRED_FILES.portalConfig,
        key: item.key,
        defaultValue: item.literal,
        line: findLine(content, new RegExp(`export const\\s+${item.key}\\s*=`)),
        message: `${item.key} still has a non-empty hardcoded default value`,
      });
    }
  }
}

function checkComposeProductDependsOn(content, violations) {
  let compose;
  try {
    compose = JSON.parse(content);
  } catch (error) {
    throw new Error(`compose_product_parse_error:${REQUIRED_FILES.composeProduct}:${error instanceof Error ? error.message : String(error)}`);
  }
  const portal = compose?.services?.portal;
  if (!portal || typeof portal !== "object") {
    throw new Error(`compose_product_invalid_structure:${REQUIRED_FILES.composeProduct}:services.portal_missing`);
  }
  const profiles = Array.isArray(portal.profiles) ? portal.profiles : [];
  if (!profiles.includes("product")) {
    return;
  }
  const dependsOn = portal.depends_on;
  if (!dependsOn || typeof dependsOn !== "object" || Array.isArray(dependsOn)) {
    throw new Error(`compose_product_invalid_structure:${REQUIRED_FILES.composeProduct}:services.portal.depends_on_missing_or_invalid`);
  }
  const forbidden = ["resource-provisioner", "med-autoscience-runner"];
  for (const svc of forbidden) {
    if (Object.prototype.hasOwnProperty.call(dependsOn, svc)) {
      violations.push({
        rule: "compose_product_portal_forbidden_depends_on",
        file: REQUIRED_FILES.composeProduct,
        service: "portal",
        profile: "product",
        dependsOn: svc,
        message: `portal in product profile still depends_on ${svc}`,
      });
    }
  }
}

function checkPlatformWorkloadDefaultInclusion(content, violations) {
  const docs = content.split(/\n---\n/g);
  const targets = ["resource-provisioner", "med-autoscience-runner"];
  for (const target of targets) {
    for (const doc of docs) {
      if (!new RegExp(`\\n\\s*name:\\s*${target}\\s*\\n`).test(`\n${doc}\n`)) continue;
      const metadataBlock = doc.split(/\n\s*spec\s*:\s*\n/, 1)[0] || doc;
      const hasProfileMark = /gaofenglab\.cn\/profile\s*:\s*["']?(ops|managed-runtime|optional)["']?/i.test(metadataBlock)
        || /medopl\.cn\/profile\s*:\s*["']?(ops|managed-runtime|optional)["']?/i.test(metadataBlock);
      const hasOptionalMark = /gaofenglab\.cn\/optional\s*:\s*["']?true["']?/i.test(metadataBlock)
        || /medopl\.cn\/optional\s*:\s*["']?true["']?/i.test(metadataBlock);
      if (!hasProfileMark && !hasOptionalMark) {
        violations.push({
          rule: "platform_workloads_default_includes_forbidden_runtime_dependency",
          file: REQUIRED_FILES.platformWorkloads,
          resource: target,
          message: `${target} is included by default without profile/optional marker`,
        });
      }
      break;
    }
  }
}

async function main() {
  const violations = [];
  const portalConfig = await readRequiredFile(REQUIRED_FILES.portalConfig);
  const composeProduct = await readRequiredFile(REQUIRED_FILES.composeProduct);
  const platformWorkloads = await readRequiredFile(REQUIRED_FILES.platformWorkloads);

  checkPortalConfigDefaults(portalConfig, violations);
  checkComposeProductDependsOn(composeProduct, violations);
  checkPlatformWorkloadDefaultInclusion(platformWorkloads, violations);

  const payload = {
    ok: violations.length === 0,
    status: violations.length === 0 ? "pass" : "fail",
    contract: "v21_user_owned_runtime_boundaries",
    checkedFiles: Object.values(REQUIRED_FILES),
    violations,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    status: "error",
    contract: "v21_user_owned_runtime_boundaries",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
