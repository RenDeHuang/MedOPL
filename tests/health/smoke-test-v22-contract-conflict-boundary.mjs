import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const recoveryDocs = [
  "docs/recovery/status-matrix.md",
  "docs/recovery/mvp-contract-acceptance.md",
];
const mvpSuitePath = "tests/contract/smoke-test-v22-mvp-contract-suite.mjs";

async function readRepoFile(filePath) {
  return readFile(path.join(repoRoot, filePath), "utf8");
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function addRegexFindings(findings, filePath, source, regex, type, detail) {
  for (const match of source.matchAll(regex)) {
    findings.push({
      type,
      file: filePath,
      line: lineOf(source, match.index ?? 0),
      match: match[0].replace(/\s+/g, " ").trim(),
      detail,
    });
  }
}

function assertNoFindings(findings) {
  assert.deepEqual(findings, [], JSON.stringify({
    ok: false,
    contract: "v22_contract_conflict_boundary",
    findings,
  }, null, 2));
}

function defaultSuiteScriptNames(suiteSource) {
  const names = [];
  const smokeScriptsBlock = suiteSource.match(/const smokeScripts = \[([\s\S]*?)\];/);
  if (!smokeScriptsBlock) {
    return names;
  }

  const scriptRegex = /"scripts\/([^"]+\.mjs)"/g;
  for (const match of smokeScriptsBlock[1].matchAll(scriptRegex)) {
    names.push(match[1]);
  }
  return names;
}

const docEntries = await Promise.all(
  [
    "docs/contracts/README.md",
    ...(await readdir(path.join(repoRoot, "docs/contracts")))
      .filter((name) => /^v22-.*\.md$/u.test(name))
      .sort()
      .map((name) => `docs/contracts/${name}`),
    ...recoveryDocs,
  ].map(async (filePath) => [filePath, await readRepoFile(filePath)]),
);
const docsToScan = docEntries.map(([filePath]) => filePath);
const mvpSuite = await readRepoFile(mvpSuitePath);

const findings = [];

const resourceOrderIdAsRequiredPrimary = /(?:fixed|required|mandatory|must|必须|固定|必填|主标签|主归因|primary|requiredTag|requiredTags|fixedTags)[^\n`|,[\]]{0,160}\bresourceorderid\b|\bresourceorderid\b[^\n`|,[\]]{0,160}(?:fixed|required|mandatory|must|必须|固定|必填|主标签|主归因|primary|requiredTag|requiredTags|fixedTags)/giu;
const bareResourceOrderId = /\bresourceOrderId\b/g;
const legacyResourceOrderId = /\blegacyResourceOrderId\b/g;
const defaultRunnableNames = /\bRunnable Cloud Connection Path\b|["`]runnablePath["`]|["`]allowedKubectlActions["`]|["`]allowedRegistryActions["`]/g;
const dangerousNowTrue = /["`]?(?:defaultExecutable|readsSecretNow|implementsRealCloudCallNow|implementsRealCloudCall|buildPushNow|pushNow|kubectlNow|deployNow|liveTestNow|runtimeSmokeNow|runsBuildNow|runsPushNow|runsKubectlNow)["`]?\s*[:=]\s*true\b/g;

for (const [filePath, source] of docEntries) {
  addRegexFindings(
    findings,
    filePath,
    source,
    resourceOrderIdAsRequiredPrimary,
    "resource_order_id_required_primary_tag",
    "resourceOrderId/resourceorderid must not be a fixed required v22 attribution tag.",
  );

  addRegexFindings(
    findings,
    filePath,
    source,
    bareResourceOrderId,
    "resource_order_id_retired_from_contract_surface",
    "Use resourceBindingId, cloudOperationId, billingAttributionId, workspaceId, accountId, serverPlanId, environmentId, or runId; retired resource-order identifiers must not remain as v22 attribution fields.",
  );

  addRegexFindings(
    findings,
    filePath,
    source,
    legacyResourceOrderId,
    "legacy_resource_order_id_retired_from_contract_surface",
    "Do not retain legacyResourceOrderId as an optional or migration alias in v22 contracts.",
  );

  addRegexFindings(
    findings,
    filePath,
    source,
    defaultRunnableNames,
    "future_authorized_path_named_as_default_runnable",
    "Future cloud/kubectl/registry authorization paths must not be named as default runnable paths.",
  );

  addRegexFindings(
    findings,
    filePath,
    source,
    dangerousNowTrue,
    "current_external_capability_marked_executable",
    "Current contract state must not mark secret, real cloud, build/push, kubectl, deploy, live-test, or default executable capability as true.",
  );
}

const liveCanaryScripts = [
  "smoke-test-v22-real-opl-canary.mjs",
  "smoke-test-v22-real-opl-webui-canary.mjs",
  "smoke-test-v22-real-opl-webui-runtime-bridge-flow.mjs",
  "smoke-test-v22-real-opl-provider-message-live-canary.mjs",
  "smoke-test-v22-tencent-readonly-inventory-real-live-run.mjs",
  "smoke-test-v22-tencent-authorized-resource-lifecycle-runner.mjs",
  "smoke-test-v22-tencent-authorized-deploy-execution-runner.mjs",
];

const defaultSuiteNames = defaultSuiteScriptNames(mvpSuite);
for (const liveScript of liveCanaryScripts) {
  if (defaultSuiteNames.includes(liveScript)) {
    findings.push({
      type: "default_mvp_suite_includes_authorized_live_canary",
      file: mvpSuitePath,
      line: lineOf(mvpSuite, mvpSuite.indexOf(liveScript)),
      match: liveScript,
      detail: "Default local MVP suite must not execute authorized live canary scripts.",
    });
  }
}

const mvpAcceptance = docEntries.find(([filePath]) => filePath === "docs/recovery/mvp-contract-acceptance.md")?.[1] ?? "";
const legacyMvpAliasSection = mvpAcceptance.match(/## Legacy 本地 MVP regression alias([\s\S]*?)(?:\n## |\n$)/)?.[1] ?? "";
if (legacyMvpAliasSection) {
  for (const liveScript of liveCanaryScripts) {
    const index = legacyMvpAliasSection.indexOf(liveScript);
    if (index !== -1) {
      findings.push({
        type: "legacy_mvp_alias_section_lists_authorized_live_canary",
        file: "docs/recovery/mvp-contract-acceptance.md",
        line: lineOf(mvpAcceptance, mvpAcceptance.indexOf(legacyMvpAliasSection) + index),
        match: liveScript,
        detail: "Legacy local-regression alias documentation must list live canaries only in the authorized external canary section.",
      });
    }
  }
} else {
  findings.push({
    type: "mvp_acceptance_legacy_mvp_alias_section_missing",
    file: "docs/recovery/mvp-contract-acceptance.md",
    line: 1,
    match: "## Legacy 本地 MVP regression alias",
    detail: "MVP acceptance must split the legacy local-regression alias from authorized external canaries.",
  });
}

assertNoFindings(findings);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_contract_conflict_boundary",
  checked: {
    docs: docsToScan,
    defaultSuite: mvpSuitePath,
  },
}, null, 2));
