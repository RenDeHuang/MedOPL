import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(repoRoot, "adapters", "billing-aggregator", "src", "server.mjs");
const configPath = path.join(repoRoot, "adapters", "billing-aggregator", "src", "billing-config.mjs");
const webEntryPath = path.join(repoRoot, "adapters", "billing-aggregator", "src", "billing-web-entry.mjs");

assert.equal(existsSync(serverPath), true, "missing server.mjs");
assert.equal(existsSync(configPath), true, "missing billing-config.mjs");
assert.equal(existsSync(webEntryPath), true, "missing billing-web-entry.mjs");

const serverSource = readFileSync(serverPath, "utf8");
const configSource = readFileSync(configPath, "utf8");
const webEntrySource = readFileSync(webEntryPath, "utf8");

assert.match(serverSource, /from\s+["']\.\/billing-config\.mjs["']/, "server.mjs must import billing-config.mjs");
assert.match(serverSource, /from\s+["']\.\/billing-web-entry\.mjs["']/, "server.mjs must import billing-web-entry.mjs");
assert.match(serverSource, /\breadBillingRuntimeConfig\s*\(/, "server.mjs must read runtime config from billing-config.mjs");
assert.match(serverSource, /\bcreateBillingWebServer\s*\(/, "server.mjs must create web server via billing-web-entry.mjs");

assert.equal(serverSource.includes("function parseCli("), false, "server.mjs must not inline CLI parsing");
assert.equal(serverSource.includes("function renderHtml("), false, "server.mjs must not inline billing web page rendering");
assert.equal(serverSource.includes("http.createServer(async (req, res) =>"), false, "server.mjs must not inline web server entry");
assert.equal(serverSource.includes("process.env."), false, "server.mjs must not read process.env directly");

assert.match(configSource, /export\s+function\s+readBillingRuntimeConfig\s*\(/, "billing-config.mjs must export readBillingRuntimeConfig");
assert.match(configSource, /export\s+function\s+parseBillingCli\s*\(/, "billing-config.mjs must export parseBillingCli");
assert.match(configSource, /SERVER_PLAN_CATALOG_JSON/, "billing-config.mjs must own default catalog config");

assert.match(webEntrySource, /export\s+function\s+createBillingWebServer\s*\(/, "billing-web-entry.mjs must export createBillingWebServer");
assert.match(webEntrySource, /renderBillingHtml/, "billing-web-entry.mjs must own billing page rendering");
assert.match(webEntrySource, /http\.createServer/, "billing-web-entry.mjs must own HTTP server construction");

console.log(JSON.stringify({ ok: true, contract: "billing_server_entry_structure" }, null, 2));
