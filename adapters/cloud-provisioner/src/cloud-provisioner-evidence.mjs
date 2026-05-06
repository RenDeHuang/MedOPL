function text(value = "") {
  return String(value ?? "").trim();
}

export function normalizeEvidence(evidence = {}, fallback = {}) {
  const source = evidence && typeof evidence === "object" ? evidence : {};
  return {
    ...source,
    kind: text(source.kind || fallback.kind),
    provider: text(source.provider || fallback.provider),
    requestId: text(source.requestId || fallback.requestId),
    recordedAt: text(source.recordedAt || fallback.recordedAt),
  };
}
