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

function normalizeProviderSecret(input = {}) {
  return {
    provider: String(input.provider || "").trim(),
    source: String(input.source || "").trim(),
    apiKey: String(input.apiKey || "").trim(),
  };
}

function assertProviderSecret(ref, secret) {
  if (!ref) throw new Error("provider_secret_ref_required");
  if (secret.provider !== "gflabtoken") throw new Error("provider_secret_provider_invalid");
  if (secret.source !== "user_input") throw new Error("provider_secret_source_invalid");
  if (!secret.apiKey) throw new Error("provider_secret_api_key_required");
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

export async function writeProviderSecret(ref = "", input = {}) {
  const normalizedRef = normalizeSecretRef(ref);
  const secret = normalizeProviderSecret(input);
  assertProviderSecret(normalizedRef, secret);
  await mkdir(providerSecretRoot, { recursive: true, mode: 0o700 });
  await writeFile(secretFilePath(normalizedRef), `${JSON.stringify({
    version: "v1",
    provider: secret.provider,
    source: secret.source,
    apiKey: secret.apiKey,
    createdAt: new Date().toISOString(),
  })}\n`, { mode: 0o600 });
  return { ref: normalizedRef };
}

export async function readProviderSecret(ref = "") {
  const normalizedRef = normalizeSecretRef(ref);
  if (!normalizedRef) return null;
  const payload = JSON.parse(await readFile(secretFilePath(normalizedRef), "utf8"));
  const secret = normalizeProviderSecret(payload);
  assertProviderSecret(normalizedRef, secret);
  const codexHome = await writeCodexProviderConfig(normalizedRef, { apiKey: secret.apiKey });
  return { ...secret, codexHome };
}
