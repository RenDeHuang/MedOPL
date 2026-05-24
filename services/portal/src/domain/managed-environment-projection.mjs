function text(value) {
  return String(value ?? "").trim();
}

export function managedEnvironmentUserNarrative() {
  return {
    statusLabel: "托管运行环境已开通",
    visibleConcepts: ["托管运行环境", "工作空间", "文件空间", "套餐", "余额", "预扣费"],
  };
}

export function workspacePublicView(workspace = {}, workspaceId = "") {
  return {
    id: text(workspace.id || workspace.slug || workspaceId),
    workspaceId: text(workspace.workspaceId || workspace.slug || workspaceId),
    slug: text(workspace.slug || workspaceId),
    status: text(workspace.status || "active"),
  };
}

export function fileSpacePublicView(source = {}, plan = {}) {
  return {
    capacityGb: Number(source.fileSpaceGb || source.storageCapacityGb || plan.storage?.capacityGb || 0),
    storageBackend: text(source.storageBackend || source.fileSpaceBackend || plan.storageBackend),
    status: text(source.status || "active"),
  };
}
