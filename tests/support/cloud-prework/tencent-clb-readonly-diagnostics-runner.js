#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TENCENT_CLB_READONLY_DIAGNOSTICS_COMMAND = "node tests/support/cloud-prework/tencent-clb-readonly-diagnostics-runner.js --env /home/dev/.secrets/medopl/v22/tencent-clb-readonly.env --run-id <runid> --authorized 1";

const DEFAULT_EVIDENCE_DIR = ".runtime/package-d-external-access-strategy";
const EVIDENCE_FILE = "tencent-clb-readonly-diagnostics-redacted.json";
const DEFAULT_SDK_MODE = "fake-readonly";
const OFFICIAL_SDK_MODE = "tencent-official-sdk-readonly";
const FIXED_PORTAL_CLB = "lb-pwv9zgky";
const PREVIOUS_PORTAL_CLB = "lb-b33auprw";
const FIXED_OPL_CLB = "lb-lhj3bgii";
const FIXED_PORTAL_HOST = "portal.medopl.cn";
const FIXED_OPL_HOST = "opl.medopl.cn";
const FIXED_PORTAL_NODE_IP = "10.66.0.42";
const FIXED_PORTAL_NODE_PORT = 30336;
const FIXED_OPL_NODE_PORT = 32258;

export const TENCENT_CLB_READONLY_ENV_ALLOWLIST = Object.freeze([
  "TENCENTCLOUD_SECRET_ID",
  "TENCENTCLOUD_SECRET_KEY",
  "TENCENTCLOUD_REGION",
  "PORTAL_CLB_INSTANCE_ID",
  "OPL_CLB_INSTANCE_ID",
  "PORTAL_HOST_DOMAIN",
  "OPL_HOST_DOMAIN",
  "EXPECTED_PORTAL_NODE_IP",
  "EXPECTED_PORTAL_NODE_PORT",
  "EXPECTED_OPL_NODE_PORT",
]);

export const TENCENT_CLB_READONLY_ALLOWED_APIS = Object.freeze([
  "DescribeLoadBalancers",
  "DescribeListeners",
  "DescribeRules",
  "DescribeTargets",
  "DescribeTargetHealth",
  "DescribeTargetsHealth",
  "DescribeLoadBalancerSecurityGroups",
  "DescribeTargetGroups",
  "DescribeCustomizedConfigAssociateList",
]);

export const TENCENT_CLB_FORBIDDEN_MUTATION_PREFIXES = Object.freeze([
  "Create",
  "Modify",
  "Delete",
  "Register",
  "Deregister",
  "Attach",
  "Detach",
  "Set",
  "Associate",
  "Disassociate",
  "Rewrite",
  "Batch",
]);

const ROOT_CAUSES = Object.freeze([
  "listener_missing",
  "rule_missing",
  "target_missing",
  "target_unhealthy",
  "wrong_target_port",
  "wrong_target_ip",
  "security_group_block",
  "source_ip_passthrough_mismatch",
  "listener_rule_mismatch",
  "incomplete_readonly_diagnosis",
  "unknown_clb_data_plane_504",
]);

const FORBIDDEN_ARGS = Object.freeze(new Set([
  "--kubeconfig",
  "--kubectl",
  "--deploy",
  "--rollout",
  "--rollback",
  "--build",
  "--push",
  "--tencent-mutation",
  "--package-c-live",
  "--db",
  "--postgres",
  "--dns-mutation",
  "--secret-file",
  "--cert-id",
]));

function text(value = "") {
  return String(value ?? "").trim();
}

function numberValue(value, errorCode) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(errorCode);
  return parsed;
}

function parseArgs(argv = []) {
  const args = {
    sdkMode: DEFAULT_SDK_MODE,
    evidenceDir: DEFAULT_EVIDENCE_DIR,
    enableOfficialSdkLoader: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (FORBIDDEN_ARGS.has(item)) throw new Error(`tencent_clb_readonly_forbidden_arg:${item}`);
    if (item === "--enable-official-sdk-loader") {
      args.enableOfficialSdkLoader = true;
      continue;
    }
    if (!item.startsWith("--")) throw new Error(`tencent_clb_readonly_unknown_arg:${item}`);
    const key = item.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`tencent_clb_readonly_arg_value_required:${item}`);
    args[key] = next;
    index += 1;
  }
  return args;
}

function parseEnvContent(content = "") {
  const env = {};
  for (const [lineIndex, rawLine] of String(content).split(/\r?\n/u).entries()) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) throw new Error(`tencent_clb_readonly_env_line_invalid:${lineIndex + 1}`);
    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!TENCENT_CLB_READONLY_ENV_ALLOWLIST.includes(key)) throw new Error(`tencent_clb_readonly_env_non_allowlist_key:${key}`);
    env[key] = value;
  }
  return env;
}

