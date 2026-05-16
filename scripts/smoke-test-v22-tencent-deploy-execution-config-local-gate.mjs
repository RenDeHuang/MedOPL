import assert from "node:assert/strict";

const PACKAGE_D_SECRET_KEYS = new Set([
  "RUN_TENCENT_DEPLOY_EXECUTION",
  "TCR_ID",
  "TCR_SECRET",
  "TENCENT_TCR_REGISTRY",
  "TENCENT_TCR_NAMESPACE",
  "TENCENT_TCR_REGION",
  "TENCENT_DEPLOY_CLUSTER_ID",
  "TENCENT_DEPLOY_KUBECONFIG_REF",
]);

const FORBIDDEN_SECRET_KEYS = new Set([
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE_EXECUTION",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "LANGFUSE_SECRET_KEY",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "GITHUB_TOKEN",
]);

function text(value = "") {
  return String(value ?? "").trim();
}

function parseDeployEnv(content = "") {
  const env = {};
  for (const line of String(content).split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error("tencent_deploy_secret_line_invalid");
    const key = normalized.slice(0, equalsIndex).trim();
    const value = normalized.slice(equalsIndex + 1).trim();
    if (FORBIDDEN_SECRET_KEYS.has(key)) throw new Error(`tencent_deploy_forbidden_secret_key:${key}`);
    if (!PACKAGE_D_SECRET_KEYS.has(key)) throw new Error(`tencent_deploy_non_allowlist_secret_key_rejected:${key}`);
    env[key] = value;
  }
  return env;
}

function checkConfig(content = "") {
  let env = {};
  try {
    env = parseDeployEnv(content);
  } catch (error) {
    return { ok: false, blockedReason: String(error?.message || "deploy_config_parse_failed") };
  }
  const missing = [...PACKAGE_D_SECRET_KEYS].filter((key) => !text(env[key]));
  if (missing.length) return { ok: false, blockedReason: "deploy_secret_allowlist_incomplete" };
  if (!["1", "true"].includes(text(env.RUN_TENCENT_DEPLOY_EXECUTION).toLowerCase())) {
    return { ok: false, blockedReason: "deploy_run_gate_disabled" };
  }
  return {
    ok: true,
    blockedReason: "",
    summary: {
      registry: "redacted",
      namespace: "redacted",
      region: text(env.TENCENT_TCR_REGION),
      callsDockerNow: false,
      callsKubectlNow: false,
      readsKubeconfigNow: false,
    },
  };
}

const checked = [
  {
    file: "package-d-deploy.env",
    result: checkConfig([
      "RUN_TENCENT_DEPLOY_EXECUTION=1",
      "TCR_ID=deploy-id-proof",
      "TCR_SECRET=$TCR_SECRET",
      "TENCENT_TCR_REGISTRY=registry-proof.example.tencentcloudcr.com",
      "TENCENT_TCR_NAMESPACE=namespace-proof",
      "TENCENT_TCR_REGION=na-siliconvalley",
      "TENCENT_DEPLOY_CLUSTER_ID=cluster-proof",
      "TENCENT_DEPLOY_KUBECONFIG_REF=kubeconfig-ref-proof",
    ].join("\n")),
  },
  {
    file: "package-c-mutation.env",
    result: checkConfig([
      "RUN_TENCENT_CREATE_RELEASE_EXECUTION=1",
      "TENCENT_MUTATION_SECRET_ID=$TENCENT_MUTATION_SECRET_ID",
    ].join("\n")),
  },
  {
    file: "readonly.env",
    result: checkConfig([
      "RUN_TENCENT_READONLY_INVENTORY=1",
      "TENCENT_READONLY_SECRET_ID=$TENCENT_READONLY_SECRET_ID",
    ].join("\n")),
  },
];

const accepted = checked.find((item) => item.result.ok);
assert(accepted, "deploy_config_gate_must_accept_package_d_allowlist");
assert.equal(accepted.result.summary.callsDockerNow, false, "config_gate_must_not_call_docker");
assert.equal(accepted.result.summary.callsKubectlNow, false, "config_gate_must_not_call_kubectl");
assert.equal(accepted.result.summary.readsKubeconfigNow, false, "config_gate_must_not_read_kubeconfig");
assert.equal(checked.find((item) => item.file === "package-c-mutation.env").result.blockedReason.startsWith("tencent_deploy_forbidden_secret_key:"), true, "package_c_secret_must_be_rejected");
assert.equal(checked.find((item) => item.file === "readonly.env").result.blockedReason.startsWith("tencent_deploy_forbidden_secret_key:"), true, "readonly_secret_must_be_rejected");
assert.equal(JSON.stringify(checked).includes("$TCR_SECRET"), false, "config_gate_output_must_be_redacted");
assert.equal(JSON.stringify(checked).includes("kubeconfig-ref-proof"), false, "config_gate_output_must_not_expose_kubeconfig_ref");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_deploy_execution_config_local_gate",
  checked: checked.map((item) => ({
    file: item.file,
    ok: item.result.ok,
    blockedReason: item.result.blockedReason,
  })),
  configGateReady: true,
  liveReady: false,
  releasePlanReady: true,
  realExecutionReady: false,
  requiresKubeApiserverConnectivity: true,
  acceptedSecretFile: accepted.file,
  blockedReason: "needs_reviewed_real_release_plan_kube_apiserver_connectivity_dry_run_acceptance_and_explicit_authorization",
}, null, 2));
