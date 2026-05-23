function text(value = "") {
  return String(value ?? "").trim();
}

function boundStatusText(value = "") {
  return text(value) || "bound";
}

export function findBoundGflabProviderKeyBinding(db = {}, user = {}, workspaceId = "") {
  const bindings = Array.isArray(db.providerKeyBindings) ? db.providerKeyBindings : [];
  const targetWorkspaceId = text(workspaceId);
  return [...bindings].reverse().find((binding) => {
    if (text(binding.provider || "gflabtoken") !== "gflabtoken") return false;
    if (text(binding.userId || binding.user_id || binding.ownerUserId) !== text(user.id)) return false;
    const bindingWorkspaceId = text(binding.workspaceId || binding.workspace_id);
    if (targetWorkspaceId && bindingWorkspaceId && bindingWorkspaceId !== targetWorkspaceId) return false;
    if (!text(binding.providerKeyRef || binding.providerConfigSecretRef)) return false;
    const status = boundStatusText(binding.boundStatus || binding.status || binding.providerConfigStatus);
    return status === "bound" || status === "configured" || status === "active";
  }) || null;
}

export function providerKeyRefFromBinding(binding = {}) {
  return text(binding.providerKeyRef || binding.providerConfigSecretRef);
}

export function providerKeyPublicPayload(binding = {}) {
  const providerKeyRef = providerKeyRefFromBinding(binding);
  return {
    provider: "gflabtoken",
    providerBound: Boolean(providerKeyRef),
    providerKeyRef,
    boundStatus: boundStatusText(binding.boundStatus || binding.providerConfigStatus),
  };
}
