import assert from "node:assert/strict";

const {
  resolvePlan,
  renderShellPlan,
} = await import("../deploy/tke-package/scripts/build-and-push-tcr.mjs");

const plan = resolvePlan({
  argv: [
    "--tag", "opl-v20.32",
    "--sync-source", "1",
    "--skip-login", "1",
    "--allow-tracked-env", "1",
    "--manifest-out-dir", "deploy/tke-package/rendered-v20.32-plan",
    "--runner-workload-image", "uswccr.ccs.tencentyun.com/gaofenglab/med-autoscience-runner-opl:opl-v20.32",
  ],
  repoRoot: process.cwd(),
  env: {
    ...process.env,
    TCR_PASSWORD: "",
  },
});

assert.equal(plan.releaseTag, "opl-v20.32", "v20_32_plan_must_use_v20_32_tag");
assert.equal(plan.pushBlocked, false, `v20_32_plan_must_not_be_validation_blocked:${plan.validationErrors.join(";")}`);
assert.equal(plan.manifest.buildSha, "opl-v20.32", "v20_32_manifest_build_sha_mismatch");
assert.match(plan.manifest.outDir, /rendered-v20\.32-plan$/, "v20_32_manifest_out_dir_must_be_v20_32_specific");
assert.doesNotMatch(plan.manifest.outDir, /rendered-v20\.31-plan$/, "v20_32_manifest_out_dir_must_not_reuse_v20_31_plan_dir");
assert.equal(plan.manifest.allImagesUseReleaseTag, true, "v20_32_manifest_images_must_use_release_tag");

for (const image of Object.values(plan.manifest.vars).filter((value) => String(value || "").includes("uswccr.ccs.tencentyun.com/gaofenglab/"))) {
  assert.match(String(image), /:opl-v20\.32$/, `v20_32_manifest_image_tag_mismatch:${image}`);
}
for (const operation of plan.sync.operations) {
  assert.deepEqual(
    operation.excludeBasenames,
    [".git", ".hg", ".svn", "node_modules", "dist", "coverage", ".cache"],
    `v20_32_sync_must_exclude_build_and_vcs_metadata:${operation.source}`,
  );
}

const shellPlan = renderShellPlan(plan);
assert.match(shellPlan, /--out-dir '.*rendered-v20\.32-plan'/, "v20_32_shell_plan_must_render_to_v20_32_dir");
assert.match(shellPlan, /portal-opl:opl-v20\.32/, "v20_32_shell_plan_must_build_portal_image");
assert.match(shellPlan, /opl-web-opl:opl-v20\.32/, "v20_32_shell_plan_must_build_upstream_opl_web_image");
assert.doesNotMatch(shellPlan, /rendered-v20\.31-plan/, "v20_32_shell_plan_must_not_reference_v20_31_render_dir");
assert.match(shellPlan, /filter:\s*\(src\)\s*=>\s*!excluded\.has/, "v20_32_shell_plan_must_filter_vcs_metadata_during_sync");
assert.match(shellPlan, /rmSync\(.*recursive:\s*true,\s*force:\s*true/, "v20_32_shell_plan_must_clean_sync_target_before_copy");
assert.match(shellPlan, /node_modules/, "v20_32_shell_plan_must_exclude_node_modules_from_sync");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_tke_build_plan",
  releaseTag: plan.releaseTag,
  manifestOutDir: plan.manifest.outDir,
}, null, 2));