function cleanEnv(envValues = {}) {
  const env = {};
  for (const [key, value] of Object.entries(envValues || {})) {
    if (!TENCENT_CLB_READONLY_ENV_ALLOWLIST.includes(key)) throw new Error(`tencent_clb_readonly_env_non_allowlist_key:${key}`);
    env[key] = text(value);
  }
  const missing = TENCENT_CLB_READONLY_ENV_ALLOWLIST.filter((key) => !env[key]);
  if (missing.length > 0) throw new Error(`tencent_clb_readonly_env_missing:${missing.join(",")}`);
  if (env.PORTAL_CLB_INSTANCE_ID !== FIXED_PORTAL_CLB) throw new Error("tencent_clb_readonly_portal_clb_mismatch");
  if (env.OPL_CLB_INSTANCE_ID !== FIXED_OPL_CLB) throw new Error("tencent_clb_readonly_opl_clb_mismatch");
  if (env.PORTAL_HOST_DOMAIN !== FIXED_PORTAL_HOST) throw new Error("tencent_clb_readonly_portal_host_mismatch");
  if (env.OPL_HOST_DOMAIN !== FIXED_OPL_HOST) throw new Error("tencent_clb_readonly_opl_host_mismatch");
  if (env.EXPECTED_PORTAL_NODE_IP !== FIXED_PORTAL_NODE_IP) throw new Error("tencent_clb_readonly_expected_portal_node_ip_mismatch");
  if (numberValue(env.EXPECTED_PORTAL_NODE_PORT, "tencent_clb_readonly_expected_portal_node_port_invalid") !== FIXED_PORTAL_NODE_PORT) {
    throw new Error("tencent_clb_readonly_expected_portal_node_port_mismatch");
  }
  if (numberValue(env.EXPECTED_OPL_NODE_PORT, "tencent_clb_readonly_expected_opl_node_port_invalid") !== FIXED_OPL_NODE_PORT) {
    throw new Error("tencent_clb_readonly_expected_opl_node_port_mismatch");
  }
  return env;
}

function assertAuthorized(authorized) {
  if (authorized !== true) throw new Error("tencent_clb_readonly_diagnostics_not_authorized");
}

function assertRunId(runId = "") {
  const normalized = text(runId);
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/u.test(normalized)) throw new Error("tencent_clb_readonly_run_id_required");
  return normalized;
}

function assertApiPlan(apiPlan = TENCENT_CLB_READONLY_ALLOWED_APIS) {
  for (const api of apiPlan) {
    if (TENCENT_CLB_FORBIDDEN_MUTATION_PREFIXES.some((prefix) => api.startsWith(prefix))) {
      throw new Error(`tencent_clb_readonly_forbidden_mutation_api:${api}`);
    }
    if (!TENCENT_CLB_READONLY_ALLOWED_APIS.includes(api)) throw new Error(`tencent_clb_readonly_api_not_allowlisted:${api}`);
  }
}

function defaultObservations() {
  return {
    portalClb: {
      exists: true,
      instanceId: FIXED_PORTAL_CLB,
      status: "running",
      vip: "redacted_or_api_dependent",
      domain: "lb-pwv9zgky.clb.usw-tencentclb.com",
    },
    previousPortalClb: {
      instanceId: PREVIOUS_PORTAL_CLB,
      discoverable: "if_returned_by_describe_load_balancers",
    },
    oplClb: {
      exists: true,
      instanceId: FIXED_OPL_CLB,
      status: "running",
      vip: "redacted_or_api_dependent",
      domain: "lb-lhj3bgii.clb.usw-tencentclb.com",
    },
    portalListener443: {
      exists: true,
      listenerId: "listener-portal-443-redacted",
      protocol: "HTTPS",
      port: 443,
      forwardingProtocol: "HTTP",
      certificateRef: "redacted",
      http2: "api_dependent",
      gzip: "api_dependent",
      xff: "api_dependent",
      session: "api_dependent",
      sourceIpMode: "api_dependent",
    },
    oplListener443: {
      exists: true,
      listenerId: "listener-opl-443-redacted",
      protocol: "HTTPS",
      port: 443,
      forwardingProtocol: "HTTP",
      certificateRef: "redacted",
      http2: "api_dependent",
      gzip: "api_dependent",
      xff: "api_dependent",
      session: "api_dependent",
      sourceIpMode: "api_dependent",
    },
    portalRuleBackend: {
      exists: true,
      host: FIXED_PORTAL_HOST,
      path: "/",
      backendService: "portal-frontend-edge",
      backendIp: FIXED_PORTAL_NODE_IP,
      backendPort: FIXED_PORTAL_NODE_PORT,
      forwardingProtocol: "HTTP",
    },
    oplRuleBackend: {
      exists: true,
      host: FIXED_OPL_HOST,
      path: "/",
      backendService: "opl-webui-control-plane",
      backendIp: "discover_from_clb_target",
      backendPort: FIXED_OPL_NODE_PORT,
      forwardingProtocol: "HTTP",
    },
    portalRegisteredTargets: [{ ip: FIXED_PORTAL_NODE_IP, port: FIXED_PORTAL_NODE_PORT, weight: 100 }],
    oplRegisteredTargets: [{ ip: "discover_from_clb_target", port: FIXED_OPL_NODE_PORT, weight: 100 }],
    portalTargetHealth: { state: "healthy", reason: "", failureReason: "" },
    oplTargetHealth: { state: "healthy", reason: "", failureReason: "" },
    portalSecurityGroup: { bindings: [], defaultAllowObserved: "unknown_or_api_dependent", blocked: false },
    oplSecurityGroup: { bindings: [], defaultAllowObserved: "unknown_or_api_dependent", blocked: false },
  };
}

