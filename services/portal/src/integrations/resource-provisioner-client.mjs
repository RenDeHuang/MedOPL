function hasJsonContent(response) {
  return String(response.headers.get("content-type") || "").toLowerCase().includes("application/json");
}

async function fetchJsonOrNull(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !hasJsonContent(response)) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function postJsonOrNull(url, body, timeoutMs) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!hasJsonContent(response)) {
      return { ok: false, error: `resource_provisioner_non_json:${response.status}` };
    }
    const payload = await response.json();
    return response.ok ? payload : { ok: false, status: response.status, ...payload };
  } catch (error) {
    return { ok: false, error: String(error?.message || error || "resource_provisioner_unreachable") };
  }
}

function fallbackCloudResources(reason = "resource_provisioner_unavailable") {
  return {
    ok: false,
    source: "resource_provisioner",
    reason,
    cluster: null,
    summary: {
      nodePoolCount: 0,
      instanceCount: 0,
      taggedInstanceCount: 0,
      orderLinkedNodePoolCount: 0,
    },
    nodePools: [],
    instances: [],
  };
}

export function createResourceProvisionerClient({ provisionerUrl, timeoutMs = 5000 }) {
  const baseUrl = String(provisionerUrl || "").replace(/\/$/, "");

  return {
    fetchCloudResources() {
      if (!baseUrl) return Promise.resolve(fallbackCloudResources("resource_provisioner_url_not_configured"));
      return fetchJsonOrNull(new URL("/cloud/resources", `${baseUrl}/`), timeoutMs)
        .then((payload) => payload || fallbackCloudResources());
    },

    fetchNodePools() {
      if (!baseUrl) return Promise.resolve({ ok: false, items: [] });
      return fetchJsonOrNull(new URL("/cloud/node-pools", `${baseUrl}/`), timeoutMs);
    },

    fetchInstances() {
      if (!baseUrl) return Promise.resolve({ ok: false, items: [] });
      return fetchJsonOrNull(new URL("/cloud/instances", `${baseUrl}/`), timeoutMs);
    },

    ensureCapacity(input) {
      if (!baseUrl) return Promise.resolve({ ok: false, error: "resource_provisioner_url_not_configured" });
      return postJsonOrNull(new URL("/resource-orders/ensure-capacity", `${baseUrl}/`), input, timeoutMs);
    },

    startProvision(input) {
      if (!baseUrl) return Promise.resolve({ ok: false, error: "resource_provisioner_url_not_configured" });
      return postJsonOrNull(new URL("/resource-orders/provision-async", `${baseUrl}/`), input, timeoutMs);
    },

    scaleToZero(input) {
      if (!baseUrl) return Promise.resolve({ ok: false, error: "resource_provisioner_url_not_configured" });
      return postJsonOrNull(new URL("/resource-orders/scale-to-zero", `${baseUrl}/`), input, timeoutMs);
    },

    deleteNodePool(input) {
      if (!baseUrl) return Promise.resolve({ ok: false, error: "resource_provisioner_url_not_configured" });
      return postJsonOrNull(new URL("/resource-orders/delete-node-pool", `${baseUrl}/`), input, timeoutMs);
    },
  };
}
