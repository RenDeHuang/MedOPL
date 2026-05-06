export function createServerPlansCloudState({
  cloudRuntimeState,
  sanitizeCloudError,
}) {
  function markCloudState(kind, error = null) {
    const now = new Date().toISOString();
    if (kind === "discovery") {
      cloudRuntimeState.lastDiscoveryAt = now;
      cloudRuntimeState.lastDiscoveryError = sanitizeCloudError(error);
    }
    if (kind === "quote") {
      cloudRuntimeState.lastQuoteAt = now;
      cloudRuntimeState.lastQuoteError = sanitizeCloudError(error);
    }
    if (kind === "bill") {
      cloudRuntimeState.lastBillQueryAt = now;
      cloudRuntimeState.lastBillQueryError = sanitizeCloudError(error);
    }
  }

  return { markCloudState };
}
