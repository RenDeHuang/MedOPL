import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SENSITIVE_NAME_PATTERN = /(SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|CLIENT_SECRET|DATABASE_URL|POSTGRES_URL|REDIS_URL)/;
const EXPECTED_IMAGE_PULL_SECRET = "gaofeng-tcr-key";

const CHECKS = [
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "portal",
    requiredSecretRefs: ["secret-portal", "portal-postgres-redis-secret", "secret-trace"],
    forbiddenSecretRefs: ["portal-platform-secrets", "portal-postgres-redis"],
    sensitiveEnvNames: [
      "PORTAL_ADMIN_EMAIL",
      "PORTAL_ADMIN_PASSWORD",
      "PORTAL_OIDC_CLIENT_SECRET",
      "PORTAL_INTERNAL_AUTH_TOKEN",
      "PORTAL_POSTGRES_URL",
      "PORTAL_REDIS_URL",
      "LANGFUSE_PUBLIC_KEY",
      "LANGFUSE_SECRET_KEY",
    ],
  },
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "portal-opl-adapter",
    requiredSecretRefs: ["secret-opl", "secret-trace"],
    forbiddenSecretRefs: ["portal-platform-secrets"],
    sensitiveEnvNames: [
      "OPL_LAUNCH_SECRET",
      "MED_AUTOSCIENCE_RUNNER_TOKEN",
      "OPL_ACP_RUNTIME_COMMAND_JSON",
      "LANGFUSE_PUBLIC_KEY",
      "LANGFUSE_SECRET_KEY",
    ],
  },
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "opl-web-upstream",
    requiredSecretRefs: [],
    forbiddenSecretRefs: ["portal-platform-secrets"],
    sensitiveEnvNames: [],
  },
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "opl-web-gateway",
    requiredSecretRefs: [],
    forbiddenSecretRefs: ["portal-platform-secrets"],
    sensitiveEnvNames: [],
  },
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "billing-aggregator",
    requiredSecretRefs: ["portal-postgres-redis-secret", "tencent-billing-secret", "tencent-cos-secret"],
    forbiddenSecretRefs: ["portal-platform-secrets", "portal-postgres-redis"],
    sensitiveEnvNames: [
      "PORTAL_POSTGRES_URL",
      "PORTAL_REDIS_URL",
      "TENCENT_CLOUD_SECRET_ID",
      "TENCENT_CLOUD_SECRET_KEY",
      "TENCENT_CLOUD_TOKEN",
      "TENCENT_COS_SECRET_ID",
      "TENCENT_COS_SECRET_KEY",
    ],
  },
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "resource-provisioner",
    requiredSecretRefs: ["tencent-provisioner-secret"],
    forbiddenSecretRefs: ["portal-platform-secrets"],
    sensitiveEnvNames: [
      "TENCENT_CLOUD_SECRET_ID",
      "TENCENT_CLOUD_SECRET_KEY",
      "TENCENT_CLOUD_TOKEN",
    ],
  },
  {
    file: "deploy/tke-package/manifests/05-platform-workloads.yaml",
    kind: "Deployment",
    name: "med-autoscience-runner",
    requiredSecretRefs: [],
    forbiddenSecretRefs: ["portal-platform-secrets"],
    sensitiveEnvNames: [],
  },
  {
    file: "deploy/tke-package/manifests/07-billing-reconcile-cronjob.yaml",
    kind: "CronJob",
    name: "billing-reconcile",
    requiredSecretRefs: ["portal-postgres-redis-secret", "tencent-billing-secret", "tencent-cos-secret"],
    forbiddenSecretRefs: ["portal-platform-secrets", "portal-postgres-redis"],
    sensitiveEnvNames: [
      "PORTAL_POSTGRES_URL",
      "PORTAL_REDIS_URL",
      "TENCENT_CLOUD_SECRET_ID",
      "TENCENT_CLOUD_SECRET_KEY",
      "TENCENT_CLOUD_TOKEN",
      "TENCENT_COS_SECRET_ID",
      "TENCENT_COS_SECRET_KEY",
    ],
  },
  {
    file: "deploy/tke-package/manifests/08-langfuse-stack.yaml",
    kind: "Deployment",
    name: "langfuse-web",
    requiredSecretRefs: ["secret-trace", "tencent-cos-secret"],
    forbiddenSecretRefs: ["langfuse-secrets"],
    allowEnvFromSecrets: {
      secretName: "secret-trace",
      envNames: [
        "NEXTAUTH_SECRET",
        "SALT",
        "ENCRYPTION_KEY",
        "POSTGRES_PASSWORD",
        "CLICKHOUSE_PASSWORD",
        "LANGFUSE_INIT_USER_PASSWORD",
        "LANGFUSE_INIT_PROJECT_PUBLIC_KEY",
        "LANGFUSE_INIT_PROJECT_SECRET_KEY",
      ],
    },
    sensitiveEnvNames: [
      "NEXTAUTH_SECRET",
      "SALT",
      "ENCRYPTION_KEY",
      "POSTGRES_PASSWORD",
      "CLICKHOUSE_PASSWORD",
      "LANGFUSE_INIT_USER_PASSWORD",
      "LANGFUSE_INIT_PROJECT_PUBLIC_KEY",
      "LANGFUSE_INIT_PROJECT_SECRET_KEY",
      "LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID",
      "LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY",
      "LANGFUSE_S3_MEDIA_UPLOAD_ACCESS_KEY_ID",
      "LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY",
    ],
  },
  {
    file: "deploy/tke-package/manifests/08-langfuse-stack.yaml",
    kind: "Deployment",
    name: "langfuse-worker",
    requiredSecretRefs: ["secret-trace", "tencent-cos-secret"],
    forbiddenSecretRefs: ["langfuse-secrets"],
    allowEnvFromSecrets: {
      secretName: "secret-trace",
      envNames: [
        "NEXTAUTH_SECRET",
        "SALT",
        "ENCRYPTION_KEY",
        "POSTGRES_PASSWORD",
        "CLICKHOUSE_PASSWORD",
        "LANGFUSE_INIT_USER_PASSWORD",
        "LANGFUSE_INIT_PROJECT_PUBLIC_KEY",
        "LANGFUSE_INIT_PROJECT_SECRET_KEY",
      ],
    },
    sensitiveEnvNames: [
      "NEXTAUTH_SECRET",
      "SALT",
      "ENCRYPTION_KEY",
      "POSTGRES_PASSWORD",
      "CLICKHOUSE_PASSWORD",
      "LANGFUSE_INIT_USER_PASSWORD",
      "LANGFUSE_INIT_PROJECT_PUBLIC_KEY",
      "LANGFUSE_INIT_PROJECT_SECRET_KEY",
      "LANGFUSE_S3_EVENT_UPLOAD_ACCESS_KEY_ID",
      "LANGFUSE_S3_EVENT_UPLOAD_SECRET_ACCESS_KEY",
      "LANGFUSE_S3_MEDIA_UPLOAD_ACCESS_KEY_ID",
      "LANGFUSE_S3_MEDIA_UPLOAD_SECRET_ACCESS_KEY",
    ],
  },
];

