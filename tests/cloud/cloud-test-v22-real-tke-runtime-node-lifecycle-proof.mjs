import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const authPack = JSON.parse(readFileSync(path.join(repoRoot, "contracts/medopl-cloud-authorization-pack.json"), "utf8"));
const runnerSource = readFileSync(path.join(repoRoot, "tests/support/cloud-prework/production-goal-command-runner.mjs"), "utf8");
const realTkeSupportSource = readFileSync(path.join(repoRoot, "tests/support/cloud-prework/lib/real-tke-runtime-node-lifecycle-support.js"), "utf8");
const executorSource = readFileSync(path.join(repoRoot, "scripts/v22-cloud-authorized-executor.mjs"), "utf8");
const configSupportSource = readFileSync(path.join(repoRoot, "tests/support/cloud-prework/lib/production-goal-command-config-support.js"), "utf8");
const productionGoalExecutorSource = readFileSync(path.join(repoRoot, "tests/support/cloud-prework/cloud-authorized-production-goal-executor.js"), "utf8");
const cloudRolloutWorkflowSource = readFileSync(path.join(repoRoot, ".github/workflows/cloud-rollout.yml"), "utf8");

const operationClasses = authPack.active_pack.operation_classes;
assert(
  operationClasses.includes("real_tke_runtime_node_lifecycle"),
  "auth_pack_must_expose_real_tke_runtime_node_lifecycle_operation",
);

const realLifecycleMapping = authPack.active_pack.operation_class_command_map.find(
  (entry) => entry.operation_class === "real_tke_runtime_node_lifecycle",
);
assert(realLifecycleMapping, "auth_pack_must_map_real_tke_runtime_node_lifecycle");
assert.equal(
  realLifecycleMapping.runner_id,
  "tencent_tke_real_runtime_node_lifecycle_runner",
  "real_tke_lifecycle_runner_id_mismatch",
);
assert.deepEqual(
  realLifecycleMapping.receipt_types,
  ["runtime_owner_receipt"],
  "real_tke_lifecycle_must_own_runtime_receipt",
);
assert.deepEqual(
  realLifecycleMapping.commands,
  ["npm run cloud:goal -- --operation real_tke_runtime_node_lifecycle"],
  "real_tke_lifecycle_must_use_single_cloud_goal_entrypoint",
);

assert(
  authPack.active_pack.api_allowlist.includes("tencentcloud:tke_real_node_pool_lifecycle"),
  "auth_pack_must_allow_real_tke_node_pool_lifecycle_api_scope",
);
assert.deepEqual(
  authPack.active_pack.api_allowlist_mapping.real_tke_runtime_node_lifecycle,
  ["tencentcloud:tke_real_node_pool_lifecycle"],
  "real_tke_lifecycle_api_mapping_mismatch",
);
assert.deepEqual(
  authPack.active_pack.secret_allowlist_mapping.real_tke_runtime_node_lifecycle,
  ["TENCENT_MUTATION_SECRET_ID", "TENCENT_MUTATION_SECRET_KEY"],
  "real_tke_lifecycle_secret_mapping_mismatch",
);

for (const source of [executorSource, configSupportSource, productionGoalExecutorSource]) {
  assert(
    source.includes("real_tke_runtime_node_lifecycle"),
    "real_tke_lifecycle_operation_must_be_registered_in_executor_config_and_adapter",
  );
}

