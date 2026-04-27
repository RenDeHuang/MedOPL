export function firstString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export function arrayFrom(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

export function labelValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || "unknown";
}

export function appendTags(payload, context) {
  const existing = arrayFrom(payload.Tags);
  const tags = [
    { Key: "tenant_id", Value: context.tenantId },
    { Key: "workspace_id", Value: context.workspaceId },
    { Key: "run_id", Value: context.runId },
    { Key: "server_plan_id", Value: context.serverPlanId },
    { Key: "resource_order_id", Value: context.resourceOrderId },
  ].filter((item) => item.Value);
  return [...existing, ...tags.filter((tag) => !existing.some((item) => item.Key === tag.Key))];
}

export function appendLabels(payload, context) {
  const existing = arrayFrom(payload.Labels);
  const labels = [
    { Name: "gaofenglab/tenant-id", Value: labelValue(context.tenantId) },
    { Name: "gaofenglab/workspace-id", Value: labelValue(context.workspaceId) },
    { Name: "gaofenglab/run-id", Value: labelValue(context.runId) },
    { Name: "gaofenglab/server-plan-id", Value: labelValue(context.serverPlanId) },
    { Name: "gaofenglab/resource-order-id", Value: labelValue(context.resourceOrderId) },
  ].filter((item) => item.Value);
  return [...existing, ...labels.filter((label) => !existing.some((item) => item.Name === label.Name))];
}