function splitDocuments(raw) {
  return raw
    .replace(/^\uFEFF/, "")
    .split(/\n---\s*\n/g)
    .map((item) => item.trimEnd())
    .filter(Boolean);
}

function manifestKind(document) {
  return document.match(/^kind:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || "";
}

function manifestName(document) {
  return document.match(/\nmetadata:\n(?:  .+\n)*?  name:\s*"?([^"\n]+)"?/)?.[1]?.trim() || "";
}

function findDocument(raw, kind, name) {
  return splitDocuments(raw).find((document) => manifestKind(document) === kind && manifestName(document) === name) || "";
}

function ensureNoSensitiveLiteralValues(document, label, sensitiveEnvNames, allowEnvFromSecrets = null) {
  for (const envName of sensitiveEnvNames) {
    const literalPattern = new RegExp(`- name:\\s*${envName}\\n\\s+value:\\s*`, "m");
    assert(!literalPattern.test(document), `${label} must not set sensitive env ${envName} with literal value`);
    const secretRefPattern = new RegExp(`- name:\\s*${envName}\\n\\s+valueFrom:\\n\\s+secretKeyRef:\\n`, "m");
    const envFromAllowed = Boolean(
      allowEnvFromSecrets &&
      allowEnvFromSecrets.envNames.includes(envName) &&
      new RegExp(`envFrom:\\n(?:\\s+.+\\n)*?\\s+- secretRef:\\n\\s+name:\\s*${allowEnvFromSecrets.secretName}(\\n|$)`, "m").test(document)
    );
    assert(
      secretRefPattern.test(document) || envFromAllowed,
      `${label} must source sensitive env ${envName} from secretKeyRef or approved secretRef`,
    );
  }
}

