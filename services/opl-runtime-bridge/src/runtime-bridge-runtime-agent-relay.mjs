import { createLocalFakeRuntimeAgentRelay } from "./local-fake-runtime-agent-relay.mjs";
import { createRuntimeAgentHttpRelay } from "./runtime-agent-http-relay.mjs";

export function createConfiguredRuntimeAgentRelay(config = {}) {
  if (config.localFakeRuntimeRelay) return createLocalFakeRuntimeAgentRelay();
  if (config.runtimeAgentRelayMode === "http") return createRuntimeAgentHttpRelay();
  return null;
}
