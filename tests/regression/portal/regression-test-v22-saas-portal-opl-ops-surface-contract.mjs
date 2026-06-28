import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendUserSurfacePaths = [
  "../../../services/portal/frontend/src/app/components/Layout.tsx",
  "../../../services/portal/frontend/src/app/pages/Overview.tsx",
  "../../../services/portal/frontend/src/app/pages/PackagesPurchase.tsx",
  "../../../services/portal/frontend/src/app/pages/RuntimeEnvironment.tsx",
  "../../../services/portal/frontend/src/app/pages/Workspace.tsx",
  "../../../services/portal/frontend/src/app/pages/BillingAudit.tsx",
  "../../../services/portal/frontend/src/app/pages/OPLEntry.tsx",
].map((relativePath) => path.join(__dirname, relativePath));

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

function extractQuotedAttribute(template, attributeName) {
  const values = [];
  const pattern = new RegExp(`\\s:?${attributeName}="([^"]*)"`, "g");
  let match;
  while ((match = pattern.exec(template)) !== null) values.push(match[1]);
  return values.join("\n");
}

function extractArrayConst(source, constName) {
  const start = source.indexOf(`const ${constName} = [`);
  assert.notEqual(start, -1, `array_const_missing:${constName}`);
  const bodyStart = source.indexOf("[", start);
  const bodyEnd = source.indexOf("];", bodyStart);
  assert.notEqual(bodyEnd, -1, `array_const_end_missing:${constName}`);
  return source.slice(bodyStart, bodyEnd + 1);
}

function extractTsxVisibleCopy(source) {
  const stringLiterals = [...source.matchAll(/["'`]([^"'`]*[一-龥][^"'`]*)["'`]/g)]
    .map((match) => match[1]);
  const visibleAttributes = ["title", "subtitle", "description", "label", "hint", "placeholder"]
    .map((attribute) => extractQuotedAttribute(source, attribute));
  const jsxText = source
    .replace(/import[\s\S]*?;\n/g, " ")
    .replace(/type\s+[A-Za-z0-9_]+\s*=[\s\S]*?;\n/g, " ")
    .replace(/interface\s+[A-Za-z0-9_]+\s*\{[\s\S]*?\n\}/g, " ")
    .replace(/\{[\s\S]*?\}/g, " ")
    .replace(/<[^>]+>/g, " ");
  return [...stringLiterals, ...visibleAttributes, jsxText].join("\n");
}

async function frontendBeginnerVisibleSurface() {
  return (await Promise.all(frontendUserSurfacePaths.map(async (filePath) => {
    const source = await readFile(filePath, "utf8");
    const visibleSource = filePath.endsWith("Layout.tsx") ? extractArrayConst(source, "userNavigation") : source;
    return extractTsxVisibleCopy(visibleSource);
  }))).join("\n");
}

const [
  specsIndex,
  runtimeSpec,
  productReadme,
  sourceSpec,
  visibleSurface,
] = await Promise.all([
  readFile("docs/specs/README.md", "utf8"),
  readFile("specs/runtime/spec.md", "utf8"),
  readFile("docs/product/README.md", "utf8"),
  readFile("specs/source/spec.md", "utf8"),
  frontendBeginnerVisibleSurface(),
]);

assert(specsIndex.includes("spec:v22-saas-portal-opl-ops-surface-boundary"), "specs_index_must_reference_saas_surface_contract");
assert(specsIndex.includes("specs/runtime/spec.md"), "specs_index_must_point_to_runtime_spec");
assert.equal(/```json/u.test(specsIndex), false, "specs_index_must_not_embed_saas_surface_json");

assert(runtimeSpec.includes("`runtime:saas-portal-opl-ops-surface-boundary`"), "runtime_spec_must_own_saas_surface_requirement");
assert(runtimeSpec.includes("spec:v22-portal-resource-control-ui-composition-boundary"), "runtime_spec_must_reference_composition_contract");
assert(runtimeSpec.includes("cloud-console UX"), "runtime_spec_must_keep_cloud_console_cannot_claim");
assert(runtimeSpec.includes("raw provider key exposure"), "runtime_spec_must_keep_raw_key_cannot_claim");

assertIncludesAll(productReadme, [
  "MedOPL 不是云资源控制台。",
  "普通用户产品语言不展示 CVM、COS、K8s、节点池或云控制台配置。",
  "用户侧只回答六个资源问题",
  "Portal 是 SaaS 控制面，不是科研 chatbot 或云控制台",
  "管理台和普通用户边界",
  "进入 OPL",
  "绑定自己的 gflabtoken 模型调用密钥",
], "product_readme_saas_surface_owner");
assertExcludesAll(productReadme, [
  "普通用户配置 CVM",
  "普通用户配置 COS",
  "普通用户配置 K8s",
  "普通用户云资源控制台",
], "product_readme_forbidden_cloud_console_claim");

assertIncludesAll(sourceSpec, [
  "`source:portal-resource-control-ui-composition`",
  "/overview",
  "/packages",
  "/compute",
  "/storage",
  "/usage",
  "/opl",
  "/advanced/servers",
], "source_spec_ui_composition_owner");
assertExcludesAll(sourceSpec, [
  "Required user routes:\n\n- `/overview`\n- `/packages`\n- `/resources`",
  "Required user routes:\n\n- `/overview`\n- `/packages`\n- `/compute`\n- `/storage`\n- `/trace`",
], "source_spec_must_not_require_trace_user_route");
assertIncludesAll(sourceSpec, [
  "- `/compute`",
  "- `/storage`",
  "- `/usage`",
  "- `/opl`",
  "- `/resources`",
  "- `/workspace`",
  "- `/billing`",
  "- `/opl-launch`",
  "- `/portal/opl`",
], "source_spec_canonical_and_retired_route_truth");

assertIncludesAll(visibleSurface, [
  "资源总览",
  "套餐与购买",
  "计算资源",
  "存储空间",
  "费用与用量",
  "进入 OPL",
  "你的 OPL 云端计算资源和存储空间当前状态",
  "我买了什么资源",
  "资源是否可用",
  "存储空间里有什么",
  "费用是多少",
  "开通计算资源",
  "存储空间",
  "输入文件",
  "输出文件",
  "余额",
  "账单",
  "用量明细",
  "费用估算",
  "冻结金额",
  "账号开通/批准、充值/授信、套餐、计算资源、存储空间和账单核对",
  "account approved + plan/balance/quota",
  "按套餐余额和 quota 核对",
  "审计状态",
  "gflabtoken 模型调用密钥",
], "frontend_beginner_surface_copy");

assertExcludesAll(visibleSurface, [
  "任务与结果",
  "运行轨迹",
  "Trace",
  "traceId",
  "session internal audit metadata",
  "云资源控制台",
  "cloud console",
  "tenantId",
  "resourceBinding",
  "serverPlan",
  "billing tags",
  "launchToken",
  "runtimeToken",
  "raw API key",
  "raw provider key",
  "backend secret boundary",
  "API key",
  "API Key",
  "编号",
], "frontend_beginner_surface_copy");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_saas_portal_opl_ops_surface_boundary",
  checked: [
    "runtime_spec_owner",
    "product_readme_surface_truth",
    "source_spec_ui_composition_owner",
    "frontend_beginner_surface_copy",
    "trace_task_header_copy",
  ],
}, null, 2));