function mergeObservations(overrides = {}) {
  const defaults = defaultObservations();
  return {
    ...defaults,
    ...overrides,
    portalClb: { ...defaults.portalClb, ...(overrides.portalClb || {}) },
    previousPortalClb: { ...defaults.previousPortalClb, ...(overrides.previousPortalClb || {}) },
    oplClb: { ...defaults.oplClb, ...(overrides.oplClb || {}) },
    portalListener443: { ...defaults.portalListener443, ...(overrides.portalListener443 || {}) },
    oplListener443: { ...defaults.oplListener443, ...(overrides.oplListener443 || {}) },
    portalRuleBackend: { ...defaults.portalRuleBackend, ...(overrides.portalRuleBackend || {}) },
    oplRuleBackend: { ...defaults.oplRuleBackend, ...(overrides.oplRuleBackend || {}) },
    portalTargetHealth: { ...defaults.portalTargetHealth, ...(overrides.portalTargetHealth || {}) },
    oplTargetHealth: { ...defaults.oplTargetHealth, ...(overrides.oplTargetHealth || {}) },
    portalSecurityGroup: { ...defaults.portalSecurityGroup, ...(overrides.portalSecurityGroup || {}) },
    oplSecurityGroup: { ...defaults.oplSecurityGroup, ...(overrides.oplSecurityGroup || {}) },
  };
}

function targetList(value = []) {
  return (Array.isArray(value) ? value : []).map((target = {}) => ({
    ip: text(target.ip) || "unknown",
    targetId: text(target.targetId || target.id || ""),
    port: Number(target.port) || 0,
    weight: Number(target.weight) || 0,
  }));
}

function isKnownValue(value) {
  const normalized = text(value).toLowerCase();
  return normalized && !["unknown", "unknown_or_api_dependent", "api_dependent", "unsupported_api"].includes(normalized);
}

function isIncompleteReadonlyObservation(obs = {}) {
  if (!obs.portalListener443?.exists && !obs.oplListener443?.exists) return true;
  if (!obs.portalRuleBackend?.exists && !obs.oplRuleBackend?.exists) return true;
  if (["unsupported_api", "unknown"].includes(text(obs.portalTargetHealth?.state).toLowerCase())) return true;
  if (["unsupported_api", "unknown"].includes(text(obs.oplTargetHealth?.state).toLowerCase())) return true;
  if (text(obs.portalSecurityGroup?.status).toLowerCase() === "unsupported_api") return true;
  if (text(obs.oplSecurityGroup?.status).toLowerCase() === "unsupported_api") return true;
  return false;
}

function classifyRootCause(obs = {}) {
  const portalTargets = targetList(obs.portalRegisteredTargets);
  const oplTargets = targetList(obs.oplRegisteredTargets);
  if (isIncompleteReadonlyObservation(obs)) return "incomplete_readonly_diagnosis";
  if (!obs.portalListener443?.exists && obs.oplListener443?.exists) return "listener_missing";
  if (!obs.portalRuleBackend?.exists && obs.oplRuleBackend?.exists) return "rule_missing";
  if (!portalTargets.length && oplTargets.length) return "target_missing";
  if (portalTargets.some((target) => isKnownValue(target.ip) && target.ip !== FIXED_PORTAL_NODE_IP)) return "wrong_target_ip";
  if (portalTargets.some((target) => target.port !== FIXED_PORTAL_NODE_PORT)) return "wrong_target_port";
  if (text(obs.portalTargetHealth?.state).toLowerCase() !== "healthy" && text(obs.oplTargetHealth?.state).toLowerCase() === "healthy") return "target_unhealthy";
  if (obs.portalSecurityGroup?.blocked === true && obs.oplSecurityGroup?.blocked !== true) return "security_group_block";
  if (obs.portalListener443?.sourceIpMode && obs.oplListener443?.sourceIpMode && obs.portalListener443.sourceIpMode !== "api_dependent" && obs.oplListener443.sourceIpMode !== "api_dependent" && obs.portalListener443.sourceIpMode !== obs.oplListener443.sourceIpMode) {
    return "source_ip_passthrough_mismatch";
  }
  if (obs.portalRuleBackend?.host !== FIXED_PORTAL_HOST || Number(obs.portalRuleBackend?.backendPort) !== FIXED_PORTAL_NODE_PORT) {
    return "listener_rule_mismatch";
  }
  return "unknown_clb_data_plane_504";
}

