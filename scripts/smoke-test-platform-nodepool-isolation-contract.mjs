import { readFile } from "node:fs/promises";

const PLATFORM_SELECTOR_KEY = "gaofenglab/node-pool-role";
const PLATFORM_SELECTOR_VALUE = "platform";
const PLATFORM_TAINT_KEY = "gaofenglab/node-pool-role";
const PLATFORM_TAINT_VALUE = "platform";
const PLATFORM_TAINT_EFFECT = "NoSchedule";

const MANIFEST_CHECKS = [
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    names: [
      "portal",
      "portal-opl-adapter",
      "opl-web-upstream",
      "opl-web-gateway",
      "billing-aggregator",
      "resource-provisioner",
      "med-autoscience-runner",
    ],
  },
  {
    file: "deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml",
    kind: "CronJob",
    names: ["billing-reconcile"],
  },
  {
    file: "deploy/tke-package/manifests/08-langfuse-stack.yaml",
    kind: "Deployment",
    names: ["langfuse-postgres", "langfuse-clickhouse", "langfuse-redis", "langfuse-web", "langfuse-worker"],
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function splitDocuments(raw) {
  return raw
    .replace(/^\uFEFF/, "")
    .split(/\n---\s*\n/g)
    .map((item) => item.trimEnd())
    .filter(Boolean);
}

function manifestName(document) {
  const match = document.match(/\nmetadata:\n(?:  .+\n)*?  name:\s*"?([^"\n]+)"?/);
  return match?.[1]?.trim() || "";
}

function manifestKind(document) {
  const match = document.match(/^kind:\s*"?([^"\n]+)"?/m);
  return match?.[1]?.trim() || "";
}

function findManifest(documents, kind, name) {
  return documents.find((document) => manifestKind(document) === kind && manifestName(document) === name) || "";
}

function expectPlatformScheduling(document, label) {
  assert(
    new RegExp(`nodeSelector:\\n\\s+${PLATFORM_SELECTOR_KEY}: "${PLATFORM_SELECTOR_VALUE}"`).test(document),
    `${label} missing platform nodeSelector ${PLATFORM_SELECTOR_KEY}=${PLATFORM_SELECTOR_VALUE}`,
  );
  assert(
    new RegExp(`tolerations:\\n\\s+- key: "${PLATFORM_TAINT_KEY}"\\n\\s+operator: "Equal"\\n\\s+value: "${PLATFORM_TAINT_VALUE}"\\n\\s+effect: "${PLATFORM_TAINT_EFFECT}"`).test(document),
    `${label} missing platform toleration ${PLATFORM_TAINT_KEY}=${PLATFORM_TAINT_VALUE}:${PLATFORM_TAINT_EFFECT}`,
  );
}

for (const check of MANIFEST_CHECKS) {
  const documents = splitDocuments(await readFile(check.file, "utf8"));
  for (const name of check.names) {
    const document = findManifest(documents, check.kind, name);
    assert(document, `${check.kind}/${name} not found in ${check.file}`);
    expectPlatformScheduling(document, `${check.file} ${check.kind}/${name}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  contract: "platform_nodepool_isolation",
  selector: { [PLATFORM_SELECTOR_KEY]: PLATFORM_SELECTOR_VALUE },
  toleration: {
    key: PLATFORM_TAINT_KEY,
    operator: "Equal",
    value: PLATFORM_TAINT_VALUE,
    effect: PLATFORM_TAINT_EFFECT,
  },
}, null, 2));
