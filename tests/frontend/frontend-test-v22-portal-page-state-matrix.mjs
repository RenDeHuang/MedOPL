import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

const matrix = await readJson("contracts/medopl-portal-page-state-matrix.json");
const routes = await readRepoFile("services/portal/frontend/src/app/routes.tsx");
const layout = await readRepoFile("services/portal/frontend/src/app/components/Layout.tsx");

const routeMarkers = new Map([
  ["resource_overview", ["Overview", "/overview"]],
  ["packages_purchase", ["PackagesPurchase", "/packages"]],
  ["compute_resource", ["RuntimeEnvironment", "/resources"]],
  ["storage_space", ["Workspace", "/workspace"]],
  ["usage_billing", ["BillingAudit", "/billing"]],
  ["opl_entry", ["OPLEntry", "/opl-launch"]],
  ["release", ["Workspace", "/workspace"]],
]);

for (const page of matrix.medopl_portal_page_state_matrix.pages) {
  assert(routeMarkers.has(page.id), `portal_page_matrix_route_owner_missing:${page.id}`);
  for (const marker of routeMarkers.get(page.id) || []) {
    assert(`${routes}\n${layout}`.includes(marker), `portal_page_state_marker_missing:${page.id}:${marker}`);
  }
  assert(Array.isArray(page.states) && page.states.length > 0, `portal_page_states_missing:${page.id}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_page_state_matrix",
  pages: matrix.medopl_portal_page_state_matrix.pages.map((page) => page.id),
}, null, 2));
