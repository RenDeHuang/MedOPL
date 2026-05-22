import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function assertIncludes(source, marker, message) {
  assert(source.includes(marker), message);
}

function assertNotIncludes(source, marker, message) {
  assert.equal(source.includes(marker), false, message);
}

const facadePath = "services/portal/src/services/portal-workflow-facade.service.mjs";
assert.equal(await exists(facadePath), true, "portal_workflow_facade_service_missing");

const [
  facadeSource,
  oplRoutesSource,
  labPackageRoutesSource,
  cloudOperationsRoutesSource,
  portalRuntimeSource,
  featureRuntimeHandlersSource,
  apiRuntimeHandlersSource,
  portalApiRoutesSource,
  authRuntimeHandlerSource,
] = await Promise.all([
  readRepoFile(facadePath),
  readRepoFile("services/portal/src/routes/opl.routes.mjs"),
  readRepoFile("services/portal/src/routes/lab-package.routes.mjs"),
  readRepoFile("services/portal/src/routes/portal-api-v22-cloud-operations.routes.mjs"),
  readRepoFile("services/portal/src/app/portal-runtime.mjs"),
  readRepoFile("services/portal/src/app/portal-feature-runtime-handlers.mjs"),
  readRepoFile("services/portal/src/app/portal-api-runtime-handlers.mjs"),
  readRepoFile("services/portal/src/routes/portal-api.routes.mjs"),
  readRepoFile("services/portal/src/app/portal-auth-runtime-handler.mjs"),
]);

for (const marker of [
  "createPortalWorkflowFacade",
  "submitCommand",
  "runOplLaunchCommand",
  "runCloudOperationCommand",
  "pending",
  "running",
  "succeeded",
  "failed",
]) {
  assertIncludes(facadeSource, marker, `portal_workflow_facade_marker_missing:${marker}`);
}

assertNotIncludes(facadeSource, "Temporal", "node_portal_facade_must_not_claim_temporal_engine");
assertNotIncludes(facadeSource, "fake success", "node_portal_facade_must_not_fake_success");
assertNotIncludes(facadeSource, "fake_success", "node_portal_facade_must_not_fake_success");
assertNotIncludes(facadeSource, "ok: true, result", "node_portal_facade_must_not_wrap_failures_as_success");

for (const [name, source] of [
  ["opl_routes", oplRoutesSource],
  ["auth_runtime_handler", authRuntimeHandlerSource],
]) {
  assertIncludes(source, "workflowFacade", `${name}_must_accept_workflow_facade`);
  assertIncludes(source, "runOplLaunchCommand", `${name}_must_route_opl_launch_through_facade`);
}

for (const [name, source] of [
  ["lab_package_routes", labPackageRoutesSource],
  ["cloud_operations_routes", cloudOperationsRoutesSource],
]) {
  assertIncludes(source, "workflowFacade", `${name}_must_accept_workflow_facade`);
  assertIncludes(source, "runCloudOperationCommand", `${name}_must_route_cloud_mutation_through_facade`);
}

for (const [name, source] of [
  ["portal_runtime", portalRuntimeSource],
  ["feature_runtime_handlers", featureRuntimeHandlersSource],
  ["api_runtime_handlers", apiRuntimeHandlersSource],
  ["portal_api_routes", portalApiRoutesSource],
]) {
  assertIncludes(source, "workflowFacade", `${name}_must_wire_single_workflow_facade`);
}

assertIncludes(portalRuntimeSource, "createPortalWorkflowFacade", "portal_runtime_must_create_facade_once");
assert.match(portalRuntimeSource, /const\s+workflowFacade\s*=\s*createPortalWorkflowFacade/u, "portal_runtime_must_have_single_facade_instance");

for (const marker of [
  "runtimeBridgeClient.requestRuntimeBridgeApi",
  "targetPath: \"/api/opl/bootstrap\"",
  "targetPath: \"/api/opl/messages\"",
  "targetPath: \"/api/opl/files\"",
  "targetPath: \"/api/opl/runs\"",
]) {
  assertIncludes(oplRoutesSource, marker, `portal_runtime_proxy_must_remain_thin:${marker}`);
}

const forbiddenPublicLeakMarkers = [
  "workflowId",
  "workflowExecutionId",
  "commandId: result.commandId",
];
for (const marker of forbiddenPublicLeakMarkers) {
  assertNotIncludes(oplRoutesSource, marker, `opl_launch_public_payload_must_not_expose_workflow_marker:${marker}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_node_portal_workflow_facade_boundary",
  facade: facadePath,
  durableEngine: "behind_facade_future_replacement",
}, null, 2));