function recommendedAction(rootCause) {
  const actions = {
    listener_missing: "create or repair the Portal CLB HTTPS listener under a separate mutation authorization",
    rule_missing: "repair the Portal CLB host/path rule under a separate mutation authorization",
    target_missing: "register the Portal NodePort target under a separate mutation authorization",
    target_unhealthy: "repair Portal target health before route closeout",
    wrong_target_port: "repair Portal CLB target port to nodePort 30336 under a separate mutation authorization",
    wrong_target_ip: "repair Portal CLB target IP to node 10.66.0.42 under a separate mutation authorization",
    security_group_block: "repair CLB/backend security group reachability under a separate authorization",
    source_ip_passthrough_mismatch: "align source IP passthrough behavior with the working OPL CLB under a separate authorization",
    listener_rule_mismatch: "align Portal CLB listener/rule/backend mapping with the working OPL CLB under separate authorization",
    incomplete_readonly_diagnosis: "rerun Tencent CLB readonly diagnostics after the required listener/rule/target-health/security-group readonly APIs return usable data",
    unknown_clb_data_plane_504: "compare Tencent CLB listener/rule/target/security-group data-plane details and repair the first mismatched CLB layer under separate authorization",
  };
  return actions[rootCause] || actions.unknown_clb_data_plane_504;
}

function redactionAudit(serialized = "", secretValues = []) {
  const content = String(serialized || "");
  return {
    secretValueExposed: secretValues.some((value) => value && content.includes(value)),
    tencentSecretFieldExposed: /"SecretId"\s*:|"SecretKey"\s*:|\bSecretId\b|\bSecretKey\b/u.test(content),
    rawSdkResponseExposed: /rawResponse|authorization:|Authorization:|"headers"\s*:/u.test(content),
    certIdExposed: /TENCENT_SSL_CERT_ID|qcloud_cert_id|XEgpceaK/u.test(content),
    kubeconfigExposed: /client-certificate-data|client-key-data|certificate-authority-data|current-context:/u.test(content),
    dbPasswordExposed: /DATABASE_URL|PORTAL_POSTGRES_PASSWORD|MEDOPL_POSTGRES_LEDGER_PASSWORD/u.test(content),
    portalAdminPasswordExposed: /PORTAL_ADMIN_PASSWORD|portal-admin-password/u.test(content),
    mutationApiExposed: /\b(?:CreateLoadBalancer|ModifyLoadBalancer|DeleteLoadBalancer|RegisterTargets|DeregisterTargets|AttachLoadBalancer|DetachLoadBalancer|SetLoadBalancer|AssociateTargetGroups|DisassociateTargetGroups|RewriteUrlRules|BatchModifyTargetWeight)\b/u.test(content),
    tenantResourceExposed: /medopl-tenant-/u.test(content),
  };
}

function failedAuditKeys(audit = {}) {
  return Object.entries(audit).filter(([, value]) => Boolean(value)).map(([key]) => key);
}

