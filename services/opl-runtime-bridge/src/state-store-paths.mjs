import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_RUNTIME_BRIDGE_STATE_ROOT = "/tmp/medopl-runtime/.runtime";
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
export const runtimeRoot = process.env.PORTAL_RUNTIME_BRIDGE_STATE_ROOT
  ? path.resolve(process.env.PORTAL_RUNTIME_BRIDGE_STATE_ROOT)
  : DEFAULT_RUNTIME_BRIDGE_STATE_ROOT;
export const stateFile = path.join(runtimeRoot, "state.json");
export const artifactsRoot = path.join(runtimeRoot, "artifacts");