function ensureRequiredSecretRefs(document, label, requiredSecretRefs) {
  for (const secretName of requiredSecretRefs) {
    const pattern = new RegExp(`name:\\s*${secretName}(\\n|$)`);
    assert(pattern.test(document), `${label} missing secret reference ${secretName}`);
  }
}

function ensureForbiddenSecretRefs(document, label, forbiddenSecretRefs) {
  for (const secretName of forbiddenSecretRefs) {
    const pattern = new RegExp(`name:\\s*${secretName}(\\n|$)`);
    assert(!pattern.test(document), `${label} must not reference broad secret ${secretName}`);
  }
}

function ensureNoSensitiveLiteralEnvByName(document, label) {
  const envBlockPattern = /- name:\s*([A-Z0-9_]+)\n\s+value:\s*([^\n]+)/g;
  for (const match of document.matchAll(envBlockPattern)) {
    const envName = match[1];
    if (!SENSITIVE_NAME_PATTERN.test(envName)) continue;
    throw new assert.AssertionError({
      message: `${label} must not define sensitive env ${envName} as literal value`,
    });
  }
}

for (const check of CHECKS) {
  const raw = readFileSync(check.file, "utf8");
  const document = findDocument(raw, check.kind, check.name);
  assert(document, `${check.kind}/${check.name} not found in ${check.file}`);
  const label = `${check.file} ${check.kind}/${check.name}`;
  ensureRequiredSecretRefs(document, label, check.requiredSecretRefs);
  ensureForbiddenSecretRefs(document, label, check.forbiddenSecretRefs);
  ensureNoSensitiveLiteralValues(document, label, check.sensitiveEnvNames, check.allowEnvFromSecrets || null);
  ensureNoSensitiveLiteralEnvByName(document, label);
}

const recoveryScript = readFileSync("scripts/live-test-v19-postgres-redis-restart-recovery.mjs", "utf8");
assert.match(
  recoveryScript,
  /PORTAL_RECOVERY_DATABASE_SECRET_NAME", "portal-postgres-redis-secret"/,
  "portal recovery live script must default to scoped postgres/redis secret",
);
assert.doesNotMatch(
  recoveryScript,
  /"portal-postgres-redis"\)/,
  "portal recovery live script must not fall back to old unscoped secret",
);

for (const file of [
  "deploy/tke-package/env/tke.env.example",
  "deploy/tke-package/env/tke.env.tcr-gaofenglab.example",
]) {
  const source = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  assert.match(
    source,
    new RegExp(`^IMAGE_PULL_SECRET=${EXPECTED_IMAGE_PULL_SECRET}$`, "m"),
    `${file} must default IMAGE_PULL_SECRET to ${EXPECTED_IMAGE_PULL_SECRET}`,
  );
  assert.doesNotMatch(source, /^IMAGE_PULL_SECRET=tcr-pull-secret$/m, `${file} must not default to old tcr-pull-secret`);
}

for (const file of [
  "deploy/tke-package/rendered/01-platform-config.yaml",
  "deploy/tke-package/rendered/02-platform-secrets.example.yaml",
  "deploy/tke-package/rendered/05-platform-workloads.yaml",
  "deploy/tke-package/rendered/07-billing-reconcile-cronjob.yaml",
]) {
  const source = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  assert.doesNotMatch(source, /\btcr-pull-secret\b/, `${file} must not retain old rendered pull secret`);
  assert.doesNotMatch(source, /\bportal-platform-secrets\b/, `${file} must not retain old broad rendered runtime secret`);
  assert.doesNotMatch(source, /\bportal-postgres-redis\b(?!-secret)/, `${file} must not retain old rendered postgres/redis secret`);
}

console.log(JSON.stringify({
  ok: true,
  contract: "secret_hygiene_manifests",
  checked: CHECKS.map(({ file, kind, name }) => ({ file, kind, name })),
}, null, 2));