export async function buildTencentClbReadonlyDiagnostics({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  envValues = {},
  envContent = "",
  apiPlan = TENCENT_CLB_READONLY_ALLOWED_APIS,
  observations = {},
} = {}) {
  assertAuthorized(authorized);
  const safeRunId = assertRunId(runId);
  const env = cleanEnv(envContent ? parseEnvContent(envContent) : envValues);
  assertApiPlan(apiPlan);
  const obs = mergeObservations(observations);
  const rootCause = classifyRootCause(obs);
  const diagnostics = {
    ok: true,
    contract: "production_launch_gap_08o_tencent_clb_readonly_diagnostics_local_gate",
    command: TENCENT_CLB_READONLY_DIAGNOSTICS_COMMAND,
    runId: safeRunId,
    envAllowlist: [...TENCENT_CLB_READONLY_ENV_ALLOWLIST],
    envSource: "/home/dev/.secrets/medopl/v22/tencent-clb-readonly.env",
    allowedApis: [...TENCENT_CLB_READONLY_ALLOWED_APIS],
    forbiddenMutationPrefixes: [...TENCENT_CLB_FORBIDDEN_MUTATION_PREFIXES],
    apiPlan: [...apiPlan],
    inputs: {
      portal: {
        currentClbInstanceId: env.PORTAL_CLB_INSTANCE_ID,
        previousClbInstanceId: PREVIOUS_PORTAL_CLB,
        host: env.PORTAL_HOST_DOMAIN,
        expectedNodeIp: env.EXPECTED_PORTAL_NODE_IP,
        expectedNodePort: Number(env.EXPECTED_PORTAL_NODE_PORT),
      },
      opl: {
        clbInstanceId: env.OPL_CLB_INSTANCE_ID,
        host: env.OPL_HOST_DOMAIN,
        expectedNodePort: Number(env.EXPECTED_OPL_NODE_PORT),
        expectedNodeIpDiscovery: "discover_from_service_opl-webui-control-plane",
      },
      region: env.TENCENTCLOUD_REGION,
    },
    diagnostics: {
      portalClb: obs.portalClb,
      previousPortalClb: obs.previousPortalClb,
      oplClb: obs.oplClb,
      portalListener443: obs.portalListener443,
      oplListener443: obs.oplListener443,
      portalRuleBackend: obs.portalRuleBackend,
      oplRuleBackend: obs.oplRuleBackend,
      portalRegisteredTargets: targetList(obs.portalRegisteredTargets),
      oplRegisteredTargets: targetList(obs.oplRegisteredTargets),
      portalTargetHealth: obs.portalTargetHealth,
      oplTargetHealth: obs.oplTargetHealth,
      portalSecurityGroup: obs.portalSecurityGroup,
      oplSecurityGroup: obs.oplSecurityGroup,
      forwardingDiff: {
        portal: {
          protocol: `${obs.portalListener443?.protocol || "unknown"}->${obs.portalRuleBackend?.forwardingProtocol || "unknown"}`,
          session: obs.portalListener443?.session || "unknown",
          gzip: obs.portalListener443?.gzip || "unknown",
          http2: obs.portalListener443?.http2 || "unknown",
          xff: obs.portalListener443?.xff || "unknown",
          sourceIpMode: obs.portalListener443?.sourceIpMode || "unknown",
        },
        opl: {
          protocol: `${obs.oplListener443?.protocol || "unknown"}->${obs.oplRuleBackend?.forwardingProtocol || "unknown"}`,
          session: obs.oplListener443?.session || "unknown",
          gzip: obs.oplListener443?.gzip || "unknown",
          http2: obs.oplListener443?.http2 || "unknown",
          xff: obs.oplListener443?.xff || "unknown",
          sourceIpMode: obs.oplListener443?.sourceIpMode || "unknown",
        },
        comparisonIncludesSessionGzipHttp2XffSourceIpMode: true,
      },
    },
    classification: {
      rootCause,
      allowedRootCauses: [...ROOT_CAUSES],
      recommendedNextRepairAction: recommendedAction(rootCause),
    },
    allowedOperations: [
      "read Tencent CLB listeners/rules/targets/target health/security group bindings/customized config only",
      "compare Portal CLB lb-pwv9zgky with working OPL CLB lb-lhj3bgii",
      "write redacted diagnostics evidence",
    ],
    forbiddenOperations: [
      "Tencent mutation API",
      "DNS mutation",
      "Kubernetes access or kubectl",
      "build/push",
      "Package C live",
      "secret output",
      "public access completion claim",
    ],
    evidence: {
      sink: ".runtime",
      path: ".runtime/package-d-external-access-strategy/<runid>/tencent-clb-readonly-diagnostics-redacted.json",
      resolvedPath: path.join(evidenceDir, safeRunId, EVIDENCE_FILE),
      redacted: true,
    },
    boundary: {
      localGateOnly: true,
      tencentReadonlyAllowedOnlyWithFutureAuthorization: true,
      tencentMutationAllowed: false,
      kubernetesAccessAllowed: false,
      kubectlAllowed: false,
      dnsMutationAllowed: false,
      buildPushAllowed: false,
      packageCLiveAllowed: false,
      publicAccessClaimAllowed: false,
    },
    nextGap: {
      id: "production-launch-gap-08o-tencent-clb-readonly-diagnostics",
      boundary: "future cloud run may call only allowlisted Tencent CLB read-only APIs and write redacted diagnostics evidence",
    },
  };
  const audit = redactionAudit(JSON.stringify(diagnostics), [env.TENCENTCLOUD_SECRET_ID, env.TENCENTCLOUD_SECRET_KEY]);
  const failed = failedAuditKeys(audit);
  if (failed.length) throw new Error(`tencent_clb_readonly_redaction_audit_failed:${failed.join(",")}`);
  return diagnostics;
}

async function officialObservations({ env }) {
  throw new Error("tencent_clb_readonly_official_sdk_loader_explicit_enable_required");
}

async function officialLoaderObservations({ env }) {
  let sdkRoot;
  try {
    sdkRoot = await import("tencentcloud-sdk-nodejs");
  } catch {
    return {
      observations: {},
      blockers: [{ code: "tencentcloud_sdk_missing", operation: "DescribeLoadBalancers" }],
    };
  }
  const root = sdkRoot?.default || sdkRoot;
  const Client = root?.clb?.v20180317?.Client;
  if (typeof Client !== "function") {
    return {
      observations: {},
      blockers: [{ code: "tencentcloud_clb_client_shape_missing", operation: "DescribeLoadBalancers" }],
    };
  }
  const client = new Client({
    credential: {
      secretId: env.TENCENTCLOUD_SECRET_ID,
      secretKey: env.TENCENTCLOUD_SECRET_KEY,
    },
    region: env.TENCENTCLOUD_REGION,
    profile: { httpProfile: { reqTimeout: 30 } },
  });
  return collectTencentClbReadonlyOfficialObservations({ env, client });
}

