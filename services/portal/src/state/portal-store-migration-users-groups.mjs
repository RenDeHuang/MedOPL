function ensureGroupDefault(group, key, value) {
  if (key in group) return false;
  group[key] = value;
  return true;
}

export function migrateUsersAndGroups({ db, ensureUserCommercialState }) {
  let changed = false;
  for (const user of db.users) {
    if (!user.status) {
      user.status = "active";
      changed = true;
    }
    if (!user.preferences || typeof user.preferences !== "object") {
      user.preferences = { theme: "light" };
      changed = true;
    }
    if (!user.preferences.theme) {
      user.preferences.theme = "light";
      changed = true;
    }
    if (!user.currentTaskSlug) {
      user.currentTaskSlug = "default";
      changed = true;
    }
    if (!("groupId" in user)) {
      user.groupId = "";
      changed = true;
    }
    if (ensureUserCommercialState(user, { grantTrial: false })) {
      changed = true;
    }
  }
  for (const group of db.groups) {
    for (const [key, value] of [
      ["balanceFloor", 0],
      ["maxWorkspaces", 0],
      ["maxConcurrentRuns", 0],
      ["allowMas", true],
      ["allowWorkspaceCreate", true],
      ["cpuRequest", ""],
      ["cpuLimit", ""],
      ["memoryRequest", ""],
      ["memoryLimit", ""],
      ["gpuCount", 0],
      ["storageRequest", ""],
      ["storageLimit", ""],
    ]) {
      if (ensureGroupDefault(group, key, value)) {
        changed = true;
      }
    }
  }
  return changed;
}
