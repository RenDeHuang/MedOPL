const ALLOWED_POD_ANNOTATIONS = new Set(["tke.cloud.tencent.com/eni-ip"]);

export function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

export function normalizePodAnnotations(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [String(key || "").trim(), String(item ?? "").trim()])
      .filter(([key, item]) => ALLOWED_POD_ANNOTATIONS.has(key) && item),
  );
}

export function buildPodNetworkingContract(identity = {}) {
  const podNetworkingMode = String(identity.podNetworkingMode || identity.pod_networking_mode || "").trim().toLowerCase();
  const requiresEniPod = normalizeBoolean(identity.requiresEniPod ?? identity.requires_eni_pod);
  const podAnnotations = normalizePodAnnotations(identity.podAnnotations || identity.pod_annotations);
  if (requiresEniPod) podAnnotations["tke.cloud.tencent.com/eni-ip"] = "true";
  return { podNetworkingMode, requiresEniPod, podAnnotations };
}

export function yamlPodAnnotationsBlock(annotations = {}, yamlMap) {
  const body = typeof yamlMap === "function" ? yamlMap(annotations, 8) : "";
  return body ? `annotations:\n${body}` : "";
}
