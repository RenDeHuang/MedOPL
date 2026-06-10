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
  "TENCENT_MUTATION_TKE_NODE_POOL_ID",
]);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: false,
    confirmNoRealCloud: false,
    reportDir: path.join(".runtime", "v22-cloud-bootstrap"),
    operationId: "",
    region: "",
    vpcId: "",
    standardNodePoolName: "",
    systemNodePoolName: "",
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
    } else if (arg === "--standard-node-pool-name") {
      options.standardNodePoolName = argv[++index] || "";
    } else if (arg === "--system-node-pool-name") {
      options.systemNodePoolName = argv[++index] || "";
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
    "standardNodePoolName",
    "systemNodePoolName",
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
      clusterModel: "shared_cluster_layered_isolation",
      firstCanaryRequiresPremiumPool: false,
    },
    topology: {
      tke: {
        requiredClusterCount: 1,
        nodePools: [
          {
            id: "platform_service_pool",
            name: options.systemNodePoolName,
            purpose: "Portal, Gateway, Runtime Bridge, worker and platform services",
            requiredForFirstCanary: true,
            workloadPolicy: "platform_only",
          },
          {
            id: "shared_user_compute_pool",
            name: options.standardNodePoolName,
            purpose: "standard workspace runtime workload with hard namespace isolation",
            requiredForFirstCanary: true,
            workloadPolicy: "shared_user_compute_only",
          },
          {
            id: "premium_dedicated_pool_future",
            name: "medopl-premium-dedicated-future",
            purpose: "paid premium isolation capacity after baseline canary",
            requiredForFirstCanary: false,
            workloadPolicy: "dedicated_user_compute_only",
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
      "Create one TKE cluster with separate platform service and shared user compute node pools.",
      "Keep premium dedicated pool as a later paid isolation phase, not required for the first canary.",
      "Create or bind PostgreSQL, COS and CBS according to the production topology contract.",
      "Fill TENCENT_MUTATION_TKE_CLUSTER_ID and TENCENT_MUTATION_TKE_NODE_POOL_ID after readonly inventory observes them.",
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
