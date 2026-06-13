export const CANONICAL_OWNERSHIP_SOURCE = "postgres_resource_binding_ledger";
export const CLOUD_TAG_SUPPORT = "tke_nodepool_unsupported";
export const CLOUD_OPERATION_TYPE = "package_c_create_release_canary";

export function createPackageCLocalLedgerSink() {
  return {
    mode: "local_dry_run",
    productionPostgresWrite: false,
    async createResourceBinding() {},
    async appendCloudOperationEvent() {},
    async updateNodePoolId() {},
    async updateLifecycleStatus() {},
    async markReleased() {},
    async markFailed() {},
    async markCleanupRequired() {},
  };
}

function normalizeLedgerSink(ledgerSink = null) {
  const sink = ledgerSink || createPackageCLocalLedgerSink();
  for (const method of [
    "createResourceBinding",
    "appendCloudOperationEvent",
    "updateNodePoolId",
    "updateLifecycleStatus",
    "markReleased",
    "markFailed",
    "markCleanupRequired",
  ]) {
    if (typeof sink[method] !== "function") {
      throw new Error(`package_c_live_canary_ledger_sink_method_missing:${method}`);
    }
  }
  return sink;
}

export function createPackageCLedgerWriter({ ledger, ledgerSink }) {
  const sink = normalizeLedgerSink(ledgerSink);
  const writes = [];
  const mode = String(sink.mode || (sink.productionPostgresWrite ? "postgres_repository_contract" : "local_dry_run"));
  const productionPostgresWrite = sink.productionPostgresWrite === true;

  async function write(method, args = []) {
    writes.push({ method });
    await sink[method](...args);
  }

  async function createInitial() {
    const snapshot = ledger.snapshot();
    await write("createResourceBinding", [snapshot.resourceBinding]);
    await write("appendCloudOperationEvent", [snapshot.cloudOperation]);
  }

  async function persistTransition(transition) {
    const resourceBinding = transition.resourceBinding;
    const cloudOperation = transition.cloudOperation;
    if (transition.status === "created") {
      await write("updateNodePoolId", [
        resourceBinding.resourceBindingId,
        resourceBinding.nodePoolId,
        transition.status,
      ]);
    } else if (transition.status === "released") {
      await write("markReleased", [
        resourceBinding.resourceBindingId,
        resourceBinding.releasedAt,
      ]);
    } else if (transition.status === "failed") {
      await write("markFailed", [resourceBinding.resourceBindingId]);
    } else if (transition.status === "cleanupRequired") {
      await write("markCleanupRequired", [resourceBinding.resourceBindingId]);
    } else {
      await write("updateLifecycleStatus", [resourceBinding.resourceBindingId, transition.status]);
    }
    await write("appendCloudOperationEvent", [cloudOperation]);
  }

  function snapshot() {
    return {
      mode,
      productionPostgresWrite,
      dryRun: productionPostgresWrite !== true,
      canonicalStore: "PostgreSQL resource_bindings/cloud_operations",
      writeCount: writes.length,
      methods: writes.map((entry) => entry.method),
    };
  }

  return {
    createInitial,
    persistTransition,
    snapshot,
    productionPostgresWrite: () => productionPostgresWrite,
  };
}
