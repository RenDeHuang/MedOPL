import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import { artifactsRoot, runtimeRoot, stateFile } from "./state-store-paths.mjs";
import { dropRetiredStateFields } from "./state-store-retired-fields.mjs";

let stateWriteQueue = Promise.resolve();

const emptyState = {
  version: "v1",
  launchTokens: [],
  workspaces: [],
  workspaceSessions: [],
  runtimeSessions: [],
  runs: [],
  runActions: [],
  artifacts: [],
  messageRequests: [],
  messageReplies: [],
  traceLinks: [],
  sessionLedgerEntries: [],
  events: [],
};

export { emptyState };

export async function ensureRuntime() {
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });
  if (!existsSync(stateFile)) {
    await writeState(emptyState);
  }
}

export async function readState() {
  await ensureRuntime();
  const parsed = JSON.parse(await readFile(stateFile, "utf8"));
  return sanitizeState({ ...emptyState, ...parsed });
}

export async function writeState(state) {
  const write = () => writeStateSnapshot(state);
  stateWriteQueue = stateWriteQueue.then(write, write);
  return stateWriteQueue;
}

export async function updateState(mutator) {
  if (typeof mutator !== "function") {
    throw new TypeError("state_update_mutator_required");
  }
  let updatedState;
  const update = async () => {
    const current = await readStateUnlocked();
    const result = await mutator(current);
    updatedState = sanitizeState({ ...emptyState, ...(result || current) });
    await writeStateSnapshot(updatedState);
    return updatedState;
  };
  stateWriteQueue = stateWriteQueue.then(update, update);
  return stateWriteQueue.then(() => updatedState);
}

async function writeStateSnapshot(state) {
  await mkdir(runtimeRoot, { recursive: true });
  const tempStateFile = path.join(runtimeRoot, `.state.${process.pid}.${randomUUID()}.tmp`);
  await writeFile(tempStateFile, `${JSON.stringify(sanitizeState({ ...emptyState, ...state }), null, 2)}\n`, "utf8");
  await rename(tempStateFile, stateFile);
}

async function readStateUnlocked() {
  await ensureRuntimeUnlocked();
  const parsed = JSON.parse(await readFile(stateFile, "utf8"));
  return sanitizeState({ ...emptyState, ...parsed });
}

async function ensureRuntimeUnlocked() {
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(artifactsRoot, { recursive: true });
  if (!existsSync(stateFile)) {
    await writeStateSnapshot(emptyState);
  }
}

function sanitizeState(state) {
  const runtimeState = dropRetiredStateFields(state);
  return {
    ...runtimeState,
    messageReplies: Array.isArray(state.messageReplies) ? state.messageReplies : [],
    sessionLedgerEntries: Array.isArray(state.sessionLedgerEntries) ? state.sessionLedgerEntries : [],
  };
}
