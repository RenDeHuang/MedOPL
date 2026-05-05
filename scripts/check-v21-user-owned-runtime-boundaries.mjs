import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const REQUIRED_FILES = {
  portalConfig: "services/portal/src/config/portal-config.mjs",
  composeProduct: "compose.product.yaml",
  platformConfig: "deploy/tke-package/manifests/01-platform-config.yaml",
  runnerRbac: "deploy/tke-package/manifests/04-runner-rbac.yaml",
  platformWorkloads: "deploy/tke-package/manifests/05-platform-workloads.yaml",
  buildAndPushTcr: "deploy/tke-package/scripts/build-and-push-tcr.mjs",
  adminRoutes: "services/portal/src/routes/admin-api.routes.mjs",
  portalApiRoutes: "services/portal/src/routes/portal-api.routes.mjs",
  frontendRouter: "services/portal/frontend/src/router/index.ts",
};

const FORBIDDEN_PORTAL_DEFAULTS = [
  { key: "RANCHER_URL", literal: "https://127.0.0.1:30443" },
  { key: "OPENCOST_UI_URL", literal: "http://127.0.0.1:30090" },
  { key: "HARBOR_URL", literal: "http://127.0.0.1:30095" },
  { key: "MINIO_API_URL", literal: "http://127.0.0.1:30091" },
  { key: "RESOURCE_PROVISIONER_URL", literal: "http://127.0.0.1:18893" },
];

const FORBIDDEN_PRODUCT_SERVICES = [
  "resource-provisioner",
  "med-autoscience-runner",
];

const FORBIDDEN_PRODUCT_ENV = [
  { service: "portal", key: "RESOURCE_PROVISIONER_URL" },
  { service: "portal-opl-adapter", key: "MED_AUTOSCIENCE_RUNNER_URL" },
  { service: "portal-opl-adapter", key: "MED_AUTOSCIENCE_RUNNER_IMAGE" },
  { service: "portal-opl-adapter", key: "K8S_NAMESPACE" },
];

const FORBIDDEN_PLATFORM_CONFIG_VALUES = [
  { key: "MED_AUTOSCIENCE_RUNNER_URL", forbidden: /^http:\/\/med-autoscience-runner:18890$/ },
  { key: "RESOURCE_PROVISIONER_URL", forbidden: /^http:\/\/resource-provisioner:18893$/ },
  { key: "MED_AUTOSCIENCE_RUNNER_IMAGE", forbidden: /__MED_AUTOSCIENCE_RUNNER_IMAGE__/ },
  { key: "K8S_NAMESPACE", forbidden: /__NAMESPACE__/ },
];

const OPS_PROFILE_FILES = [
  "compose.product.yaml",
  "deploy/tke-package/manifests/01-platform-config.yaml",
  "deploy/tke-package/env/tke.env.example",
  "deploy/tke-package/env/tke.env.tcr-gaofenglab.example",
  "deploy/tke-package/scripts/build-and-push-tcr.mjs",
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

function parseComposeProduct(content) {
  try {
    const compose = JSON.parse(content);
    const services = compose?.services;
    if (!services || typeof services !== "object" || Array.isArray(services)) {
      throw new Error(`compose_product_invalid_structure:${REQUIRED_FILES.composeProduct}:services_missing_or_invalid`);
    }
    if (!services.portal || typeof services.portal !== "object") {
      throw new Error(`compose_product_invalid_structure:${REQUIRED_FILES.composeProduct}:services.portal_missing`);
    }
    return services;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("compose_product_invalid_structure:")) throw error;
    throw new Error(`compose_product_parse_error:${REQUIRED_FILES.composeProduct}:${message}`);
  }
}

function profilesFor(service) {
  return Array.isArray(service?.profiles) ? service.profiles : [];
}

function isProductService(service) {
  return profilesFor(service).includes("product");
}

function dependsOnFor(service) {
  return service?.depends_on && typeof service.depends_on === "object" && !Array.isArray(service.depends_on)
    ? service.depends_on
    : {};
}

function productServiceEntries(services) {
  return Object.entries(services).filter(([, service]) => service && typeof service === "object" && isProductService(service));
}

function checkComposeProductDependsOn(services, violations) {
  for (const [serviceName, service] of productServiceEntries(services)) {
    for (const forbiddenService of FORBIDDEN_PRODUCT_SERVICES) {
      if (!Object.prototype.hasOwnProperty.call(dependsOnFor(service), forbiddenService)) continue;
      violations.push({
        rule: "compose_product_forbidden_depends_on",
        file: REQUIRED_FILES.composeProduct,
        service: serviceName,
        profile: "product",
        dependsOn: forbiddenService,
        message: `${serviceName} in product profile still depends_on ${forbiddenService}`,
      });
    }
  }
}

function checkComposeProductServices(services, violations) {
  for (const serviceName of FORBIDDEN_PRODUCT_SERVICES) {
    if (!isProductService(services[serviceName])) continue;
    violations.push({
      rule: "compose_product_forbidden_service_profile",
      file: REQUIRED_FILES.composeProduct,
      service: serviceName,
      profile: "product",
      message: `${serviceName} still belongs to product profile`,
    });
  }
}

function checkComposeProductEnv(services, violations) {
  for (const item of FORBIDDEN_PRODUCT_ENV) {
    const service = services[item.service];
    if (!isProductService(service)) continue;
    const value = String(service?.environment?.[item.key] || "").trim();
    if (!value) continue;
    violations.push({
      rule: "compose_product_forbidden_managed_runtime_env",
      file: REQUIRED_FILES.composeProduct,
      service: item.service,
      key: item.key,
      value,
      message: `${item.service} product environment still configures ${item.key}`,
    });
  }
}

