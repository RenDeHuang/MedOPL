import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
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
] = await Promise.all([
  readRepoFile("docs/specs/README.md"),
  readRepoFile("specs/product/spec.md"),
  readRepoFile("docs/product/README.md"),
  readRepoFile("specs/runtime/spec.md"),
  readRepoFile("docs/runtime/README.md"),
  readRepoFile("specs/source/spec.md"),
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
  "登录 `portal.medopl.cn` -> 工作空间 -> 上传文件 / 提任务 -> 进入 OPL / 工作台 -> 看结果 -> 看费用",
  "用户在 OPL entry/preflight 或工作台 provider 绑定面输入自己的 gflabtoken API Key",
  "已绑定用户不要求重复输入",
  "starter_2c4g_10gb",
  "pro_8c16g_100gb",
  "7 天保护期",
  "`120min`",
  "`T+1`",
  "释放计算资源不删除文件空间",
], "mvp_loop_product_truth");

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
  "OPL workbench entry 与 managed run 是两道 gate",
  "Portal frontend -> Go backend `/api`",
  "Runtime Bridge 负责 session/message/run/file/artifact/provider route/providerKeyRef/trace projection",
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
