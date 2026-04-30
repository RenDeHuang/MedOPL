import { createHash, randomUUID } from "node:crypto";

export const GFLAB_PROVIDER_CONFIG = Object.freeze({
  providerName: "gflab",
  providerBaseUrl: "https://gflabtoken.cn/",
  wireApi: "responses",
  modelProvider: "gflab",
  model: "gpt-5.5",
  modelReasoningEffort: "xhigh",
  serviceTier: "fast",
  sandboxMode: "danger-full-access",
  sandboxWorkspaceWrite: {
    networkAccess: true,
  },
});

export function normalizeProviderApiKey(value = "") {
  return String(value || "").trim();
}

export function providerKeyFingerprint(value = "") {
  const normalized = normalizeProviderApiKey(value);
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function createGflabProviderConfig({ userId = "", workspaceId = "", apiKey = "" } = {}) {
  const normalizedKey = normalizeProviderApiKey(apiKey);
  if (!normalizedKey) {
    return {
      ok: false,
      error: "provider_api_key_required",
      message: "请输入 gflabtoken API key 后再进入 OPL。",
    };
  }

  const secretRef = `gflab-${String(userId || "user").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 20) || "user"}-${randomUUID()}`;
  return {
    ok: true,
    providerConfigSecretRef: secretRef,
    providerConfigStatus: "configured",
    providerConfigured: true,
    providerName: GFLAB_PROVIDER_CONFIG.providerName,
    providerConfig: {
      ...GFLAB_PROVIDER_CONFIG,
      providerConfigSecretRef: secretRef,
      providerConfigStatus: "configured",
      ownerUserId: userId,
      workspaceId,
      secretFingerprint: providerKeyFingerprint(normalizedKey),
      experimentalBearerToken: normalizedKey,
    },
  };
}

export function redactProviderConfig(config = {}) {
  const providerName = String(config.providerName || GFLAB_PROVIDER_CONFIG.providerName).trim() || GFLAB_PROVIDER_CONFIG.providerName;
  const providerConfigSecretRef = String(config.providerConfigSecretRef || "").trim();
  return {
    providerConfigured: Boolean(config.providerConfigured || config.providerConfigStatus === "configured" || providerConfigSecretRef),
    providerConfigStatus: config.providerConfigStatus || (providerConfigSecretRef ? "configured" : "missing"),
    providerConfigSecretRef,
    providerName,
    providerBaseUrl: config.providerBaseUrl || GFLAB_PROVIDER_CONFIG.providerBaseUrl,
    modelProvider: config.modelProvider || GFLAB_PROVIDER_CONFIG.modelProvider,
    model: config.model || GFLAB_PROVIDER_CONFIG.model,
    modelReasoningEffort: config.modelReasoningEffort || GFLAB_PROVIDER_CONFIG.modelReasoningEffort,
    serviceTier: config.serviceTier || GFLAB_PROVIDER_CONFIG.serviceTier,
    sandboxMode: config.sandboxMode || GFLAB_PROVIDER_CONFIG.sandboxMode,
  };
}
