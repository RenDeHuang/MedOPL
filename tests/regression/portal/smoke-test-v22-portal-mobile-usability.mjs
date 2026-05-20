import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertExcludes(source, forbidden, label) {
  assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
}

const layoutSource = await readFile("services/portal/frontend/src/app/components/Layout.tsx", "utf8");
const stylesSource = await readFile("services/portal/frontend/src/styles/index.css", "utf8");
const workspaceSource = await readFile("services/portal/frontend/src/app/pages/Workspace.tsx", "utf8");
const traceSource = await readFile("services/portal/frontend/src/app/pages/TasksResults.tsx", "utf8");
const billingSource = await readFile("services/portal/frontend/src/app/pages/BillingAudit.tsx", "utf8");

assertIncludes(layoutSource, "flex h-screen", "layout_must_keep_stable_app_shell");
assertIncludes(layoutSource, "overflow-hidden", "layout_must_bound_app_overflow");
assertIncludes(layoutSource, "overflow-auto", "layout_main_must_scroll_without_page_breakage");
assertIncludes(layoutSource, "hidden sm:inline", "layout_help_copy_must_collapse_on_small_viewports");
assertIncludes(stylesSource, "tailwind.css", "styles_must_import_tailwind");

for (const [label, source] of [
  ["workspace", workspaceSource],
  ["trace", traceSource],
  ["billing", billingSource],
]) {
  assertIncludes(source, "grid", `${label}_must_use_responsive_grid`);
  assertIncludes(source, "max-w-7xl", `${label}_must_bound_content_width`);
  assertExcludes(source, ">active<", `${label}_must_not_show_raw_active_text`);
  assertExcludes(source, "SecretId", `${label}_must_not_show_secret_id`);
  assertExcludes(source, "SecretKey", `${label}_must_not_show_secret_key`);
  assertExcludes(source, "signedUrl", `${label}_must_not_show_signed_url`);
  assertExcludes(source, "localPath", `${label}_must_not_show_local_path`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_mobile_usability",
  currentTruth: "figma_make_zip_react_responsive_surface",
  retiredVueMobileSurface: true,
}, null, 2));
