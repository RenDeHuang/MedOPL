import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readRepoJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, marker, label) {
  assert(String(source).includes(marker), `${label}_missing:${marker}`);
}

function assertNotIncludes(source, marker, label) {
  assert.equal(String(source).includes(marker), false, `${label}_forbidden:${marker}`);
}

function assertNotMatches(source, pattern, label) {
  assert.equal(pattern.test(String(source)), false, label);
}

async function assertNodeBackendRetiredFromDeployableSurface() {
  const packageJson = JSON.parse(await readRepoFile("services/portal/package.json"));
  const scripts = packageJson.scripts ?? {};
  const dependencies = packageJson.dependencies ?? {};
  assertNotIncludes(scripts.start ?? "", "src/server.mjs", "portal_root_start_must_not_launch_node_backend");
  assertNotIncludes(scripts.check ?? "", "src/server.mjs", "portal_root_check_must_not_check_node_backend_entry");
  assertNotIncludes(scripts["migrate:schema"] ?? "", "src/migrate-schema.mjs", "portal_root_migrate_must_not_keep_node_schema_entry");
  for (const dependency of ["cos-nodejs-sdk-v5", "pg", "redis", "tencentcloud-sdk-nodejs"]) {
    assert.equal(Object.hasOwn(dependencies, dependency), false, `portal_root_backend_dependency_must_be_retired:${dependency}`);
  }

  const viteConfig = await readRepoFile("services/portal/frontend/vite.config.ts");
  assertIncludes(viteConfig, "goControlPlaneTarget", "vite_must_keep_go_control_plane_target");
  assertIncludes(viteConfig, '"/api": goControlPlaneTarget', "vite_must_proxy_api_to_go_backend");
  for (const marker of [
    "portalBackendTarget",
    "VITE_PORTAL_BACKEND_URL",
    '"/portal/api"',
    '"/portal/admin"',
    '"/login"',
    '"/register"',
    '"/auth"',
    '"/opl/entry/preflight"',
  ]) {
    assertNotIncludes(viteConfig, marker, "vite_must_not_proxy_node_portal_backend");
  }

  const apiClient = await readRepoFile("services/portal/frontend/src/api/client.ts");
  assertIncludes(apiClient, "goControlPlaneClient", "frontend_client_must_keep_go_api_client");
  assertNotIncludes(apiClient, "apiClient", "frontend_client_must_not_export_node_portal_client");
  assertNotIncludes(apiClient, "/portal/api", "frontend_client_must_not_name_node_portal_api");

  for (const file of [
    "services/portal/frontend/src/api/portal/overview.ts",
    "services/portal/frontend/src/api/portal/workspace.ts",
    "services/portal/frontend/src/api/portal/commercial.ts",
    "services/portal/frontend/src/api/portal/sessions.ts",
    "services/portal/frontend/src/api/portal/traces.ts",
    "services/portal/frontend/src/api/portal/admin.ts",
    "services/portal/frontend/src/api/portal/public.ts",
    "services/portal/frontend/src/api/portal/server-plans.ts",
  ]) {
    const source = await readRepoFile(file);
    assertNotIncludes(source, "apiClient", `frontend_portal_module_must_use_go_client:${file}`);
    assertNotIncludes(source, "/portal/api", `frontend_portal_module_must_not_name_node_api:${file}`);
  }
}

async function assertProductComposeIsPostgresOnlyRequiredDataPlane() {
  const compose = JSON.parse(await readRepoFile("compose.product.yaml"));
  assert.equal(Object.hasOwn(compose.services ?? {}, "redis"), false, "product_compose_must_not_require_redis_service");
  assert.equal(Object.hasOwn(compose.volumes ?? {}, "redis-data"), false, "product_compose_must_not_keep_redis_volume");
  for (const serviceName of ["portal", "portal-dev"]) {
    const service = compose.services?.[serviceName];
    assert(service, `product_compose_missing:${serviceName}`);
    assert.equal(service.environment?.PORTAL_STORAGE_MODE, "postgres", `${serviceName}_storage_mode_must_be_postgres_only`);
    assert.equal(Object.hasOwn(service.environment ?? {}, "PORTAL_REDIS_URL"), false, `${serviceName}_must_not_require_redis_url`);
    assert.equal(Object.hasOwn(service.depends_on ?? {}, "redis"), false, `${serviceName}_must_not_depend_on_redis`);
    assert.equal(Object.hasOwn(service.depends_on ?? {}, "postgres"), true, `${serviceName}_must_depend_on_postgres`);
  }
}

