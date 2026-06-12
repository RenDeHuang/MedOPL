#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FORBIDDEN_ARGS = new Set([
  "--secret-file",
  "--live",
  "--execute",
  "--apply",
  "--mutate",
  "--deploy",
  "--kubectl",
  "--build",
  "--push",
]);

const REQUIRED_ENV_FIELDS = Object.freeze([
  "TENCENT_MUTATION_TKE_CLUSTER_ID",
  "TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID",
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: false,
    confirmNoRealCloud: false,
    reportDir: path.join(".runtime", "v22-cloud-bootstrap"),
    operationId: "",
    region: "",
    vpcId: "",
    platformNodePoolName: "",
    tenantNodePoolNamePrefix: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_ARGS.has(arg)) throw new Error(`tke_bootstrap_preflight_forbidden_arg:${arg}`);
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--confirm-no-real-cloud") {
      options.confirmNoRealCloud = true;
    } else if (arg === "--report-dir") {
      options.reportDir = argv[++index] || "";
    } else if (arg === "--operation-id") {
      options.operationId = argv[++index] || "";
    } else if (arg === "--region") {
      options.region = argv[++index] || "";
    } else if (arg === "--vpc-id") {
      options.vpcId = argv[++index] || "";
    } else if (arg === "--platform-node-pool-name") {
      options.platformNodePoolName = argv[++index] || "";
    } else if (arg === "--tenant-node-pool-name-prefix") {
      options.tenantNodePoolNamePrefix = argv[++index] || "";
    } else {
      throw new Error(`tke_bootstrap_preflight_unknown_arg:${arg}`);
    }
  }

  return options;
}

function requireValue(options, key) {
  if (!String(options[key] || "").trim()) throw new Error(`tke_bootstrap_preflight_missing:${key}`);
}

function validate(options) {
  if (!options.dryRun || !options.confirmNoRealCloud) {
    throw new Error("tke_bootstrap_preflight_authorization_required");
  }
  for (const key of [
    "reportDir",
    "operationId",
    "region",
    "vpcId",
    "platformNodePoolName",
    "tenantNodePoolNamePrefix",
  ]) {
    requireValue(options, key);
  }
}

function planFor(options) {
  return {
    ok: true,
    planMode: "dry_run",
    operationId: options.operationId,
    productionReady: false,
    boundary: {
      realCloudCalls: false,
      mutationExecuted: false,
      readsSecret: false,
      callsKubectl: false,
      deploysWorkload: false,
      buildsOrPushesImage: false,
      createsOrDeletesResources: false,
    },
    target: {
      provider: "tencent_cloud",
      region: options.region,
      vpcId: options.vpcId,
      clusterModel: "unified_tke_cluster_with_tenant_node_pools",
      firstCanaryRequiresTenantNodePool: true,
    },
    topology: {
      tke: {
        requiredClusterCount: 1,
        sharedUserComputePoolRequired: false,
        premiumDedicatedPoolRequired: false,
        nodePools: [
          {
            id: "platform_service_pool",
            name: options.platformNodePoolName,
            purpose: "Portal, Gateway, Runtime Bridge, worker and platform services",
            requiredForFirstCanary: true,
            workloadPolicy: "platform_only",
          },
          {
            id: "tenant_node_pool_template",
            namePrefix: options.tenantNodePoolNamePrefix,
            purpose: "dedicated tenant or workspace runtime workload node pools created by Package C",
            requiredForFirstCanary: false,
            workloadPolicy: "tenant_workspace_dedicated_only",
            createdDuringPackageC: true,
          },
        ],
      },
      kubernetesControls: [
        "namespace",
        "rbac",
        "resourcequota",
        "limitrange",
        "networkpolicy",
        "pod_security",
        "admission_policy",
        "taints_and_tolerations",
        "node_selector",
        "labels",
      ],
      dataPlane: {
        requiredStores: ["PostgreSQL", "COS", "CBS"],
        optionalStores: [],
        redisRequired: false,
        canonicalStore: "PostgreSQL",
        objectStorage: "COS",
        nodeOrVolumeStorage: "CBS",
      },
      costAndAudit: {
        requiredTags: [
          "medopl:tenant",
          "medopl:account",
          "medopl:workspace",
          "medopl:resourceBinding",
          "medopl:billingAttribution",
          "medopl:operation",
        ],
        costAllocationRequired: true,
      },
    },
    nextUserActions: [
      "Create or select VPC and private subnets in the target region.",
      "Create one TKE cluster with a platform service node pool only.",
      "Leave tenant node pools to Package C tenant or workspace lifecycle execution.",
      "Create or bind PostgreSQL, COS and CBS according to the production topology contract.",
      "Fill TENCENT_MUTATION_TKE_CLUSTER_ID and TENCENT_MUTATION_TKE_PLATFORM_SERVICE_NODE_POOL_ID after readonly inventory observes them.",
    ],
    requiredMutationEnvFields: [...REQUIRED_ENV_FIELDS],
    requiredAuthorizationBeforeNextStep: "explicit_package_c_live_mutation_authorization",
  };
}

async function main() {
  const options = parseArgs();
  validate(options);
  const report = planFor(options);
  await mkdir(options.reportDir, { recursive: true });
  const reportPath = path.join(options.reportDir, `${options.operationId}-preflight.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    planMode: "dry_run",
    operationId: options.operationId,
    reportPath,
    realCloudCalls: false,
    mutationExecuted: false,
    readsSecret: false,
    callsKubectl: false,
    deploysWorkload: false,
    buildsOrPushesImage: false,
    productionReady: false,
    requiredMutationEnvFields: [...REQUIRED_ENV_FIELDS],
  }, null, 2));
}

main().catch((error) => {
  console.error(String(error?.message || "tke_bootstrap_preflight_failed"));
  process.exitCode = 1;
});