export async function collectTencentClbReadonlyOfficialObservations({ env, client }) {
  const blockers = [];
  async function call(operation, req = {}) {
    assertApiPlan([operation]);
    if (typeof client?.[operation] !== "function") {
      blockers.push({ code: "unsupported_api", operation, detail: "sdk_method_missing" });
      return null;
    }
    try {
      return await client[operation](req);
    } catch (error) {
      blockers.push({ code: classifyReadonlyCallError(error, operation), operation });
      return null;
    }
  }
  const loadBalancers = await call("DescribeLoadBalancers", {
    LoadBalancerIds: [env.PORTAL_CLB_INSTANCE_ID, env.OPL_CLB_INSTANCE_ID],
  });
  const portalClb = sanitizeClb(loadBalancers, env.PORTAL_CLB_INSTANCE_ID);
  const oplClb = sanitizeClb(loadBalancers, env.OPL_CLB_INSTANCE_ID);
  const portalListeners = await call("DescribeListeners", { LoadBalancerId: env.PORTAL_CLB_INSTANCE_ID });
  const oplListeners = await call("DescribeListeners", { LoadBalancerId: env.OPL_CLB_INSTANCE_ID });
  const portalListenerId = rawListenerId(portalListeners);
  const oplListenerId = rawListenerId(oplListeners);
  const portalListener = sanitizeListener(portalListeners);
  const oplListener = sanitizeListener(oplListeners);
  const portalRules = portalListenerId ? await call("DescribeRules", { LoadBalancerId: env.PORTAL_CLB_INSTANCE_ID, ListenerId: portalListenerId }) : null;
  const oplRules = oplListenerId ? await call("DescribeRules", { LoadBalancerId: env.OPL_CLB_INSTANCE_ID, ListenerId: oplListenerId }) : null;
  const portalRule = sanitizeRule(portalRules || portalListeners, FIXED_PORTAL_HOST, "portal-frontend-edge", portalListenerId);
  const oplRule = sanitizeRule(oplRules || oplListeners, FIXED_OPL_HOST, "opl-webui-control-plane", oplListenerId);
  const portalTargets = portalListenerId ? await call("DescribeTargets", targetRequest(env.PORTAL_CLB_INSTANCE_ID, portalListenerId, portalRule.locationId)) : null;
  const oplTargets = oplListenerId ? await call("DescribeTargets", targetRequest(env.OPL_CLB_INSTANCE_ID, oplListenerId, oplRule.locationId)) : null;
  const portalHealth = portalListenerId ? await call("DescribeTargetHealth", healthRequest(env.PORTAL_CLB_INSTANCE_ID, portalListenerId, portalRule.locationId)) : null;
  const oplHealth = oplListenerId ? await call("DescribeTargetHealth", healthRequest(env.OPL_CLB_INSTANCE_ID, oplListenerId, oplRule.locationId)) : null;
  const portalSecurityGroup = await callOptional("DescribeLoadBalancerSecurityGroups", { LoadBalancerId: env.PORTAL_CLB_INSTANCE_ID });
  const oplSecurityGroup = await callOptional("DescribeLoadBalancerSecurityGroups", { LoadBalancerId: env.OPL_CLB_INSTANCE_ID });
  await call("DescribeTargetGroups", {});
  await call("DescribeCustomizedConfigAssociateList", { LoadBalancerId: env.PORTAL_CLB_INSTANCE_ID });
  return {
    observations: {
      portalClb,
      oplClb,
      portalListener443: portalListener,
      oplListener443: oplListener,
      portalRuleBackend: portalRule,
      oplRuleBackend: oplRule,
      portalRegisteredTargets: sanitizeTargets(portalTargets),
      oplRegisteredTargets: sanitizeTargets(oplTargets),
      portalTargetHealth: sanitizeHealth(portalHealth),
      oplTargetHealth: sanitizeHealth(oplHealth),
      portalSecurityGroup: sanitizeSecurityGroup(portalSecurityGroup, portalClb),
      oplSecurityGroup: sanitizeSecurityGroup(oplSecurityGroup, oplClb),
    },
    blockers,
  };

  async function callOptional(operation, req = {}) {
    const before = blockers.length;
    const result = await call(operation, req);
    const added = blockers.slice(before);
    if (added.some((blocker) => blocker.operation === operation && blocker.detail === "sdk_method_missing")) {
      return { unsupportedBySdk: true };
    }
    return result;
  }
}

function classifyReadonlyCallError(error, operation = "") {
  const code = text(error?.code || error?.name || "clb_readonly_call_failed");
  const message = text(error?.message || "");
  const combined = `${code} ${message}`;
  if (operation === "DescribeCustomizedConfigAssociateList" && /UnknownParameter/iu.test(combined)) return "unsupported_or_not_applicable";
  if (/TypeError/iu.test(combined)) return "clb_readonly_call_failed";
  if (/UnknownParameter|Unsupported|NotFound|InvalidAction|InvalidParameterValue/iu.test(combined)) return "unsupported_api";
  return code || "clb_readonly_call_failed";
}

function targetRequest(loadBalancerId, listenerId, locationId) {
  const req = { LoadBalancerId: loadBalancerId, ListenerIds: [listenerId] };
  if (locationId) req.Filters = [{ Name: "location-id", Values: [locationId] }];
  return req;
}

function healthRequest(loadBalancerId, listenerId, locationId) {
  const req = { LoadBalancerIds: [loadBalancerId], ListenerIds: [listenerId] };
  if (locationId) req.LocationIds = [locationId];
  return req;
}

