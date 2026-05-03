import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

function normalizeSecretRef(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

export function createProviderSecretStore({ root = "", secretsRoot = "" }) {
  const resolvedSecretsRoot = secretsRoot || path.join(root, "provider-secrets");

  function filePathFor(ref) {
    return path.join(resolvedSecretsRoot, `${normalizeSecretRef(ref)}.json`);
  }

  return {
    async writeProviderSecret(ref, input = {}) {
      const normalizedRef = normalizeSecretRef(ref);
      const secret = normalizeProviderSecret(input);
      assertProviderSecret(normalizedRef, secret);
      await mkdir(resolvedSecretsRoot, { recursive: true, mode: 0o700 });
      const payload = {
        version: "v1",
        provider: secret.provider,
        source: secret.source,
        apiKey: secret.apiKey,
        createdAt: new Date().toISOString(),
      };
      await writeFile(filePathFor(normalizedRef), `${JSON.stringify(payload)}\n`, { mode: 0o600 });
      return { ref: normalizedRef };
    },

    async readProviderSecret(ref) {
      const normalizedRef = normalizeSecretRef(ref);
      if (!normalizedRef) return null;
      const payload = JSON.parse(await readFile(filePathFor(normalizedRef), "utf8"));
      const secret = normalizeProviderSecret(payload);
      assertProviderSecret(normalizedRef, secret);
      return secret;
    },
  };
}
