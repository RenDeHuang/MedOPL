export function createManagedRuntimeRunApi({
  productRuntimeMode = "",
} = {}) {
  function retiredError() {
    const error = new Error("managed_runtime_retired_runtime_agent_required");
    error.code = "RUNTIME_AGENT_RELAY_NOT_IMPLEMENTED";
    error.stage = "platform_provisioned_runtime_dispatch";
    error.retryable = false;
    error.details = {
      retired: true,
      productRuntimeMode,
      message: "managed_runtime_retired",
    };
    return error;
  }

  async function submitRuntimeRun() {
    throw retiredError();
  }

  async function syncRunnerRun() {
    throw retiredError();
  }

  return {
    submitRuntimeRun,
    syncRunnerRun,
  };
}
