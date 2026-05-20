import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-authorized-tencent-deploy-execution-boundary.md";
const readmePath = "docs/contracts/README.md";
const boardPath = "docs/recovery/cloud-onboarding-execution-board.md";
const statusPath = "docs/recovery/cloud-onboarding-status-table.md";
const verificationMatrixPath = "docs/recovery/cloud-onboarding-verification-matrix.md";
const suitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";

function text(value = "") {
  return String(value ?? "").trim();
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function validateToken(value = "", label = "token") {
  const normalized = text(value);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,120}$/.test(normalized)) {
    return { ok: false, reason: `${label}_invalid` };
  }
  return { ok: true };
}

function validateImageTag(value = "") {
  const tag = text(value);
  if (!tag) return { ok: false, reason: "deploy_image_tag_required" };
  if (tag === "latest") return { ok: false, reason: "deploy_latest_tag_forbidden" };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{5,120}$/.test(tag)) {
    return { ok: false, reason: "deploy_image_tag_invalid" };
  }
  return { ok: true, tag };
}

function validateReleasePlan(plan = {}) {
  const runId = text(plan.runId);
  const versionTag = validateImageTag(plan.versionTag);
  if (!runId) return { ok: false, reason: "deploy_run_id_required" };
  if (!versionTag.ok) return versionTag;
  if (!validateToken(runId, "deploy_run_id").ok) return { ok: false, reason: "deploy_release_plan_invalid" };
  if (!Array.isArray(plan.targets) || plan.targets.length < 2) {
    return { ok: false, reason: "deploy_multi_target_release_plan_required" };
  }
  const globalNamespace = text(plan.namespace);
  const seenRepositoryTags = new Set();
  const seenWorkloadContainers = new Set();
  for (const target of plan.targets) {
    for (const field of ["component", "targetClass", "repository", "imageTargetRef", "sourceRoot", "namespace", "workload", "container", "ownerRef", "operationId", "expectedVersionMarker"]) {
      if (!text(target[field])) return { ok: false, reason: field === "ownerRef" || field === "operationId" ? "deploy_platform_owner_guard_required" : "deploy_target_field_required" };
    }
    if (!["services/portal", "services/opl-web-gateway", "services/opl-runtime-bridge"].includes(text(target.sourceRoot))) {
      return { ok: false, reason: "deploy_source_root_must_be_active_service" };
    }
    if (globalNamespace && text(target.namespace) !== globalNamespace) {
      return { ok: false, reason: "deploy_cross_namespace_target_forbidden" };
    }
    if (!["platform_service_target", "workspace_runtime_target"].includes(text(target.targetClass))) {
      return { ok: false, reason: "deploy_target_class_invalid" };
    }
    if (text(target.targetClass) === "workspace_runtime_target" && (!text(target.workspaceId) || !text(target.resourceBindingId))) {
      return { ok: false, reason: "deploy_workspace_runtime_owner_guard_required" };
    }
    const repositoryTag = `${text(target.repository)}:${versionTag.tag}`;
    if (seenRepositoryTags.has(repositoryTag)) return { ok: false, reason: "deploy_duplicate_repository_tag_forbidden" };
    seenRepositoryTags.add(repositoryTag);
    const workloadContainer = `${text(target.namespace)}:${text(target.workload)}:${text(target.container)}`;
    if (seenWorkloadContainers.has(workloadContainer)) return { ok: false, reason: "deploy_duplicate_workload_container_forbidden" };
    seenWorkloadContainers.add(workloadContainer);
  }
  if (!Array.isArray(plan.runtimeSmokeTargets) || plan.runtimeSmokeTargets.length < 3) {
    return { ok: false, reason: "deploy_runtime_smoke_targets_required" };
  }
  const requiredSurfaces = new Set(["portal", "opl", "trace"]);
  const seenSurfaces = new Set();
  const pushedVersionCoverage = new Set();
  for (const smokeTarget of plan.runtimeSmokeTargets) {
    if (!text(smokeTarget.surface) || !text(smokeTarget.url) || !text(smokeTarget.expectedVersionMarker)) {
      return { ok: false, reason: "deploy_runtime_smoke_target_field_required" };
    }
    try {
      new URL(text(smokeTarget.url));
    } catch {
      return { ok: false, reason: "deploy_runtime_smoke_url_invalid" };
    }
    seenSurfaces.add(text(smokeTarget.surface));
    const provesComponents = Array.isArray(smokeTarget.provesComponents)
      ? smokeTarget.provesComponents.map(text).filter(Boolean)
      : [];
    if (smokeTarget.provesPushedVersion !== false && !provesComponents.length) {
      return { ok: false, reason: "deploy_runtime_smoke_component_coverage_required" };
    }
    if (smokeTarget.provesPushedVersion !== false) {
      for (const component of provesComponents) pushedVersionCoverage.add(component);
    }
  }
  for (const requiredSurface of requiredSurfaces) {
    if (!seenSurfaces.has(requiredSurface)) return { ok: false, reason: "deploy_runtime_smoke_surface_required" };
  }
  for (const target of plan.targets) {
    if (!pushedVersionCoverage.has(text(target.component))) {
      return { ok: false, reason: "deploy_runtime_smoke_component_coverage_required" };
    }
  }
  return { ok: true };
}

