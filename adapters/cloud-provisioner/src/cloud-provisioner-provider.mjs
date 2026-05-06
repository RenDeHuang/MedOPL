function text(value = "") {
  return String(value ?? "").trim();
}

function notConfiguredError() {
  const error = new Error("cloud_provisioner_not_configured");
  error.code = "cloud_provisioner_not_configured";
  error.status = 503;
  return error;
}

export function createStrictDisabledProvider() {
  return {
    name: "disabled",
    mode: "disabled",
    strict: true,
    configured: false,
    async provisionCompute() {
      throw notConfiguredError();
    },
    async provisionStorage() {
      throw notConfiguredError();
    },
    async releaseCompute() {
      throw notConfiguredError();
    },
    async releaseStorage() {
      throw notConfiguredError();
    },
  };
}

export function createConfiguredProvider({ env = process.env } = {}) {
  const providerMode = text(env.V21_CLOUD_PROVISIONER_PROVIDER || env.CLOUD_PROVISIONER_PROVIDER);
  if (!providerMode) {
    return createStrictDisabledProvider();
  }

  const error = new Error("provider_required");
  error.code = "provider_required";
  error.status = 503;
  throw error;
}