async function assertProductAuthorityContractsOwnPrecloudEvidence() {
  const [product, api, dataPlane, billing, release, cloud] = await Promise.all([
    readRepoJson("contracts/medopl-product-profile.json"),
    readRepoJson("contracts/medopl-api-contract.json"),
    readRepoJson("contracts/medopl-data-plane-contract.json"),
    readRepoJson("contracts/medopl-billing-ledger-contract.json"),
    readRepoJson("contracts/medopl-release-boundary.json"),
    readRepoJson("contracts/medopl-cloud-boundary.json"),
  ]);

  assert.equal(product.authority_boundary.change_package_role, "not_product_authority", "product_contract_must_retire_change_package_authority");
  assertIncludes(product.medopl_product_profile.platform_responsibilities.join("\n"), "provision", "product_contract_precloud_authority");
  assertIncludes(product.medopl_product_profile.platform_responsibilities.join("\n"), "release", "product_contract_precloud_authority");

  for (const group of ["workspace", "runtime", "files", "billing", "audit", "release"]) {
    assert(api.medopl_api_contract.api_groups.includes(group), `api_contract_precloud_group_missing:${group}`);
  }
  for (const field of ["raw_provider_key", "bearer_token", "runtime_token", "launch_token", "kubeconfig_content"]) {
    assert(api.medopl_api_contract.forbidden_response_fields.includes(field), `api_contract_secret_boundary_missing:${field}`);
  }

  for (const control of ["tenant_scope", "workspace_scope", "quota_metering", "audit_event", "release_cleanup"]) {
    assert(dataPlane.medopl_data_plane_contract.required_controls.includes(control), `data_plane_contract_precloud_control_missing:${control}`);
  }
  assert(
    dataPlane.medopl_data_plane_contract.required_controls.includes("explicit_storage_destroy_intent"),
    "data_plane_contract_precloud_storage_destroy_intent_missing",
  );
  assert(
    dataPlane.medopl_data_plane_contract.required_receipts?.includes("storage_destroy_receipt"),
    "data_plane_contract_precloud_storage_destroy_receipt_missing",
  );
  for (const type of ["credit", "debit", "hold", "release", "refund", "adjustment"]) {
    assert(billing.medopl_billing_ledger_contract.ledger_entry_types.includes(type), `billing_contract_ledger_type_missing:${type}`);
  }
  for (const phase of ["freeze_runtime", "settle_billing", "export_files", "cleanup_resources", "write_receipt"]) {
    assert(release.medopl_release_boundary.release_phases.includes(phase), `release_contract_precloud_phase_missing:${phase}`);
  }
  assert.equal(
    release.authority_boundary.default_real_cloud_mutation,
    "allowed_when_authorization_pack_is_active",
    "release_contract_must_use_machine_authorization_pack",
  );
  assert.equal(
    release.authority_boundary.authorization_pack,
    "contracts/medopl-cloud-authorization-pack.json",
    "release_contract_must_point_to_cloud_authorization_pack",
  );
  assert.equal(
    cloud.authority_boundary.default_real_cloud_execution,
    "allowed_when_authorization_pack_is_active",
    "cloud_contract_must_use_machine_authorization_pack",
  );
  assert.equal(
    cloud.authority_boundary.authorization_pack,
    "contracts/medopl-cloud-authorization-pack.json",
    "cloud_contract_must_point_to_cloud_authorization_pack",
  );
}

async function assertGoPrecloudSurface() {
  const router = await readRepoFile("services/medopl-go-backend/internal/server/router.go");
  for (const marker of [
    'GET("/healthz"',
    'GET("/readyz"',
    'GET("/api/cloud/connector/status"',
    'POST("/api/cloud/connector/plan"',
    'GET("/api/me"',
    'GET("/api/overview"',
    'GET("/api/workspace"',
    'POST("/api/workspace/files/upload-url"',
    'GET("/api/workspace/files/download-url"',
    'POST("/api/workspace/files/local-transfer"',
    'GET("/api/workspace/files/local-transfer"',
    'GET("/api/session-traces"',
    'GET("/api/announcements"',
  ]) {
    assertIncludes(router, marker, `go_router_precloud_surface:${marker}`);
  }
  const cloudConnector = await readRepoFile("services/medopl-go-backend/internal/server/handlers/cloud_connector.go");
  for (const marker of ["authorization_required", "fail_closed", "real-cloud authorization package"]) {
    assertIncludes(cloudConnector, marker, `go_cloud_connector_fail_closed:${marker}`);
  }
  assertNotMatches(cloudConnector, /tencentcloud|cos-nodejs|kubectl|SecretId|SecretKey|kubeconfig/u, "go_cloud_connector_must_not_call_real_cloud_or_store_secret");
}

async function assertTruthAndEvalRegistration() {
  const sourceSpec = await readRepoFile("specs/source/spec.md");
  const runtimeSpec = await readRepoFile("specs/runtime/spec.md");
  const operationsSpec = await readRepoFile("specs/operations/spec.md");
  assertIncludes(sourceSpec, "source:node-portal-backend-deployment-retirement", "source_spec_precloud_requirement");
  assertIncludes(runtimeSpec, "runtime:precloud-deployable-rc", "runtime_spec_precloud_requirement");
  assertIncludes(operationsSpec, "operations:cloud-connector-fail-closed-precloud", "operations_spec_precloud_requirement");

  const sourceTruth = await readRepoFile("docs/source/README.md");
  assertIncludes(sourceTruth, "Node Portal backend is not a deployable control plane", "source_truth_precloud_node_retirement");
  assertIncludes(sourceTruth, "services/medopl-go-backend", "source_truth_precloud_go_owner");
  assertNotIncludes(sourceTruth, "temporary shell", "source_truth_must_not_keep_node_temporary_shell_as_current");

  const manifest = await readRepoFile("tests/fixtures/v22/agent-verify-manifest.json");
  const registry = await readRepoFile("scripts/v22-test-classification.mjs");
  assertIncludes(manifest, "precloud-deployable-rc", "manifest_precloud_branch_override");
  assertIncludes(manifest, "contract-test-v22-precloud-deployable-rc.mjs", "manifest_precloud_eval");
  assertIncludes(registry, "contract-test-v22-precloud-deployable-rc.mjs", "test_registry_precloud_eval");
}

await assertProductAuthorityContractsOwnPrecloudEvidence();
await assertNodeBackendRetiredFromDeployableSurface();
await assertProductComposeIsPostgresOnlyRequiredDataPlane();
await assertGoPrecloudSurface();
await assertTruthAndEvalRegistration();

console.log(JSON.stringify({
  ok: true,
  contract: "v22_precloud_deployable_rc",
  canClaim: [
    "local pre-cloud Go backend is the deployable SaaS backend surface",
    "Portal frontend uses Go /api for typed product projections",
    "Cloud connector fails closed until real-cloud authorization",
  ],
}, null, 2));
