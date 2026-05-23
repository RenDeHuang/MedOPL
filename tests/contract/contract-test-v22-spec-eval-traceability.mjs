import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const domains = Object.freeze(["product", "runtime", "framework", "operations", "evidence", "policies", "source"]);

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label}_missing:${expected}`);
}

const rootSpecs = await readRepoFile("specs/README.md");
assertIncludes(rootSpecs, "requirement id", "root_specs_traceability");
assertIncludes(rootSpecs, "required evals", "root_specs_traceability");
assertIncludes(rootSpecs, "cannot-claim boundary", "root_specs_traceability");
assertIncludes(rootSpecs, "## Traceability Invariants", "root_specs_traceability");
assertIncludes(rootSpecs, "Every durable requirement must map to at least one local deterministic eval or an explicit future-authorized boundary eval.", "root_specs_traceability");

const allSpecs = [];
for (const domain of domains) {
  const repoPath = `specs/${domain}/spec.md`;
  assert.equal(await exists(repoPath), true, `domain_spec_missing:${domain}`);
  const source = await readRepoFile(repoPath);
  allSpecs.push(source);
  for (const heading of ["Requirement", "Owner plane", "Source surface", "Required evals", "Evidence level", "Cannot claim"]) {
    assertIncludes(source, heading, `domain_spec_traceability:${domain}`);
  }
  assert(source.includes(`\`${domain}:`) || source.includes("operations:") || source.includes("runtime:") || source.includes("product:") || source.includes("framework:") || source.includes("evidence:") || source.includes("policies:") || source.includes("source:"), `domain_spec_must_define_requirement_id:${domain}`);
  assert(/node (?:tests|scripts)\//u.test(source), `domain_spec_must_reference_eval_command:${domain}`);
}

const joinedSpecs = allSpecs.join("\n");
for (const requiredEval of [
  "node tests/smoke/smoke-test-v22-saas-control-plane-user-experience-boundary.mjs",
  "node tests/smoke/smoke-test-v22-runtime-bridge-session-run-file-provider-keyref-flow.mjs",
  "node tests/contract/contract-test-v22-change-package-lifecycle.mjs",
  "node tests/contract/contract-test-v22-framework-truth-layering.mjs",
  "node tests/contract/contract-test-v22-docs-portfolio-lifecycle.mjs",
]) {
  assertIncludes(joinedSpecs, requiredEval, `spec_eval_trace_required:${requiredEval}`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "v22_spec_eval_traceability",
  domains,
}, null, 2));
