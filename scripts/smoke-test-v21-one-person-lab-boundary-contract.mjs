import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(os.tmpdir(), `v21-one-person-lab-boundary-${process.pid}`);

await rm(fixtureRoot, { recursive: true, force: true });
await mkdir(fixtureRoot, { recursive: true });

const absent = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "check-one-person-lab-upstream-clean.mjs"),
], {
  cwd: fixtureRoot,
  encoding: "utf8",
});
assert.equal(absent.status, 0, absent.stderr || absent.stdout);
const absentPayload = JSON.parse(absent.stdout);
assert.equal(absentPayload.present, false, "missing upstream directory must be explicit and pass");
assert.equal(absentPayload.clean, true, "missing upstream directory cannot be dirty");

const upstreamRoot = path.join(fixtureRoot, ".runtime", "one-person-lab-upstream");
await mkdir(upstreamRoot, { recursive: true });
spawnSync("git", ["init"], { cwd: upstreamRoot, encoding: "utf8" });
spawnSync("git", ["config", "user.email", "codex@example.test"], { cwd: upstreamRoot, encoding: "utf8" });
spawnSync("git", ["config", "user.name", "Codex"], { cwd: upstreamRoot, encoding: "utf8" });
await writeFile(path.join(upstreamRoot, "README.md"), "# upstream\n");
spawnSync("git", ["add", "README.md"], { cwd: upstreamRoot, encoding: "utf8" });
spawnSync("git", ["commit", "-m", "init"], { cwd: upstreamRoot, encoding: "utf8" });

const clean = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "check-one-person-lab-upstream-clean.mjs"),
], {
  cwd: fixtureRoot,
  encoding: "utf8",
});
assert.equal(clean.status, 0, clean.stderr || clean.stdout);
const cleanPayload = JSON.parse(clean.stdout);
assert.equal(cleanPayload.present, true, "present upstream directory must be reported");
assert.equal(cleanPayload.clean, true, "clean upstream directory must pass");

const dockerfilePath = path.join(fixtureRoot, "deploy", "tke-package", "build", "dockerfiles", "opl-runtime-bridge.Dockerfile");
await mkdir(path.dirname(dockerfilePath), { recursive: true });
await writeFile(dockerfilePath, "COPY source/.runtime/one-person-lab-upstream /app/.runtime/one-person-lab-upstream\n");
const badPackageBoundary = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "check-one-person-lab-upstream-clean.mjs"),
], {
  cwd: fixtureRoot,
  encoding: "utf8",
});
assert.equal(badPackageBoundary.status, 1, "packaged upstream must stay outside /app/.runtime and fail otherwise");
assert.match(badPackageBoundary.stderr, /one-person-lab upstream package boundary/i);

await writeFile(dockerfilePath, "COPY source/.runtime/one-person-lab-upstream /app/one-person-lab-upstream\n");
const envPath = path.join(fixtureRoot, "deploy", "tke-package", "env", "tke.env.example");
await mkdir(path.dirname(envPath), { recursive: true });
await writeFile(envPath, [
  "OPL_ACP_RUNTIME_DIR=/app/one-person-lab-upstream",
  "OPL_WEB_UPSTREAM_URL=http://opl-web-upstream:3000",
  "",
].join("\n"));
const goodPackageBoundary = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "check-one-person-lab-upstream-clean.mjs"),
], {
  cwd: fixtureRoot,
  encoding: "utf8",
});
assert.equal(goodPackageBoundary.status, 0, goodPackageBoundary.stderr || goodPackageBoundary.stdout);
const goodPackagePayload = JSON.parse(goodPackageBoundary.stdout);
assert.equal(goodPackagePayload.packageBoundary.clean, true, "valid package boundary must be reported clean");

await writeFile(path.join(upstreamRoot, "README.md"), "# upstream\nmodified\n");
const dirty = spawnSync(process.execPath, [
  path.join(repoRoot, "scripts", "check-one-person-lab-upstream-clean.mjs"),
], {
  cwd: fixtureRoot,
  encoding: "utf8",
});
assert.equal(dirty.status, 1, "dirty upstream directory must fail");
assert.match(dirty.stderr, /one-person-lab upstream must remain unmodified/);

await rm(fixtureRoot, { recursive: true, force: true });
