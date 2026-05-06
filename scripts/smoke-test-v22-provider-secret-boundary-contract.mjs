import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const {
  createGflabProviderConfig,
  redactProviderConfig,
} = await import("../services/portal/src/domain/provider-config.mjs");
const { createProviderSecretStore } = await import("../services/portal/src/domain/provider-secret-store.mjs");

const rawApiKey = "gflabtoken_secret_only_backend_boundary";
const created = createGflabProviderConfig({
  userId: "user-v22-provider",
  workspaceId: "workspace-v22-provider",
  apiKey: rawApiKey,
});

assert.equal(created.ok, true, "provider_config_must_be_created");
assert.equal(created.providerSecret.apiKey, rawApiKey, "backend_provider_secret_must_keep_raw_key");
assert.equal(Boolean(created.providerKeyRef), true, "provider_config_must_expose_provider_key_ref");

const publicConfig = redactProviderConfig({
  ...created.providerConfig,
  launchToken: "launch-token-must-not-leak",
  runtimeToken: "runtime-token-must-not-leak",
});
const publicSerialized = JSON.stringify(publicConfig);
assert.equal(publicConfig.providerBound, true, "redacted_provider_config_must_report_bound_status");
assert.equal(publicConfig.providerKeyRef, created.providerKeyRef, "redacted_provider_key_ref_mismatch");
assert.equal(publicSerialized.includes(rawApiKey), false, "redacted_provider_config_must_not_leak_raw_key");
assert.equal(/launchToken|runtimeToken|bearerToken/i.test(publicSerialized), false, "redacted_provider_config_must_not_expose_tokens");
assert.equal("providerSecret" in publicConfig, false, "redacted_provider_config_must_not_expose_provider_secret");

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-provider-secret-boundary-"));
try {
  const store = createProviderSecretStore({ secretsRoot: tempRoot });
  await store.writeProviderSecret(created.providerKeyRef, created.providerSecret);
  const backendSecret = await store.readProviderSecret(created.providerKeyRef);
  assert.equal(backendSecret.apiKey, rawApiKey, "backend_secret_store_must_read_raw_key_inside_backend_boundary");

  const backendSerialized = JSON.stringify(backendSecret);
  assert.equal(backendSerialized.includes(rawApiKey), true, "backend_secret_boundary_must_remain_backend_only");
  assert.equal(JSON.stringify(publicConfig).includes(rawApiKey), false, "public_config_must_stay_redacted_after_backend_secret_read");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_provider_secret_boundary",
  providerKeyRef: created.providerKeyRef,
}, null, 2));
