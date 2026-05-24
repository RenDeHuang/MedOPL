import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const inventoryPath = "tests/fixtures/v22/backend-go-convergence/backend-inventory.json";
const migrationMapPath = "tests/fixtures/v22/backend-go-convergence/migration-map.json";
const activeRoots = [
  "services/portal/src",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];
const requiredRiskTags = [
  "portal_long_task",
  "cloud_mutation",
  "memory_launch_truth",
  "billing_audit_aggregation",
  "runtime_bridge_token_secret_boundary",
];

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

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

async function listMjsFiles(dir, prefix = dir) {
  const entries = await readdir(path.join(repoRoot, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await listMjsFiles(repoPath, repoPath));
    if (entry.isFile() && entry.name.endsWith(".mjs")) files.push(repoPath);
  }
  return files.sort();
}

function assertIncludes(source, marker, message) {
  assert(String(source).includes(marker), message);
}

function assertNotIncludes(source, marker, message) {
  assert.equal(String(source).includes(marker), false, message);
}

function riskInventoryEntries(inventory) {
  return inventory.groups.flatMap((group) => group.paths.map((repoPath) => ({
    groupId: group.id,
    path: repoPath,
    riskTags: group.riskTags || [],
    targetClassification: group.targetClassification,
  })));
}

function nodesForPath(migrationMap, repoPath) {
  return migrationMap.nodes.filter((node) => (node.sourcePaths || []).includes(repoPath));
}

function assertRiskPathBound({ inventory, migrationMap, repoPath, riskTag, nodeId = "" }) {
  const entry = riskInventoryEntries(inventory).find((item) => item.path === repoPath);
  assert(entry, `risk_path_missing_from_inventory:${repoPath}`);
  assert(entry.riskTags.includes(riskTag), `risk_path_missing_inventory_tag:${repoPath}:${riskTag}`);
  const nodes = nodesForPath(migrationMap, repoPath);
  assert(nodes.length > 0, `risk_path_missing_migration_node:${repoPath}`);
  if (nodeId) assert(nodes.some((node) => node.id === nodeId), `risk_path_missing_expected_node:${repoPath}:${nodeId}`);
}

function assertNodeHasSecretBoundary(node, expectedNonPublicFields = []) {
  assert(node?.secretBoundary?.secretSource, `secret_boundary_source_missing:${node?.id}`);
  assert(node?.secretBoundary?.secretConsumer, `secret_boundary_consumer_missing:${node?.id}`);
  assert(Array.isArray(node.secretBoundary.redactedPublicFields), `secret_boundary_redacted_fields_missing:${node.id}`);
  assert(Array.isArray(node.secretBoundary.nonPublicFields), `secret_boundary_non_public_fields_missing:${node.id}`);
  for (const forbidden of expectedNonPublicFields) {
    assert(
      node.secretBoundary.nonPublicFields.includes(forbidden)
      || node.secretBoundary.nonPublicFields.some((field) => field.toLowerCase().includes(forbidden.toLowerCase())),
      `secret_boundary_must_name_forbidden_field:${node.id}:${forbidden}`,
    );
  }
}

async function assertPortalRiskInventory(inventory, migrationMap) {
  assert.equal(inventory.program, "backend_go_convergence_program", "inventory_program_mismatch");
  assert.equal(migrationMap.program, "backend_go_convergence_program", "migration_map_program_mismatch");
  assert.deepEqual(inventory.requiredRiskTags, requiredRiskTags, "required_risk_tags_mismatch");

  const activeFiles = (await Promise.all(activeRoots.map((root) => listMjsFiles(root)))).flat().sort();
  const inventoryPaths = riskInventoryEntries(inventory).map((entry) => entry.path).sort();
  assert.deepEqual(inventoryPaths, activeFiles, "inventory_must_cover_active_node_backend_files");

  const inventoryEntries = riskInventoryEntries(inventory);
  const migratedPaths = new Set(migrationMap.nodes.flatMap((node) => node.sourcePaths || []));
  for (const tag of requiredRiskTags) {
    const taggedPaths = inventoryEntries.filter((entry) => entry.riskTags.includes(tag)).map((entry) => entry.path);
    assert(taggedPaths.length > 0, `required_risk_tag_has_no_paths:${tag}`);
    for (const repoPath of taggedPaths) {
      assert(migratedPaths.has(repoPath), `risk_path_must_have_migration_node:${tag}:${repoPath}`);
    }
  }
}