function configValue(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*:\\s*["']?([^"'\\n]*)["']?\\s*$`, "m"));
  return match ? String(match[1] || "").trim() : "";
}

function checkPlatformConfigDefaults(content, violations) {
  for (const item of FORBIDDEN_PLATFORM_CONFIG_VALUES) {
    const value = configValue(content, item.key);
    if (item.forbidden.test(value)) {
      violations.push({
        rule: "platform_config_forbidden_managed_runtime_default",
        file: REQUIRED_FILES.platformConfig,
        key: item.key,
        value,
        line: findLine(content, new RegExp(`^\\s*${item.key}\\s*:`)),
        message: `${item.key} still points default TKE product config at managed-runtime`,
      });
    }
  }
}

function checkProductOpsProfileWiring(fileContents, violations) {
  for (const file of OPS_PROFILE_FILES) {
    if (String(fileContents[file] || "").includes("PRODUCT_OPS_PROFILE")) continue;
    violations.push({
      rule: "product_ops_profile_not_wired",
      file,
      message: `${file} must explicitly carry PRODUCT_OPS_PROFILE so ops surface is not a dead branch`,
    });
  }
}

function checkOpsSurfaceGuards({ adminRoutes, portalApiRoutes, frontendRouter }, violations) {
  const checks = [
    {
      file: REQUIRED_FILES.adminRoutes,
      content: adminRoutes,
      patterns: [/opsSurfaceEnabled\(payload\)/, /ops_surface_disabled/],
      message: "admin ops/sandboxes APIs must be blocked unless ops surface is enabled",
    },
    {
      file: REQUIRED_FILES.portalApiRoutes,
      content: portalApiRoutes,
      patterns: [/opsSurfaceEnabled/, /ops_surface_disabled/, /\/portal\/api\/registry\/summary/],
      message: "registry APIs must be blocked unless ops surface is enabled",
    },
    {
      file: REQUIRED_FILES.frontendRouter,
      content: frontendRouter,
      patterns: [/requiresOpsSurface/, /opsSurfaceEnabled/],
      message: "frontend ops routes must require ops surface",
    },
  ];
  for (const check of checks) {
    if (check.patterns.every((pattern) => pattern.test(check.content))) continue;
    violations.push({
      rule: "ops_surface_guard_missing",
      file: check.file,
      message: check.message,
    });
  }
}

function checkRunnerRbacDefaultInclusion(content, violations) {
  if (/kind:\s*(ServiceAccount|ClusterRole|ClusterRoleBinding)[\s\S]*name:\s*med-autoscience-runner|name:\s*__RUNNER_RBAC_NAME__/.test(content)) {
    violations.push({
      rule: "runner_rbac_default_includes_managed_runtime",
      file: REQUIRED_FILES.runnerRbac,
      message: "default runner RBAC manifest still contains managed-runtime RBAC resources",
    });
  }
}

function checkPlatformWorkloadDefaultInclusion(content, violations) {
  const docs = content.split(/\n---\n/g);
  const targets = ["resource-provisioner", "med-autoscience-runner"];
  for (const target of targets) {
    for (const doc of docs) {
      if (!new RegExp(`\\n\\s*name:\\s*${target}\\s*\\n`).test(`\n${doc}\n`)) continue;
      violations.push({
        rule: "platform_workloads_default_includes_forbidden_runtime_dependency",
        file: REQUIRED_FILES.platformWorkloads,
        resource: target,
        message: `${target} is still included in default platform workloads; move it to optional/managed-runtime`,
      });
      break;
    }
  }
}

async function main() {
  const violations = [];
  const portalConfig = await readRequiredFile(REQUIRED_FILES.portalConfig);
  const composeProduct = await readRequiredFile(REQUIRED_FILES.composeProduct);
  const composeServices = parseComposeProduct(composeProduct);
  const platformConfig = await readRequiredFile(REQUIRED_FILES.platformConfig);
  const runnerRbac = await readRequiredFile(REQUIRED_FILES.runnerRbac);
  const platformWorkloads = await readRequiredFile(REQUIRED_FILES.platformWorkloads);
  const buildAndPushTcr = await readRequiredFile(REQUIRED_FILES.buildAndPushTcr);
  const adminRoutes = await readRequiredFile(REQUIRED_FILES.adminRoutes);
  const portalApiRoutes = await readRequiredFile(REQUIRED_FILES.portalApiRoutes);
  const frontendRouter = await readRequiredFile(REQUIRED_FILES.frontendRouter);

  checkPortalConfigDefaults(portalConfig, violations);
  checkComposeProductDependsOn(composeServices, violations);
  checkComposeProductServices(composeServices, violations);
  checkComposeProductEnv(composeServices, violations);
  checkPlatformConfigDefaults(platformConfig, violations);
  checkProductOpsProfileWiring({
    [REQUIRED_FILES.composeProduct]: composeProduct,
    [REQUIRED_FILES.platformConfig]: platformConfig,
    "deploy/tke-package/env/tke.env.example": await readRequiredFile("deploy/tke-package/env/tke.env.example"),
    "deploy/tke-package/env/tke.env.tcr-gaofenglab.example": await readRequiredFile("deploy/tke-package/env/tke.env.tcr-gaofenglab.example"),
    [REQUIRED_FILES.buildAndPushTcr]: buildAndPushTcr,
  }, violations);
  checkOpsSurfaceGuards({ adminRoutes, portalApiRoutes, frontendRouter }, violations);
  checkRunnerRbacDefaultInclusion(runnerRbac, violations);
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
