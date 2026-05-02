import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const dockerfile = readFileSync("adapters/billing-aggregator/Dockerfile", "utf8");
const packageJson = JSON.parse(readFileSync("adapters/billing-aggregator/package.json", "utf8"));
const serverSource = readFileSync("adapters/billing-aggregator/src/server.mjs", "utf8");

assert(packageJson.dependencies?.pg, "billing aggregator package.json must declare pg");
assert.match(serverSource, /BILLING_REPO_ROOT/, "billing server must allow explicit runtime repo root in container");
assert.match(dockerfile, /BILLING_REPO_ROOT=\/app/, "billing image must set BILLING_REPO_ROOT=/app");
assert(
  /COPY\s+package\*\.json\s+\.\//.test(dockerfile) || /COPY\s+package\.json\s+package-lock\.json\s+\.\//.test(dockerfile),
  "billing aggregator Dockerfile must copy package-lock.json with package.json",
);
assert(
  /RUN\s+npm\s+ci(?:\s|$)/.test(dockerfile) && /--omit=dev/.test(dockerfile),
  "billing aggregator Dockerfile must install production dependencies with npm ci --omit=dev",
);

const installIndex = dockerfile.indexOf("npm ci");
const copySrcIndex = dockerfile.indexOf("COPY src");
assert(installIndex >= 0 && copySrcIndex >= 0 && installIndex < copySrcIndex, "billing aggregator Dockerfile must install dependencies before copying src");

console.log("billing aggregator Dockerfile dependency smoke passed");
