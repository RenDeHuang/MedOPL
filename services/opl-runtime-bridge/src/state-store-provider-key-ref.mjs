function firstString(values = []) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function providerKeyRefFields(input = {}) {
  return {
    providerKeyRef: firstString([
      input.providerKeyRef,
      input.provider_key_ref,
      input.providerConfigSecretRef,
      input.provider_config_secret_ref,
    ]),
  };
}
