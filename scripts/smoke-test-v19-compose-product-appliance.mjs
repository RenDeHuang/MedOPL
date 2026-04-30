import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function serviceEnvironment(service = {}) {
  const env = service.environment || {};
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env.map((entry) => {
        const [key, ...rest] = String(entry).split("=");
        return [key, rest.join("=")];
      }),
    );
  }
  return env;
}

function isBindMount(volume) {
  if (typeof volume === "string") {
    return volume.startsWith(".:") || volume.startsWith("./") || volume.startsWith("../");
  }
  if (!volume || typeof volume !== "object") return false;
  return volume.type === "bind";
}

function hasHealthcheck(service = {}) {
  return Boolean(service.healthcheck?.test);
}

function hasProfile(service = {}, name) {
  return Array.isArray(service.profiles) && service.profiles.includes(name);
}

async function fileExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

const composePath = path.resolve("compose.product.yaml");
const docsPath = path.resolve("docs", "deployment", "docker-product-appliance.md");
const compose = JSON.parse(await readFile(composePath, "utf8"));
const docs = await readFile(docsPath, "utf8");
const services = compose.services || {};

const requiredProductServices = [
  "portal",
  "opl-web-gateway",
  "opl-web",
  "portal-opl-adapter",
  "billing-aggregator",
  "resource-provisioner",
  "med-autoscience-runner",
  "postgres",
  "redis",
];

const requiredDevServices = [
  "portal-dev",
  "opl-web-gateway-dev",
  "portal-opl-adapter-dev",
  "billing-aggregator-dev",
  "resource-provisioner-dev",
  "med-autoscience-runner-dev",
];

for (const name of requiredProductServices) {
  assert(services[name], `missing_product_service:${name}`);
  assert(hasHealthcheck(services[name]), `missing_healthcheck:${name}`);
}

for (const name of requiredDevServices) {
  assert(services[name], `missing_dev_service:${name}`);
  assert(hasProfile(services[name], "dev"), `missing_dev_profile:${name}`);
  assert(hasHealthcheck(services[name]), `missing_healthcheck:${name}`);
}

assert(hasProfile(services.portal, "product"), "portal must be product profile scoped");
assert(hasProfile(services["opl-web-gateway"], "product"), "opl-web-gateway must be product profile scoped");
assert(hasProfile(services["portal-opl-adapter"], "product"), "portal-opl-adapter must be product profile scoped");
assert(hasProfile(services["billing-aggregator"], "product"), "billing-aggregator must be product profile scoped");
assert(hasProfile(services["resource-provisioner"], "product"), "resource-provisioner must be product profile scoped");
assert(hasProfile(services["med-autoscience-runner"], "product"), "med-autoscience-runner must be product profile scoped");
assert(hasProfile(services.postgres, "product") && hasProfile(services.postgres, "dev"), "postgres must serve both profiles");
assert(hasProfile(services.redis, "product") && hasProfile(services.redis, "dev"), "redis must serve both profiles");
assert(hasProfile(services["opl-web"], "product") && hasProfile(services["opl-web"], "dev"), "opl-web must serve both profiles");

const portalEnv = serviceEnvironment(services.portal);
assert(portalEnv.PORTAL_STORAGE_MODE === "postgres_redis", "portal storage mode must default to postgres_redis");
assert(String(portalEnv.PORTAL_POSTGRES_URL || "").includes("@postgres:5432/portal"), "portal postgres URL must target local postgres");
assert(String(portalEnv.PORTAL_REDIS_URL || "") === "redis://redis:6379", "portal redis URL must target local redis");

for (const name of requiredProductServices) {
  const service = services[name];
  assert(service.image, `product service must declare image:${name}`);
  assert(!service.volumes?.some(isBindMount), `product service cannot bind mount source:${name}`);
}

for (const name of requiredDevServices) {
  const service = services[name];
  assert(service.volumes?.some(isBindMount), `dev service must be source-mounted:${name}`);
}

const provisionerEnv = serviceEnvironment(services["resource-provisioner"]);
assert(provisionerEnv.RESOURCE_PROVISIONING_ENABLED === "0", "resource-provisioner must stay in mock fixture cloud mode");

const runnerEnv = serviceEnvironment(services["med-autoscience-runner"]);
assert(String(runnerEnv.K8S_NAMESPACE || "") === "mock-cloud-fixture", "runner namespace must explicitly mark mock cloud");

const billingEnv = serviceEnvironment(services["billing-aggregator"]);
assert(billingEnv.TENCENT_BILLING_ENABLED === "0", "billing must disable live Tencent billing in local compose");
assert(billingEnv.TENCENT_BILLING_REQUIRED === "0", "billing must not require exact Tencent billing in local compose");

assert(/mock or fixture cloud/i.test(docs), "deployment doc must explicitly describe mock or fixture cloud");
assert(/never creates a real TKE cluster/i.test(docs), "deployment doc must explicitly deny real TKE creation");
assert(/PORTAL_STORAGE_MODE=postgres_redis/.test(docs), "deployment doc must state postgres_redis default");

const dockerVersion = await run("docker", ["version", "--format", "{{.Server.Version}}"]);
const dockerAvailable = dockerVersion.code === 0;
const composeConfigChecks = [];

if (dockerAvailable) {
  const productConfig = await run("docker", ["compose", "-f", composePath, "--profile", "product", "config"]);
  assert(productConfig.code === 0, `docker_compose_product_config_failed:${productConfig.stderr || productConfig.stdout}`);
  composeConfigChecks.push("product");

  const devConfig = await run("docker", ["compose", "-f", composePath, "--profile", "dev", "config"]);
  assert(devConfig.code === 0, `docker_compose_dev_config_failed:${devConfig.stderr || devConfig.stdout}`);
  composeConfigChecks.push("dev");
}

for (const dockerfilePath of [
  path.resolve("deploy", "local", "dockerfiles", "portal.Dockerfile"),
  path.resolve("deploy", "local", "dockerfiles", "opl-runtime-bridge.Dockerfile"),
  path.resolve("deploy", "local", "dockerfiles", "opl-web-gateway.Dockerfile"),
  path.resolve("deploy", "local", "dockerfiles", "resource-provisioner.Dockerfile"),
  path.resolve("deploy", "local", "dockerfiles", "med-autoscience-runner.Dockerfile"),
]) {
  assert(await fileExists(dockerfilePath), `missing_dockerfile:${path.relative(process.cwd(), dockerfilePath)}`);
}

console.log(JSON.stringify({
  ok: true,
  compose: path.basename(composePath),
  productServices: requiredProductServices,
  devServices: requiredDevServices,
  dockerAvailable,
  composeConfigChecks,
  verified: [
    "product_service_set",
    "dev_service_set",
    "healthchecks",
    "postgres_redis_default",
    "product_image_contract",
    "dev_source_mount_contract",
    "mock_fixture_cloud_boundary",
    "deployment_doc_boundary"
  ]
}, null, 2));
