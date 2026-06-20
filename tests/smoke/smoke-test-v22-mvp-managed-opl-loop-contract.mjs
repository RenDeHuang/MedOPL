import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludesAll(source, expectedItems, label) {
  for (const expected of expectedItems) {
    assert(source.includes(expected), `${label}_missing:${expected}`);
  }
}

function assertExcludesAll(source, forbiddenItems, label) {
  for (const forbidden of forbiddenItems) {
    assert.equal(source.includes(forbidden), false, `${label}_must_not_include:${forbidden}`);
  }
}

const [
  specsIndex,
  productSpec,
  productTruth,
  runtimeSpec,
  runtimeTruth,
  sourceSpec,
  productProfile,
  apiContract,
] = await Promise.all([
  readRepoFile("docs/specs/README.md"),
  readRepoFile("specs/product/spec.md"),
  readRepoFile("docs/product/README.md"),
  readRepoFile("specs/runtime/spec.md"),
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("specs/source/spec.md"),
  readJson("contracts/medopl-product-profile.json"),
  readJson("contracts/medopl-api-contract.json"),
]);

assert.equal(specsIndex.split("\n").length <= 400, true, `specs_index_line_budget_exceeded:${specsIndex.split("\n").length}`);
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_machine_json");
assertIncludesAll(specsIndex, [
  "spec:v22-mvp-managed-opl-loop",
  "specs/product/spec.md",
  "specs/runtime/spec.md",
], "mvp_loop_specs_index");

assertIncludesAll(productSpec, [
  "`product:managed-opl-service`",
  "`product:no-cloud-console-language`",
  "`product:starter-2c4g-10gb-plan-catalog`",
], "mvp_loop_product_spec");

assertIncludesAll(productTruth, [
  "MedOPL v22 是 `platform-provisioned / customer-dedicated`",
  "MedOPL 不是云资源控制台",
  "OPL-Webui 是主要 consumer / entry surface",
  "OPL-Webui 负责 ordinary chat",
  "runtime_required",
  "已绑定用户不要求重复输入",
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "7 天保护期",
  "`120min`",
  "`T+1`",
  "释放计算资源不删除存储空间",
], "mvp_loop_product_truth");

assert.equal(productProfile.medopl_product_profile.primary_consumer_surface.name, "opl-webui", "mvp_loop_primary_consumer_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface.ordinary_chat_owner, "opl-webui", "mvp_loop_ordinary_chat_owner_must_be_opl_webui");
assert.equal(productProfile.medopl_product_profile.primary_consumer_surface.runtime_required_owner, "medopl", "mvp_loop_runtime_required_owner_must_be_medopl");
assert.equal(apiContract.medopl_api_contract.runtime_gate.route, "POST /api/opl/runtime-gate", "mvp_loop_runtime_gate_route_mismatch");
assert.deepEqual(apiContract.medopl_api_contract.runtime_gate.invocation_modes, ["api_only", "ordinary_chat", "runtime_required"], "mvp_loop_runtime_gate_modes_mismatch");

assertExcludesAll(productTruth, [
  "用户自配云资源",
  "云资源控制台配置",
  "custom_package",
], "mvp_loop_product_truth");

assertIncludesAll(runtimeSpec, [
  "`runtime:bridge-projection`",
  "`runtime:go-control-plane-mvp-api`",
  "`runtime:go-local-rc-parity`",
  "providerKeyRef",
], "mvp_loop_runtime_spec");

assertIncludesAll(runtimeTruth, [
  "OPL entry 与 managed run 是两道 gate",
  "Portal frontend -> Go backend `/api`",
  "Runtime Bridge 只负责 OPL integration reference",
], "mvp_loop_runtime_truth");

assertIncludesAll(sourceSpec, [
  "`source:go-control-plane-mvp-takeover`",
  "`source:portal-typed-api-contract`",
  "`source:node-portal-backend-physical-removal`",
], "mvp_loop_source_spec");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_mvp_managed_opl_loop",
  source: "durable_specs_and_product_runtime_truth",
  specsIndexLines: specsIndex.split("\n").length,
}, null, 2));
