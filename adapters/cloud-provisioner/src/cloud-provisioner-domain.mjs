import { normalizeEvidence } from "./cloud-provisioner-evidence.mjs";

function text(value = "") {
  return String(value ?? "").trim();
}

function normalizeCompute(result = {}) {
  const evidence = normalizeEvidence(result.evidence, {
    requestId: result.requestId,
    provider: result.provider,
  });
  return {
    ...result,
    cloudResourceId: text(result.cloudResourceId || result.cvmInstanceId || result.instanceId),
    cvmInstanceId: text(result.cvmInstanceId || result.instanceId || result.cloudResourceId),
    instanceId: text(result.instanceId || result.cvmInstanceId || result.cloudResourceId),
    runtimeAgentEndpoint: text(result.runtimeAgentEndpoint || result.publicEndpoint || result.endpoint),
    evidence,
  };
}

function normalizeStorage(result = {}) {
  const evidence = normalizeEvidence(result.evidence, {
    requestId: result.requestId,
    provider: result.provider,
  });
  return {
    ...result,
    cloudResourceId: text(result.cloudResourceId || result.bucket || result.bucketName || result.bucketId),
    bucket: text(result.bucket || result.bucketName || result.bucketId || result.cloudResourceId),
    bucketName: text(result.bucketName || result.bucket || result.bucketId || result.cloudResourceId),
    bucketId: text(result.bucketId || result.bucketName || result.bucket || result.cloudResourceId),
    rootPrefix: text(result.rootPrefix),
    evidence,
  };
}

function requiredOperation(provider, operation) {
  if (provider && typeof provider[operation] === "function") {
    return provider[operation].bind(provider);
  }
  const error = new Error("provider_required");
  error.code = "provider_required";
  error.status = 503;
  throw error;
}

export function createCloudProvisionerService({ provider }) {
  const activeProvider = provider || requiredOperation(null, "provisionCompute");

  return {
    healthz() {
      return {
        ok: true,
        service: "cloud-provisioner",
        provider: text(activeProvider.name || "disabled"),
        providerConfigured: Boolean(activeProvider.configured),
        mode: text(activeProvider.mode || "disabled") || "disabled",
        policy: activeProvider.strict === false ? "permissive" : "strict",
      };
    },

    async provisionCompute(request = {}) {
      return { ok: true, compute: normalizeCompute(await requiredOperation(activeProvider, "provisionCompute")(request)) };
    },

    async provisionStorage(request = {}) {
      return { ok: true, storage: normalizeStorage(await requiredOperation(activeProvider, "provisionStorage")(request)) };
    },

    async releaseCompute(request = {}) {
      return { ok: true, compute: normalizeCompute(await requiredOperation(activeProvider, "releaseCompute")(request)) };
    },

    async releaseStorage(request = {}) {
      return { ok: true, storage: normalizeStorage(await requiredOperation(activeProvider, "releaseStorage")(request)) };
    },
  };
}
