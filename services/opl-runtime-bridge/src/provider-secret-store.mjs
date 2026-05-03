import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { runtimeRoot } from "./state-store.mjs";

const providerSecretRoot = String(
  process.env.PORTAL_OPL_PROVIDER_SECRET_ROOT ||
  path.join(runtimeRoot, "provider-secrets"),
).trim();

function normalizeSecretRef(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function secretFilePath(ref) {
  return path.join(providerSecretRoot, `${normalizeSecretRef(ref)}.json`);
}

function codexHomeFor(ref) {
  return path.join(providerSecretRoot, "codex-home", normalizeSecretRef(ref));
}

function quoteTomlString(value) {
  return JSON.stringify(String(value || ""));
}

async function writeCodexProviderConfig(ref, secret) {
  const codexHome = codexHomeFor(ref);
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  const config = [
    'model_provider = "gflab"',
    'model = "gpt-5.5"',
    'model_reasoning_effort = "xhigh"',
    "",
    "[model_providers.gflab]",
    'name = "gflab"',
    'base_url = "https://gflabtoken.cn/v1"',
    `experimental_bearer_token = ${quoteTomlString(secret.apiKey)}`,
    "",
  ].join("\n");
  await writeFile(path.join(codexHome, "config.toml"), config, { mode: 0o600 });
  return codexHome;
}

export async function readProviderSecret(ref = "") {
  const normalizedRef = normalizeSecretRef(ref);
  if (!normalizedRef) return null;
  const payload = JSON.parse(await readFile(secretFilePath(normalizedRef), "utf8"));
  const provider = String(payload.provider || "").trim();
  const source = String(payload.source || "").trim();
  const apiKey = String(payload.apiKey || "").trim();
  if (provider !== "gflabtoken" || source !== "user_input" || !apiKey) {
    throw new Error("provider_secret_invalid");
  }
  const codexHome = await writeCodexProviderConfig(normalizedRef, { apiKey });
  return { provider, source, apiKey, codexHome };
}
