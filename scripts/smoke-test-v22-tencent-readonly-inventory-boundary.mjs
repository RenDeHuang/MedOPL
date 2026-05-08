import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractPath = "docs/contracts/v22-tencent-readonly-inventory-boundary.md";
const readmePath = "docs/contracts/README.md";
const suitePath = "scripts/smoke-test-v22-mvp-contract-suite.mjs";

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert(source.includes(phrase), `${label}_missing:${phrase}`);
  }
}

function assertNotIncludesAny(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const [contract, readme, suite] = await Promise.all([
  readFile(contractPath, "utf8"),
  readFile(readmePath, "utf8"),
  readFile(suitePath, "utf8"),
]);

assertIncludesAll(readme, [
  "v22-tencent-readonly-inventory-boundary.md",
  "readonly/tencent inventory",
  "mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> readonly/tencent inventory -> authorized/tencent create/release",
], "contracts_readme_inventory");

assertIncludesAll(suite, [
  "smoke-test-v22-tencent-readonly-inventory-boundary",
], "mvp_suite_inventory");

assertIncludesAll(contract, [
  "v22 Tencent Readonly Inventory Boundary",
  "readonly/tencent inventory",
  "mock/snapshot -> readonly/tencent quote -> dry-run/tencent plan -> readonly/tencent inventory -> authorized/tencent create/release",
  "只做真实云只读盘点",
  "不代表后续不能创建、删除、释放、扩缩容、改标签",
  "创建、删除、释放、扩缩容、改标签属于后续 authorized create/release 阶段",
  "必须另开 feat/* 并单独授权",
], "contract_stage_boundary");

assertIncludesAll(contract, [
  "云上有哪些 MedOPL 资源",
  "资源标签是否完整",
  "资源是否能映射到账号、工作空间、resourceOrderId、resourceBindingId",
  "孤儿资源",
  "标签缺失",
  "标签冲突",
  "区域不一致",
  "T+1 对账",
  "create/release 安全执行",
], "contract_purpose");

assertIncludesAll(contract, [
  "/home/dev/.secrets/medopl/secrets.env.txt",
  "allowlist_only",
  "不允许“一读全读”",
  "RUN_TENCENT_READONLY_INVENTORY",
  "TENCENT_READONLY_SECRET_ID",
  "TENCENT_READONLY_SECRET_KEY",
  "TENCENT_READONLY_REGIONS",
  "TENCENT_READONLY_ALLOWED_APIS",
  "TENCENT_READONLY_ACCOUNT_ID",
  "TENCENT_MUTATION_SECRET_ID",
  "TENCENT_MUTATION_SECRET_KEY",
  "RUN_TENCENT_CREATE_RELEASE",
  "LANGFUSE_SECRET_KEY",
  "GITHUB_TOKEN",
  "DATABASE_URL",
  "SSH_PRIVATE_KEY",
  "kubeconfig",
  "raw API Key",
], "contract_secret_allowlist");

assertIncludesAll(contract, [
  "Describe",
  "List",
  "Get",
  "Head",
  "账号身份摘要",
  "CVM 实例列表、状态、标签",
  "TKE 集群 / namespace / node pool 只读摘要和标签",
  "COS bucket 列表、bucket 标签、prefix 用量摘要",
  "COS object metadata / HEAD",
  "不读取对象正文",
  "Tencent tag resources 只读查询",
  "账单 / 费用只读摘要",
], "contract_readonly_api_allowlist");

assertIncludesAll(contract, [
  "Create*",
  "Delete*",
  "Modify*",
  "Run*",
  "Terminate*",
  "Attach*",
  "Detach*",
  "PutBucket*",
  "PutObject*",
  "DeleteObject*",
  "Update*",
  "Tag mutation",
  "bucket policy 修改",
], "contract_forbidden_mutation_api");

assertIncludesAll(contract, [
  "不读取 COS 对象正文",
  "不下载用户文件",
  "不打印用户文件内容",
  "bucket / prefix / object metadata",
  "用量摘要",
  "账单明细",
  "资源标签",
  "objectKey、storageKey、cosPrefix、signedUrl 不得进入普通用户 payload、日志或 evidence",
], "contract_cos_boundary");

assertIncludesAll(contract, [
  "accountMasked",
  "region",
  "resourceType",
  "resourceStatus",
  "tagCompleteness",
  "portalMappingStatus",
  "orphanResourceCount",
  "missingTagCount",
  "conflictCount",
  "auditQueueItems",
  "不得输出",
  "SecretId / SecretKey",
  "CVM instance raw full object",
  "COS object 正文",
  "provider raw response 全量",
], "contract_output_boundary");

assertIncludesAll(contract, [
  "Portal 账本 + 云标签双重校验",
  "accountId / portal account",
  "workspaceId",
  "resourceOrderId",
  "resourceBindingId",
  "serverPlanId",
  "runId 可为空",
  "resource type",
  "region",
  "不能只靠资源名称、创建时间、IP、规格推断归属",
  "fail-closed",
  "admin 审计队列",
], "contract_mapping_rules");

assertIncludesAll(contract, [
  "删除计算资源前必须证明 resourceBindingId、workspaceId、accountId 一致",
  "删除存储资源/文件空间前必须证明 storage entitlement 和 workspaceId 一致",
  "释放计算资源不得删除文件空间",
  "删除文件空间才进入 7 天保护期",
], "contract_delete_release_safety");

assertIncludesAll(contract, [
  "不读取 /home/dev/.secrets/medopl/secrets.env.txt",
  "不调用真实腾讯云/COS/TKE/CVM/账单 API",
  "不创建、删除、释放、扩缩容、改标签、改权限",
  "不真实扣费",
  "不运行 build/push/kubectl/live-test",
  "不修改 deploy/.sentrux/adapters/upstream/Gateway/Runtime Bridge",
], "contract_current_non_goals");

assertIncludesAll(contract, [
  "\"implementsRealCloudCall\": false",
  "\"readsSecretNow\": false",
  "\"futureSecretFileAllowed\": true",
  "\"secretLoadMode\": \"allowlist_only\"",
  "\"allowedReadonlySecretKeys\"",
  "\"forbiddenSecretKeys\"",
  "\"allowedApiVerbs\"",
  "\"forbiddenApiVerbs\"",
  "\"allowsCosMetadataAndUsageRead\": true",
  "\"forbidsCosObjectBodyRead\": true",
  "\"outputRedactionRequired\": true",
  "\"requiresPortalLedgerAndCloudTagMatch\": true",
  "\"failClosedOnMissingOrConflictingOwnership\": true",
  "\"createReleaseMayProceedAfterInventoryPass\": true",
], "contract_data");

assertNotIncludesAny(contract, [
  "\"readsSecretNow\": true",
  "\"implementsRealCloudCall\": true",
  "\"secretLoadMode\": \"read_all\"",
  "\"forbidsCosObjectBodyRead\": false",
  "\"failClosedOnMissingOrConflictingOwnership\": false",
], "contract_forbidden_data_values");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_tencent_readonly_inventory_boundary",
  checked: {
    contractPath,
    readmePath,
    suitePath,
  },
}, null, 2));