async function assertPortalLongTaskBoundaries(inventory, migrationMap) {
  const launchSource = await readRepoFile("services/portal/src/services/opl-launch.service.mjs");
  assert.match(launchSource, /const\s+launchStatuses\s*=\s*new\s+Map\s*\(/u, "portal_launch_status_map_not_visible");
  for (const marker of ["createLaunchIntent", "getLaunchStatus", "updateLaunchStage", "completeLaunchIntent", "failLaunchIntent"]) {
    assertIncludes(launchSource, marker, `portal_launch_state_api_not_visible:${marker}`);
  }
  assertRiskPathBound({
    inventory,
    migrationMap,
    repoPath: "services/portal/src/services/opl-launch.service.mjs",
    riskTag: "memory_launch_truth",
    nodeId: "portal.opl_launch_service",
  });
  const launchNode = migrationMap.nodes.find((node) => node.id === "portal.opl_launch_service");
  assert(launchNode.truthBoundary.includes("launch_status_store"), "portal_launch_node_must_target_launch_status_store");
  assertNodeHasSecretBoundary(launchNode, ["rawApiKey", "launchToken", "runtimeToken"]);

  const cloudRouteSource = await readRepoFile("services/portal/src/routes/portal-api-v22-cloud-operations.routes.mjs");
  assert.match(cloudRouteSource, /executePortalProductionCloudOperation/u, "portal_cloud_route_direct_mutation_not_visible");
  for (const marker of ["secretFile", "runnerScript", "computeNodePoolRef"]) {
    assertIncludes(cloudRouteSource, marker, `portal_cloud_route_runtime_wiring_not_visible:${marker}`);
  }
  assertRiskPathBound({
    inventory,
    migrationMap,
    repoPath: "services/portal/src/routes/portal-api-v22-cloud-operations.routes.mjs",
    riskTag: "cloud_mutation",
    nodeId: "portal.cloud_operation_service",
  });
  const cloudNode = migrationMap.nodes.find((node) => node.id === "portal.cloud_operation_service");
  assert.deepEqual(cloudNode.asyncBoundary, ["command_handler", "operation_repository", "worker_executor", "projection_reader"], "cloud_node_async_boundary_mismatch");
  assert.equal(cloudNode.ledgerOwner, "internal/repository/billing", "cloud_node_ledger_owner_mismatch");

  const cloudProductionSource = await readRepoFile("services/portal/src/domain/portal-cloud-operation-production.mjs");
  for (const marker of ["weeklyProtectionFreezes", "billingReconciliations", "ledger", "appendLedger", "appendBillingReconciliation", "auditQueueRef", "sourceType: \"cloud_operation\""]) {
    assertIncludes(cloudProductionSource, marker, `portal_cloud_production_marker_not_visible:${marker}`);
  }
  assertRiskPathBound({
    inventory,
    migrationMap,
    repoPath: "services/portal/src/domain/portal-cloud-operation-production.mjs",
    riskTag: "billing_audit_aggregation",
    nodeId: "portal.cloud_operation_service",
  });

  const runtimeSecretSource = await readRepoFile("services/opl-runtime-bridge/src/provider-secret-store.mjs");
  const runtimeLaunchSource = await readRepoFile("services/opl-runtime-bridge/src/runtime-bridge-launch.mjs");
  const runtimeStateStoreSource = await readRepoFile("services/opl-runtime-bridge/src/state-store.mjs");
  for (const marker of ["apiKey", "experimental_bearer_token", "config.toml", "codexHome"]) {
    assertIncludes(runtimeSecretSource, marker, `runtime_secret_materialization_marker_not_visible:${marker}`);
  }
  for (const marker of ["writeProviderSecret", "apiKey", "providerConfigSecretRef", "secretFingerprint", "launchToken", "state.launchTokens.push"]) {
    assertIncludes(runtimeLaunchSource, marker, `runtime_launch_secret_or_token_marker_not_visible:${marker}`);
  }
  assertIncludes(runtimeStateStoreSource, "launchTokens: []", "runtime_state_store_launch_tokens_not_visible");

  const requiredSecretBoundaries = new Map([
    ["portal.opl_launch_service", ["rawApiKey", "launchToken", "runtimeToken"]],
    ["portal.account_provider_binding", ["rawApiKey", "bearerToken"]],
    ["runtimebridge.launch_service", ["rawApiKey", "launchToken", "runtimeToken", "codexHomePath"]],
    ["runtimebridge.message_service", ["rawApiKey", "runtimeToken", "secretFilePath"]],
    ["runtimebridge.run_service", ["rawApiKey", "runtimeToken", "objectKey", "localPath"]],
    ["runtimebridge.secret_store", ["rawApiKey", "bearerToken", "secretFilePath", "codexHomePath"]],
  ]);
  for (const [nodeId, expectedFields] of requiredSecretBoundaries) {
    const node = migrationMap.nodes.find((item) => item.id === nodeId);
    assert(node, `required_secret_node_missing:${nodeId}`);
    assertNodeHasSecretBoundary(node, expectedFields);
  }
}

async function assertNodePortalFacadeBoundary() {
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

  for (const marker of ["createPortalWorkflowFacade", "submitCommand", "runOplLaunchCommand", "runCloudOperationCommand", "pending", "running", "succeeded", "failed"]) {
    assertIncludes(facadeSource, marker, `portal_workflow_facade_marker_missing:${marker}`);
  }
  assertNotIncludes(facadeSource, "Temporal", "node_portal_facade_must_not_claim_temporal_engine");
  assertNotIncludes(facadeSource, "fake success", "node_portal_facade_must_not_fake_success");
  assertNotIncludes(facadeSource, "fake_success", "node_portal_facade_must_not_fake_success");
  assertNotIncludes(facadeSource, "ok: true, result", "node_portal_facade_must_not_wrap_failures_as_success");

  for (const [name, source] of [["opl_routes", oplRoutesSource], ["auth_runtime_handler", authRuntimeHandlerSource]]) {
    assertIncludes(source, "workflowFacade", `${name}_must_accept_workflow_facade`);
    assertIncludes(source, "runOplLaunchCommand", `${name}_must_route_opl_launch_through_facade`);
  }
  assertIncludes(cloudOperationsRoutesSource, "workflowFacade", "cloud_operations_routes_must_accept_workflow_facade");
  assertIncludes(cloudOperationsRoutesSource, "runCloudOperationCommand", "cloud_operations_routes_must_route_cloud_mutation_through_facade");
  for (const marker of ["node_lab_api_retired", "sendRetiredNodeLabApi", "410"]) {
    assertIncludes(labPackageRoutesSource, marker, `node_lab_routes_must_fail_closed_retired:${marker}`);
  }
  for (const marker of ["workflowFacade", "runCloudOperationCommand", "source: \"lab_packages\"", "currentPackageId: subscription?.packageId", "...subscriptionPayload(db, user, result.subscription"]) {
    assertNotIncludes(labPackageRoutesSource, marker, `node_lab_routes_must_not_serve_business_truth:${marker}`);
  }
  for (const [name, source] of [["portal_runtime", portalRuntimeSource], ["feature_runtime_handlers", featureRuntimeHandlersSource], ["api_runtime_handlers", apiRuntimeHandlersSource], ["portal_api_routes", portalApiRoutesSource]]) {
    assertIncludes(source, "workflowFacade", `${name}_must_wire_single_workflow_facade`);
  }
  assertIncludes(portalRuntimeSource, "createPortalWorkflowFacade", "portal_runtime_must_create_facade_once");
  assert.match(portalRuntimeSource, /const\s+workflowFacade\s*=\s*createPortalWorkflowFacade/u, "portal_runtime_must_have_single_facade_instance");
  for (const marker of ["runtimeBridgeClient.requestRuntimeBridgeApi", "targetPath: \"/api/opl/bootstrap\"", "targetPath: \"/api/opl/messages\"", "targetPath: \"/api/opl/files\"", "targetPath: \"/api/opl/runs\""]) {
    assertIncludes(oplRoutesSource, marker, `portal_runtime_proxy_must_remain_thin:${marker}`);
  }
  for (const marker of ["workflowId", "workflowExecutionId", "commandId: result.commandId"]) {
    assertNotIncludes(oplRoutesSource, marker, `opl_launch_public_payload_must_not_expose_workflow_marker:${marker}`);
  }
}

const [inventory, migrationMap] = await Promise.all([
  readJson(inventoryPath),
  readJson(migrationMapPath),
]);

await assertPortalRiskInventory(inventory, migrationMap);
await assertPortalLongTaskBoundaries(inventory, migrationMap);
await assertNodePortalFacadeBoundary();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_node_portal_workflow_facade_boundary",
  facade: "services/portal/src/services/portal-workflow-facade.service.mjs",
  durableEngine: "behind_facade_future_replacement",
}, null, 2));