function releasePlan(overrides = {}) {
  return {
    runId: "pkg-d-image-push-proof",
    versionTag: "pkg-d-image-push-proof-20260511-000001",
    namespace: "namespace-proof",
    targets: [
      {
        component: "portal",
        targetClass: "platform_service_target",
        repository: "portal-proof",
        imageTargetRef: "portal-service-image",
        sourceRoot: "services/portal",
        namespace: "namespace-proof",
        workload: "portal-proof",
        container: "portal",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
      },
      {
        component: "opl-web-gateway",
        targetClass: "platform_service_target",
        repository: "opl-web-gateway-proof",
        imageTargetRef: "opl-web-gateway-service-image",
        sourceRoot: "services/opl-web-gateway",
        namespace: "namespace-proof",
        workload: "opl-web-gateway-proof",
        container: "opl-web-gateway",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
      },
      {
        component: "opl-runtime-bridge",
        targetClass: "platform_service_target",
        repository: "opl-runtime-bridge-proof",
        imageTargetRef: "opl-runtime-bridge-service-image",
        sourceRoot: "services/opl-runtime-bridge",
        namespace: "namespace-proof",
        workload: "opl-runtime-bridge-proof",
        container: "opl-runtime-bridge",
        ownerRef: "owner-proof",
        operationId: "operation-proof",
        expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001",
      },
    ],
    runtimeSmokeTargets: [
      { surface: "portal", url: "https://portal.medopl.cn/healthz", expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001", provesPushedVersion: true, provesComponents: ["portal"] },
      { surface: "opl", url: "https://opl.medopl.cn/healthz", expectedVersionMarker: "pkg-d-image-push-proof-20260511-000001", provesPushedVersion: true, provesComponents: ["opl-web-gateway", "opl-runtime-bridge"] },
      { surface: "trace", url: "https://trace.medopl.cn/api/public/health", expectedVersionMarker: "trace-surface-ok", provesPushedVersion: false, provesComponents: [] },
    ],
    ...overrides,
  };
}

function localPreflight(plan = {}) {
  const validation = validateReleasePlan(plan);
  if (!validation.ok) return { ok: false, blockedReason: validation.reason };
  return {
    ok: true,
    preflightId: `${plan.runId}-tcr-preflight`,
    targets: plan.targets.map((target) => ({
      component: target.component,
      repository: target.repository,
      imageTargetRef: target.imageTargetRef,
      sourceRoot: target.sourceRoot,
      tagUnique: plan.versionTag !== "latest",
      registryAction: "shape-only",
    })),
    callsDocker: false,
    callsRegistry: false,
  };
}

function localBuildPush(plan = {}, { acceptedPreflightId = "" } = {}) {
  if (!acceptedPreflightId) return { ok: false, blockedReason: "deploy_accepted_preflight_required" };
  const preflight = localPreflight(plan);
  if (!preflight.ok) return preflight;
  return {
    ok: true,
    reportPath: `.runtime/v22-registry/${plan.runId}-build-push.json`,
    targets: plan.targets.map((target) => ({
      component: target.component,
      registry: {
        acceptedPreflightId: `${acceptedPreflightId.slice(0, 4)}****${acceptedPreflightId.slice(-4)}`,
        digest: `sha256:${createHash("sha256").update(`${plan.runId}:${target.component}`).digest("hex")}`,
      },
    })),
    callsDocker: false,
    callsRegistry: false,
  };
}

const [contract, readme, board, status, verificationMatrix, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(readmePath, "utf8"),
  readFile(boardPath, "utf8"),
  readFile(statusPath, "utf8"),
  readFile(verificationMatrixPath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(contract + readme + board + status + verificationMatrix, [
  "cloud-lane/feat/v22-package-d-image-push-gate",
  "gpt-5.4",
  "eb23e02",
  "R-14",
  "R-15",
  "acceptedPreflightId",
  "deploy_accepted_preflight_required",
  "D2",
], "cloud_lane_d2_contract_status");

assertIncludesAll(contract, [
  "D2 不授权 kubectl dry-run、rollout、runtime smoke、rollback 或 Package C 计算/存储生命周期动作",
  "real mode 读取 deploy secret、docker login、docker build、docker push 和真实 TCR digest readback 都需要当前会话显式授权",
], "d2_non_goals");

assert(suite.includes("smoke-test-v22-package-d-image-push-gate.mjs"), "mvp_suite_must_include_package_d_image_push_gate_smoke");
assert.equal(contract.includes("scripts/v22-tencent-authorized-deploy-execution-runner.mjs"), false, "contract_must_not_reference_deleted_deploy_runner");
assert.equal(contract.includes("scripts/smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs"), false, "contract_must_not_reference_deleted_deploy_runner_smoke");

const plan = releasePlan();
const preflight = localPreflight(plan);
assert.equal(preflight.ok, true, "preflight_ok");
assert.equal(preflight.callsDocker, false, "preflight_must_not_call_docker");
assert.equal(preflight.callsRegistry, false, "preflight_must_not_call_registry");

const blockedBuildPush = localBuildPush(plan);
assert.equal(blockedBuildPush.ok, false, "build_push_without_preflight_must_block");
assert.equal(blockedBuildPush.blockedReason, "deploy_accepted_preflight_required", "build_push_without_preflight_must_block_reason");

const buildPush = localBuildPush(plan, { acceptedPreflightId: preflight.preflightId });
assert.equal(buildPush.ok, true, "build_push_ok");
assert.equal(buildPush.reportPath.endsWith(".runtime/v22-registry/pkg-d-image-push-proof-build-push.json"), true, "build_push_report_path");
assert.equal(buildPush.targets.every((target) => /^sha256:[a-f0-9]{64}$/.test(target.registry?.digest || "")), true, "build_push_digest_shape");
assert.equal(buildPush.targets.every((target) => String(target.registry?.acceptedPreflightId || "").includes("****")), true, "build_push_preflight_id_masked");
assert.equal(JSON.stringify(buildPush).includes("$TCR_SECRET"), false, "build_push_must_not_contain_secret_material");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_package_d_image_push_gate",
  branch: "cloud-lane/feat/v22-package-d-image-push-gate",
  model: "gpt-5.4",
  checked: [
    "long_lived_cloud_lane_recorded",
    "d1_d2_stack_recorded",
    "build_push_requires_accepted_preflight",
    "local_shape_preflight_build_push_reports_sanitized",
    "real_push_not_claimed",
  ],
}, null, 2));
