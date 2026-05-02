import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const adminPayloadSource = await readFile("services/portal/src/app/portal-admin-api-payloads.mjs", "utf8");
const portraitSource = await readFile("services/portal/src/app/portal-admin-portrait-payloads.mjs", "utf8");

assert.match(adminPayloadSource, /from "\.\/portal-admin-portrait-payloads\.mjs"/, "admin_payloads_must_import_portrait_payloads");
assert.match(adminPayloadSource, /createPortalAdminPortraitPayloads\(/, "admin_payloads_must_create_portrait_payloads");
assert.doesNotMatch(adminPayloadSource, /async function buildAdminUserPortraitApiPayload\b/, "admin_payloads_must_not_inline_user_portrait");
assert.doesNotMatch(adminPayloadSource, /async function buildAdminWorkspacePortraitApiPayload\b/, "admin_payloads_must_not_inline_workspace_portrait");
assert.doesNotMatch(adminPayloadSource, /async function buildAdminRunPortraitApiPayload\b/, "admin_payloads_must_not_inline_run_portrait");

assert.match(portraitSource, /export function createPortalAdminPortraitPayloads\(/, "portrait_payloads_must_export_factory");
assert.match(portraitSource, /async function buildAdminUserPortraitApiPayload\b/, "portrait_payloads_must_own_user_portrait");
assert.match(portraitSource, /async function buildAdminWorkspacePortraitApiPayload\b/, "portrait_payloads_must_own_workspace_portrait");
assert.match(portraitSource, /async function buildAdminRunPortraitApiPayload\b/, "portrait_payloads_must_own_run_portrait");

console.log(JSON.stringify({
  ok: true,
  contract: "portal_admin_portrait_payloads",
}, null, 2));
