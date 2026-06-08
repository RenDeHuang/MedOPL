import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
export const runtimeRoot = process.env.PORTAL_RUNTIME_BRIDGE_STATE_ROOT
  ? path.resolve(process.env.PORTAL_RUNTIME_BRIDGE_STATE_ROOT)
  : path.join(repoRoot, ".runtime", "runtime-bridge");
export const stateFile = path.join(runtimeRoot, "state.json");
export const artifactsRoot = path.join(runtimeRoot, "artifacts");
