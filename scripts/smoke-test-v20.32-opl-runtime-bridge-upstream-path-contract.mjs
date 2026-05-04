import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dockerfile = readFileSync("deploy/tke-package/build/dockerfiles/opl-runtime-bridge.Dockerfile", "utf8");
const localEnv = readFileSync("deploy/tke-package/env/tke.env.example", "utf8");
const tcrEnv = readFileSync("deploy/tke-package/env/tke.env.tcr-gaofenglab.example", "utf8");

assert.match(
  dockerfile,
  /COPY\s+source\/\.runtime\/one-person-lab-upstream\s+\/app\/one-person-lab-upstream/,
  "v20_32_bridge_image_must_copy_upstream_runtime_outside_app_dot_runtime",
);
assert.doesNotMatch(
  dockerfile,
  /COPY\s+source\/\.runtime\/one-person-lab-upstream\s+\.\/\.runtime\/one-person-lab-upstream/,
  "v20_32_bridge_image_must_not_copy_upstream_runtime_under_app_dot_runtime",
);

assert.match(
  localEnv,
  /OPL_ACP_RUNTIME_DIR=\/app\/one-person-lab-upstream/,
  "v20_32_example_env_must_point_acp_runtime_to_image_local_upstream_path",
);
assert.match(
  tcrEnv,
  /OPL_ACP_RUNTIME_DIR=\/app\/one-person-lab-upstream/,
  "v20_32_tcr_env_must_point_acp_runtime_to_image_local_upstream_path",
);

assert.doesNotMatch(
  localEnv,
  /OPL_ACP_RUNTIME_DIR=\/app\/\.runtime\/one-person-lab-upstream/,
  "v20_32_example_env_must_not_use_pvc_overridden_path",
);
assert.doesNotMatch(
  tcrEnv,
  /OPL_ACP_RUNTIME_DIR=\/app\/\.runtime\/one-person-lab-upstream/,
  "v20_32_tcr_env_must_not_use_pvc_overridden_path",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_opl_runtime_bridge_upstream_path",
  checked: [
    "bridge_image_copies_upstream_runtime_to_app_local_path",
    "example_env_targets_app_local_upstream_path",
    "tcr_env_targets_app_local_upstream_path",
  ],
}, null, 2));