assert(
  runnerSource.includes("runRealTkeRuntimeNodeLifecycleCommand") && realTkeSupportSource.includes("runRealTkeRuntimeNodeLifecycle"),
  "production_goal_runner_must_implement_real_tke_runtime_node_lifecycle",
);
assert(
  realTkeSupportSource.includes("CreateClusterNodePool") || realTkeSupportSource.includes("CreateNodePool") || realTkeSupportSource.includes("CreateClusterInstances"),
  "real_tke_lifecycle_must_call_provider_create_or_scale_api",
);
assert(
  realTkeSupportSource.includes("tierRequest(plan, useNativeNodePool ? \"createNativeNodePool\" : \"createClusterNodePool\", \"starter_2c4g_10gb\"")
    && realTkeSupportSource.includes("tierRequest(plan, useNativeNodePool ? \"createNativeNodePool\" : \"createClusterNodePool\", \"pro_8c16g_100gb\""),
  "real_tke_lifecycle_must_require_provider_create_request_per_plan_tier",
);
assert(
  realTkeSupportSource.includes("nodePoolNodeTotal") && realTkeSupportSource.includes("requireNodeTotal"),
  "real_tke_lifecycle_must_observe_real_node_count_before_accepting_runtime_receipt",
);
assert(
  realTkeSupportSource.includes("DeleteClusterNodePool") || realTkeSupportSource.includes("DeleteNodePool") || realTkeSupportSource.includes("DeleteClusterInstances"),
  "real_tke_lifecycle_must_call_provider_destroy_or_release_api",
);
assert(
  realTkeSupportSource.includes("realProviderMutationExecuted"),
  "real_tke_lifecycle_receipt_must_report_real_provider_mutation",
);
assert(
  realTkeSupportSource.includes("starter_2c4g_10gb") && realTkeSupportSource.includes("pro_8c16g_100gb"),
  "real_tke_lifecycle_must_cover_starter_and_pro_plan_tiers",
);
assert(
  realTkeSupportSource.includes("ModifyNodePoolInstanceTypes") || realTkeSupportSource.includes("ModifyNodePool") || realTkeSupportSource.includes("modifyNodePoolInstanceTypes"),
  "real_tke_lifecycle_must_cover_real_instance_type_upgrade_path",
);
assert(
  realTkeSupportSource.includes("deriveRealTkePlanFromClusterFoundation") &&
    realTkeSupportSource.includes("pickZone") &&
    realTkeSupportSource.includes("DescribeImages") &&
    realTkeSupportSource.includes("validateSecurityGroup"),
  "real_tke_lifecycle_must_support_cluster_foundation_plan_derivation",
);
assert(
  realTkeSupportSource.includes("DescribeSecurityGroups") &&
    !realTkeSupportSource.includes("DescribeSubnets"),
  "cluster_foundation_default_must_not_require_vpc_subnet_permission",
);
assert(
  realTkeSupportSource.includes("production_goal_real_tke_platform_node_pool_not_found") &&
    realTkeSupportSource.includes("candidateNodePools"),
  "real_tke_lifecycle_must_fail_closed_on_stale_platform_node_pool_with_candidates",
);
assert(
  realTkeSupportSource.includes("try {") && realTkeSupportSource.includes("finally") && realTkeSupportSource.includes("createdNodePoolIds"),
  "real_tke_lifecycle_must_cleanup_created_node_pools_on_failure",
);
assert(
  realTkeSupportSource.includes("cleanupVerified") && realTkeSupportSource.includes("nodePoolDestroyed"),
  "real_tke_lifecycle_must_verify_cleanup_before_accepting_receipt",
);

assert.equal(
  /real_tke_runtime_node_lifecycle[\s\S]*status:\s*"accepted"[\s\S]*(?:DescribeClusterNodePools|DescribeClusters)[\s\S]*realProviderMutationExecuted:\s*false/u.test(realTkeSupportSource),
  false,
  "describe_only_observation_must_not_be_accepted_as_real_tke_lifecycle",
);

assert(
  cloudRolloutWorkflowSource.includes("real_tke_node_lifecycle_plan_json") &&
    cloudRolloutWorkflowSource.includes("inputs.real_tke_node_lifecycle_plan_json") &&
    cloudRolloutWorkflowSource.includes("vars.TENCENT_REAL_TKE_NODE_LIFECYCLE_PLAN_JSON"),
  "cloud_rollout_must_allow_per_dispatch_real_tke_plan_without_mutating_persistent_vars",
);
