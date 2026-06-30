import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const activeCodeRoots = [
  "services/portal/frontend/src",
  "services/medopl-go-backend",
  "services/opl-web-gateway/src",
  "services/opl-runtime-bridge/src",
];

const activeTruthFiles = [
  "AGENTS.md",
  "docs/active/README.md",
  "docs/source/README.md",
  "docs/runtime/README.md",
  "docs/specs/README.md",
  "docs/evidence/README.md",
  "docs/delivery/README.md",
  "specs/source/spec.md",
  "specs/runtime/spec.md",
  "specs/evidence/spec.md",
  "tests/README.md",
  "tests/fixtures/v22/agent-verify-manifest.json",
  "tests/fixtures/v22/goal-current.json",
  "scripts/v22-test-classification.mjs",
  "scripts/v22-workflow-gate.mjs",
];

const forbiddenActivePatterns = [
  /\bresource_order_prepare\b/gu,
  /\bRESOURCE_ORDER_PREPARE_FAILED\b/gu,
  /\bopencost-pending\b/gu,
  /\buser_owned(?:_runtime|_runtime_dispatch)?\b/gu,
  /\buser-owned(?:-runtime)?\b/giu,
  /\/portal\/api/gu,
  /services\/portal\/src/gu,
  /src\/server\.mjs/gu,
  /portal-workflow-facade/gu,
];

const forbiddenCurrentTruthPatterns = [
  /current Node Portal backend/gu,
  /Node Portal backend remains active/gu,
  /Go has not replaced the current Node Portal backend/gu,
  /contract-test-v22-node-portal-workflow-facade-boundary\.mjs/gu,
  /tests\/local-rc\/local-rc-test-v22-provider-bound-message-backflow\.mjs/gu,
  /explicit local RC eval under `tests\/local-rc\/\*\*`/gu,
];

async function exists(repoPath) {
  try {
    await stat(path.join(repoRoot, repoPath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function listFiles(rootPath) {
  if (!(await exists(rootPath))) return [];
  const entries = await readdir(path.join(repoRoot, rootPath), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const repoPath = `${rootPath}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", ".runtime", "dist", "coverage"].includes(entry.name)) continue;
      files.push(...await listFiles(repoPath));
    } else if (entry.isFile()) {
      files.push(repoPath);
    }
  }
  return files.sort();
}

async function readRepoFile(repoPath) {
  return readFile(path.join(repoRoot, repoPath), "utf8");
}

function isTextFile(filePath) {
  return /\.(?:mjs|js|ts|tsx|go|json|md|yaml|yml|html|css)$/iu.test(filePath);
}

function lineOf(source, index) {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

assert.equal(await exists("services/portal/src"), false, "node_portal_backend_src_must_be_physically_removed");

const files = (await Promise.all(activeCodeRoots.map(listFiles))).flat().filter(isTextFile);
const findings = [];
for (const file of files) {
  const source = await readRepoFile(file);
  for (const pattern of forbiddenActivePatterns) {
    for (const match of source.matchAll(pattern)) {
      findings.push({ file, line: lineOf(source, match.index ?? 0), match: match[0] });
    }
  }
}

assert.deepEqual(findings, [], `zero_compat_active_surface_findings:${JSON.stringify(findings, null, 2)}`);

const truthFindings = [];
for (const file of activeTruthFiles) {
  const source = await readRepoFile(file);
  for (const pattern of forbiddenCurrentTruthPatterns) {
    for (const match of source.matchAll(pattern)) {
      truthFindings.push({ file, line: lineOf(source, match.index ?? 0), match: match[0] });
    }
  }
}
assert.deepEqual(truthFindings, [], `zero_compat_current_truth_findings:${JSON.stringify(truthFindings, null, 2)}`);

const [viteConfig, frontendClient, router, manifest] = await Promise.all([
  readRepoFile("services/portal/frontend/vite.config.ts"),
  readRepoFile("services/portal/frontend/src/api/client.ts"),
  readRepoFile("services/medopl-go-backend/internal/server/router.go"),
  readRepoFile("tests/fixtures/v22/agent-verify-manifest.json").then(JSON.parse),
]);

assert.equal(await exists("services/portal/package.json"), false, "portal_root_wrapper_package_must_be_removed");
assert.equal(await exists("services/portal/package-lock.json"), false, "portal_root_wrapper_lockfile_must_be_removed");
assert.equal(viteConfig.includes('"/api": goControlPlaneTarget'), true, "frontend_must_proxy_only_go_api");
assert.equal(frontendClient.includes("goControlPlaneClient"), true, "frontend_client_must_export_go_client");
assert.equal(router.includes('router.GET("/api/me"'), true, "go_router_must_own_portal_projection");
assert.deepEqual(
  manifest.suites.find((suite) => suite.id === "local-rc-authorized"),
  undefined,
  "empty_local_rc_authorized_suite_must_not_remain_active",
);
assert.equal(
  manifest.suites.some((suite) => JSON.stringify(suite).includes("local-provider-secret-authorized")),
  false,
  "local_provider_secret_authorized_eval_must_not_remain_active",
);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_zero_compat_active_surface",
  activeCodeRoots,
  activeTruthFiles,
  scannedFiles: files.length,
}, null, 2));
