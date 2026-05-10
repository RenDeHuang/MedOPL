import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "v22-opl-adapter-state-store-"));
process.env.PORTAL_OPL_ADAPTER_STATE_ROOT = tempRoot;

const stateStoreUrl = pathToFileURL(path.resolve("services/opl-runtime-bridge/src/state-store.mjs"));
stateStoreUrl.search = `smoke=${Date.now()}`;

try {
  const stateStore = await import(stateStoreUrl.href);
  assert.equal(typeof stateStore.updateState, "function", "state_store_must_export_transactional_update_state");

  await Promise.all([
    stateStore.updateState((state) => {
      stateStore.addEvent(state, "concurrent_message_backflow", {
        portalUserId: "user-v22-state-store",
        workspaceId: "workspace-v22-state-store",
        messageId: "message-v22-state-store",
      });
    }),
    stateStore.updateState((state) => {
      stateStore.addEvent(state, "concurrent_file_backflow", {
        portalUserId: "user-v22-state-store",
        workspaceId: "workspace-v22-state-store",
        artifactId: "artifact-v22-state-store",
      });
    }),
  ]);

  const state = await stateStore.readState();
  assert(
    state.events.some((event) => event.type === "concurrent_message_backflow" && event.messageId === "message-v22-state-store"),
    "state_store_must_preserve_concurrent_message_backflow",
  );
  assert(
    state.events.some((event) => event.type === "concurrent_file_backflow" && event.artifactId === "artifact-v22-state-store"),
    "state_store_must_preserve_concurrent_file_backflow",
  );

  console.log(JSON.stringify({
    ok: true,
    contract: "v22_opl_adapter_state_store_atomic_flow",
    covered: [
      "transactional_state_update",
      "concurrent_api_backflow_preserved",
    ],
  }, null, 2));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
