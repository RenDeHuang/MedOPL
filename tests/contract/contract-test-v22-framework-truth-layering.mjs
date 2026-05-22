import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const files = {
  docsIndex: "docs/README.md",
  active: "docs/active/README.md",
  product: "docs/product/README.md",
  runtime: "docs/runtime/README.md",
  framework: "docs/framework/README.md",
  specs: "docs/specs/README.md",
  evidence: "docs/evidence/README.md",
  policies: "docs/policies/README.md",
  delivery: "docs/delivery/README.md",
  history: "docs/history/README.md",
  testsReadme: "tests/README.md",
  manifest: "tests/fixtures/v22/agent-verify-manifest.json",
  current: "tests/fixtures/v22/goal-current.json",
};

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function readJson(repoPath) {
  return JSON.parse(await readRepoFile(repoPath));
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

function assertIncludesAll(source, phrases, label) {
  for (const phrase of phrases) assertIncludes(source, phrase, label);
}

function assertExcludesAll(source, phrases, label) {
  for (const phrase of phrases) {
    assert.equal(source.includes(phrase), false, `${label}_must_not_include:${phrase}`);
  }
}

const [
  docsIndex,
  active,
  product,
  runtime,
  framework,
  specs,
  evidence,
  policies,
  delivery,
  history,
  testsReadme,
  manifest,
  current,
] = await Promise.all([
  readRepoFile(files.docsIndex),
  readRepoFile(files.active),
  readRepoFile(files.product),
  readRepoFile(files.runtime),
  readRepoFile(files.framework),
  readRepoFile(files.specs),
  readRepoFile(files.evidence),
  readRepoFile(files.policies),
  readRepoFile(files.delivery),
  readRepoFile(files.history),
  readRepoFile(files.testsReadme),
  readJson(files.manifest),
  readJson(files.current),
]);

assertIncludesAll(docsIndex, [
  "docs/active/README.md` 是唯一人读 current truth",
  "docs/specs/README.md` 是唯一合同/spec truth",
  "framework",
  "evidence-after-contract",
  "docs/README -> active truth -> product/runtime/framework -> specs/evidence/policies -> delivery -> tests/fixtures/manifest -> verify -> history closeout -> next cursor",
  "docs/{active,product,runtime,framework,specs,evidence,policies,delivery,source,public,references,history}/",
  "`docs/framework/README.md`",
  "`docs/evidence/README.md`",
], "docs_index_framework_truth_layering");

assertIncludesAll(active, [
  "docs/framework/README.md",
  "docs/evidence/README.md",
  "不再从 recovery/status matrix 推断",
  "本文件只引用它们的结论，不复制成第二套 framework 或 evidence truth",
], "active_framework_pointer");

assertIncludesAll(framework, [
  "Purpose: `platform_framework_view`",
  "State: `active_framework_view`",
  "不是第二份 current truth",
  "MedOPL Platform Framework",
  "rules before status",
  "contract-light lower bound",
  "evidence-after-contract",
  "surface budget",
  "owner boundary",
  "Product Plane",
  "Integration Plane",
  "Runtime Plane",
  "Operations Plane",
  "Owner: `MedOPL Portal`",
  "Owner: `MedOPL Gateway`",
  "Owner: `MedOPL Runtime Bridge`",
  "Owner: `MedOPL Operations`",
  "Active surface",
  "Contract package",
  "Canonical source",
  "Public projection",
  "Evidence requirement",
  "Cannot claim",
  "Smoke/eval gate",
  "History boundary",
  "Default surface",
  "Drilldown surface",
  "Admission Model",
  "Readiness Model",
  "Cannot-Claim Summary",
], "framework_model_required_sections");

assertIncludesAll(evidence, [
  "Purpose: `evidence_model_view`",
  "State: `active_evidence_view`",
  "Evidence-After-Contract Rule",
  "Evidence Levels",
  "local smoke evidence",
  "local contract proof",
  "authorized canary evidence",
  "live evidence",
  "production evidence",
  "historical evidence",
  "Can-Claim / Cannot-Claim Discipline",
  "False-Claim Guards",
  "canary/proof/smoke is production truth",
], "evidence_model_required_sections");

assertIncludesAll(policies, [
  "Framework Truth-Layer Policy",
  "docs/framework/README.md",
  "docs/evidence/README.md",
  "都不是第二份 current truth",
  "不得照抄 one-person-lab 的 AI runtime",
  "不得恢复 `scripts/smoke-test-*`",
], "policies_framework_truth_layer_policy");

assertIncludes(specs, "Specs 只保合同下限，不承载 evidence log、current cursor 或 production completion claim", "specs_contract_light_rule");
assertIncludes(product, "Product Contract Groups", "product_must_remain_product_view");
assertIncludes(runtime, "Runtime Contract Groups", "runtime_must_remain_runtime_view");
assertIncludes(delivery, "Current Cursor", "delivery_must_remain_delivery_view");
assertIncludes(history, "cleanup/framework-truth-layering baseline audit", "history_must_record_baseline_audit");
assertIncludes(testsReadme, "tests/**/*.mjs` 是 v22 repo-local eval 文件族", "tests_readme_must_define_eval_taxonomy");

assertExcludesAll(framework, [
  "Codex CLI default executor",
  "family-runtime",
  "provider-hosted tick",
  "MAS / MAG / RCA",
  "App/operator drilldown",
  "Hermes / Gateway / frontdoor / MDS / default-compat",
], "framework_must_not_copy_opl_ai_runtime_semantics");

const retiredPathLiterals = [
  ["docs", "contracts", ""].join("/"),
  ["docs", "recovery", ""].join("/"),
  ["docs", "status.md"].join("/"),
  ["docs", "invariants.md"].join("/"),
  ["docs", "product.md"].join("/"),
  ["docs", "architecture.md"].join("/"),
];

assertExcludesAll(`${framework}\n${evidence}`, retiredPathLiterals, "new_framework_docs_must_not_reintroduce_retired_paths");

assert.equal(current.human_truth, "docs/active/README.md", "current_human_truth_must_remain_active");
assert.equal(current.spec_truth, "docs/specs/README.md", "current_spec_truth_must_remain_specs");
assert.equal(manifest.default_agent_entrypoint, "node scripts/v22-verify.mjs current --base origin/recovery/platform-v22-trunk", "manifest_default_entrypoint_must_remain_verify_current");

const reviewSuite = manifest.suites.find((suite) => suite.id === "review");
const localContractSuite = manifest.suites.find((suite) => suite.id === "local-contract");
assert(reviewSuite?.commands.includes("node tests/contract/contract-test-v22-framework-truth-layering.mjs"), "review_suite_must_run_framework_truth_layering");
assert(localContractSuite?.commands.includes("node tests/contract/contract-test-v22-framework-truth-layering.mjs"), "local_contract_must_run_framework_truth_layering");

console.log(JSON.stringify({
  ok: true,
  contract: "v22_framework_truth_layering",
  checked: Object.values(files).filter((file) => file.endsWith(".md") || file.endsWith(".json")),
}, null, 2));
