import { statSync } from "node:fs";

export function createPortalStoreHealth({
  buildSha,
  buildTime,
  identity,
  billing,
  runtime,
  storage,
  links,
}) {
  function statSyncSafe(filePath) {
    try {
      const meta = statSync(filePath);
      return {
        size: meta.size,
        mtime: meta.mtime.toISOString(),
      };
    } catch {
      return { size: 0, mtime: "-" };
    }
  }

  function buildPortalHealthPayload({ storageMode }) {
    return {
      ok: true,
      service: "portal",
      build: {
        sha: buildSha,
        time: buildTime,
      },
      identity,
      billing,
      resourceBindings: {
        enabled: true,
        states: ["planned", "preparing", "active", "release_requested", "billing_stop_confirming", "billing_stopped", "audit_pending", "audit_ready", "audited"],
        requiredAttributionFields: ["resourceBindingId", "billingAttributionId", "workspaceId", "accountId", "serverPlanId"],
        billingAttributionId: "required",
        workspaceId: "required",
        accountId: "required",
        serverPlanId: "required",
      },
      runtime,
      storage: {
        storageMode: storageMode(),
        runtimeRoot: storage.runtimeRoot,
        dataFile: statSyncSafe(storage.dataFile),
        eventsFile: statSyncSafe(storage.eventsFile),
        medWorkspaceRoot: storage.medWorkspaceRoot,
        medRunsRoot: storage.medRunsRoot,
        codexRuntimeRoot: storage.codexRuntimeRoot,
        codexRuntimeEventsFile: statSyncSafe(storage.codexRuntimeEventsFile),
      },
      links,
    };
  }

  return {
    buildPortalHealthPayload,
  };
}