function firstArray(value = {}, keys = []) {
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function rawListenerId(response) {
  const item = firstArray(response, ["Listeners"]).find((entry) => Number(entry?.Port) === 443) || {};
  return text(item.ListenerId);
}

function sanitizeClb(response, instanceId) {
  const items = firstArray(response, ["LoadBalancerSet", "LoadBalancers"]);
  const item = items.find((entry) => entry?.LoadBalancerId === instanceId || entry?.LoadBalancerId === instanceId) || {};
  return {
    exists: Boolean(item.LoadBalancerId),
    instanceId,
    status: text(item.Status || item.LoadBalancerStatus || "unknown"),
    vip: item.LoadBalancerVips?.length ? "observed_redacted" : "unknown_or_api_dependent",
    domain: text(item.Domain || item.LoadBalancerDomain || "unknown_or_api_dependent"),
    securityGroupRefs: (Array.isArray(item.SecurityGroup) ? item.SecurityGroup : []).map((_, index) => `security-group-${index + 1}`),
    loadBalancerPassToTarget: Number.isInteger(item.LoadBalancerPassToTarget) ? item.LoadBalancerPassToTarget : "unknown_or_api_dependent",
  };
}

function sanitizeListener(response) {
  const items = firstArray(response, ["Listeners"]);
  const item = items.find((entry) => Number(entry?.Port) === 443) || {};
  return {
    exists: Boolean(item.ListenerId),
    listenerId: item.ListenerId ? "observed_redacted" : "",
    protocol: text(item.Protocol || "unknown"),
    port: Number(item.Port) || 0,
    forwardingProtocol: "HTTP",
    certificateRef: item.Certificate ? "observed_redacted" : "unknown_or_api_dependent",
    http2: text(item.Http2 || item.Http2Switch || "unknown_or_api_dependent"),
    gzip: text(item.Gzip || "unknown_or_api_dependent"),
    xff: text(item.XForwardedFor || item.Xff || "unknown_or_api_dependent"),
    session: text(item.SessionExpireTime || item.SessionType || "unknown_or_api_dependent"),
    sourceIpMode: text(item.SourceIpType || item.SourceIpMode || "unknown_or_api_dependent"),
  };
}

function rulesFromResponse(response, listenerId = "") {
  const direct = firstArray(response, ["Rules"]);
  if (direct.length) return direct;
  const listeners = firstArray(response, ["Listeners"]);
  const listener = listeners.find((entry) => !listenerId || entry?.ListenerId === listenerId) || listeners[0] || {};
  return firstArray(listener, ["Rules"]);
}

function sanitizeRule(response, host, backendService, listenerId = "") {
  const rules = rulesFromResponse(response, listenerId);
  const item = rules.find((entry) => entry?.Domain === host) || rules.find((entry) => entry?.Url === "/" || entry?.Path === "/") || {};
  return {
    exists: Boolean(item.LocationId || item.RuleId || item.Domain),
    locationId: text(item.LocationId || item.RuleId || ""),
    listenerId: text(item.ListenerId || listenerId),
    host,
    path: text(item.Url || item.Path || "/"),
    backendService,
    backendIp: "from_describe_targets",
    backendPort: Number(item.EndPort || item.Port) || (backendService === "portal-frontend-edge" ? FIXED_PORTAL_NODE_PORT : FIXED_OPL_NODE_PORT),
    forwardingProtocol: text(item.ForwardType || "HTTP"),
  };
}

function sanitizeTargets(response) {
  const listeners = firstArray(response, ["Listeners"]);
  const targets = [];
  for (const listener of listeners) {
    for (const rule of firstArray(listener, ["Rules"])) {
      for (const target of firstArray(rule, ["Targets"])) {
        targets.push({
          ip: text(target.EniIp || target.PrivateIpAddresses?.[0] || target.TargetAddress || "unknown"),
          targetId: text(target.InstanceId || target.TargetId || ""),
          port: Number(target.Port || target.TargetPort) || 0,
          weight: Number(target.Weight || target.TargetWeight) || 0,
        });
      }
    }
    for (const target of firstArray(listener, ["Targets"])) {
      targets.push({
        ip: text(target.EniIp || target.PrivateIpAddresses?.[0] || target.TargetAddress || "unknown"),
        targetId: text(target.InstanceId || target.TargetId || ""),
        port: Number(target.Port || target.TargetPort) || 0,
        weight: Number(target.Weight || target.TargetWeight) || 0,
      });
    }
  }
  return targets;
}

function sanitizeHealth(response) {
  if (!response) {
    return {
      state: "unsupported_api",
      reason: "unsupported_or_not_applicable",
      failureReason: "unsupported_or_not_applicable",
    };
  }
  const healthItems = firstArray(response, ["LoadBalancers", "TargetHealthSet", "Targets"]);
  const serialized = JSON.stringify(healthItems).toLowerCase();
  const unhealthy = /unhealthy|fail|timeout|blocked/u.test(serialized);
  const targets = [];
  for (const lb of firstArray(response, ["LoadBalancers"])) {
    for (const listener of firstArray(lb, ["Listeners"])) {
      for (const rule of firstArray(listener, ["Rules"])) {
        for (const target of firstArray(rule, ["Targets"])) targets.push(target);
      }
    }
  }
  const targetUnhealthy = targets.some((target) => target?.HealthStatus === false || /dead|fail|unhealthy/iu.test(text(target?.HealthStatusDetail || target?.HealthStatusDetial)));
  const failedTarget = targets.find((target) => target?.HealthStatus === false);
  return {
    state: unhealthy || targetUnhealthy ? "unhealthy" : healthItems.length ? "healthy" : "unknown",
    reason: unhealthy || targetUnhealthy ? text(failedTarget?.HealthStatusDetail || "api_reported_unhealthy") : "",
    failureReason: unhealthy || targetUnhealthy ? text(failedTarget?.HealthStatusDetail || "api_reported_unhealthy") : "",
  };
}

function sanitizeSecurityGroup(response, clb = {}) {
  const clbRefs = Array.isArray(clb.securityGroupRefs) ? clb.securityGroupRefs : [];
  if (response?.unsupportedBySdk && clbRefs.length) {
    return {
      status: "observed_from_describe_load_balancers",
      bindings: clbRefs.map((ref) => ({ ref, policy: "observed_binding" })),
      defaultAllowObserved: Number(clb.loadBalancerPassToTarget) === 1 ? "pass_to_target_enabled" : "api_exposes_bindings_only",
      blocked: false,
    };
  }
  if (!response) {
    return {
      status: "unsupported_api",
      bindings: [],
      defaultAllowObserved: "unsupported_or_not_applicable",
      blocked: false,
    };
  }
  const bindings = firstArray(response, ["SecurityGroupSet", "SecurityGroups"]).map((item, index) => ({
    ref: `security-group-${index + 1}`,
    policy: text(item?.Policy || item?.SecurityGroupPolicySet?.Version || item?.SecurityGroupId || "unknown"),
  }));
  return {
    status: bindings.length ? "observed" : "no_binding_observed",
    bindings,
    defaultAllowObserved: bindings.length ? "api_exposes_bindings_only" : "no_binding_or_default_allow_unknown",
    blocked: false,
  };
}

export async function runTencentClbReadonlyDiagnostics({
  runId = "",
  evidenceDir = DEFAULT_EVIDENCE_DIR,
  authorized = false,
  envValues = {},
  envContent = "",
  sdkMode = DEFAULT_SDK_MODE,
  enableOfficialSdkLoader = false,
  observations = {},
} = {}) {
  const env = cleanEnv(envContent ? parseEnvContent(envContent) : envValues);
  let effectiveObservations = observations;
  let blockers = [];
  if (sdkMode === OFFICIAL_SDK_MODE) {
    const result = enableOfficialSdkLoader
      ? await officialLoaderObservations({ env })
      : await officialObservations({ env });
    effectiveObservations = result.observations || {};
    blockers = result.blockers || [];
  } else if (sdkMode !== DEFAULT_SDK_MODE) {
    throw new Error(`tencent_clb_readonly_sdk_mode_unsupported:${sdkMode}`);
  }
  const plan = await buildTencentClbReadonlyDiagnostics({
    runId,
    evidenceDir,
    authorized,
    envValues: env,
    observations: effectiveObservations,
  });
  const audit = redactionAudit(JSON.stringify(plan), [env.TENCENTCLOUD_SECRET_ID, env.TENCENTCLOUD_SECRET_KEY]);
  const evidence = {
    ...plan,
    sdkMode,
    blockers,
    redactionAudit: {
      ...audit,
      secretLeakageDetected: Object.values(audit).some(Boolean),
    },
  };
  if (evidence.redactionAudit.secretLeakageDetected) throw new Error("tencent_clb_readonly_evidence_redaction_audit_failed");
  const targetDir = path.join(evidenceDir, plan.runId);
  await mkdir(targetDir, { recursive: true });
  const evidencePath = path.join(targetDir, EVIDENCE_FILE);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return {
    ok: true,
    contract: plan.contract,
    runId: plan.runId,
    sdkMode,
    evidencePath,
    rootCause: plan.classification.rootCause,
    recommendedNextRepairAction: plan.classification.recommendedNextRepairAction,
    blockers,
    realExecutionReady: sdkMode === OFFICIAL_SDK_MODE,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.env) throw new Error("tencent_clb_readonly_env_path_required");
  assertAuthorized(args.authorized === "1");
  const result = await runTencentClbReadonlyDiagnostics({
    runId: args.runId,
    evidenceDir: args.evidenceDir,
    authorized: true,
    envContent: await readFile(args.env, "utf8"),
    sdkMode: args.sdkMode,
    enableOfficialSdkLoader: args.enableOfficialSdkLoader,
  });
  console.log(JSON.stringify({
    ok: result.ok,
    contract: result.contract,
    runId: result.runId,
    sdkMode: result.sdkMode,
    evidencePath: result.evidencePath,
    rootCause: result.rootCause,
    blockers: result.blockers.map((blocker = {}) => ({
      code: text(blocker.code || "clb_readonly_blocker"),
      operation: text(blocker.operation || "unknown"),
    })),
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(String(error?.message || "tencent_clb_readonly_diagnostics_failed"));
    process.exitCode = 1;
  });
}
