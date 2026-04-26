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

export function createBillingClient({ billingServiceUrl, timeoutMs = 3000 }) {
  return {
    fetchSummary(customerId = "", workspaceId = "", windowValue = "24h") {
      const url = new URL("/billing", billingServiceUrl);
      url.searchParams.set("window", windowValue);
      if (customerId) url.searchParams.set("customer_id", customerId);
      if (workspaceId) url.searchParams.set("workspace_id", workspaceId);
      return fetchJsonOrNull(url, timeoutMs);
    },

    fetchPendingSummary(customerId = "", workspaceId = "", windowValue = "168h") {
      const url = new URL("/pending", billingServiceUrl);
      url.searchParams.set("window", windowValue);
      if (customerId) url.searchParams.set("customer_id", customerId);
      if (workspaceId) url.searchParams.set("workspace_id", workspaceId);
      return fetchJsonOrNull(url, timeoutMs);
    },

    fetchStatus() {
      return fetchJsonOrNull(new URL("/status", billingServiceUrl), timeoutMs);
    },

    fetchServerPlans() {
      return fetchJsonOrNull(new URL("/server-plans", billingServiceUrl), timeoutMs);
    },
  };
}
