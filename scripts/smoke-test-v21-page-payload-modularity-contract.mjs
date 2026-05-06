import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "analyze-v21-structure-hotspots.mjs"),
  "--root",
  repoRoot,
  "--json",
  "--file",
  "services/portal/src/app/portal-page-payloads.mjs",
], {
  cwd: repoRoot,
  encoding: "utf8",
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const payload = JSON.parse(result.stdout);
const createPortalPagePayloads = payload.functionHotspots.find((item) =>
  item.file === "services/portal/src/app/portal-page-payloads.mjs"
  && item.name === "createPortalPagePayloads"
);

assert(createPortalPagePayloads, "createPortalPagePayloads must remain in portal-page-payloads facade");
assert(
  createPortalPagePayloads.lines <= 90,
  `createPortalPagePayloads must be a thin facade, got ${createPortalPagePayloads.lines} lines`,
);
assert(
  createPortalPagePayloads.domainBreadth <= 4,
  `createPortalPagePayloads must not own cross-domain payload logic, got domainBreadth=${createPortalPagePayloads.domainBreadth}`,
);
