import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function findDefaultUpstream(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, ".runtime", "one-person-lab-upstream");
    if (existsSync(candidate)) return candidate;
    const next = path.dirname(current);
    if (next === current) return null;
    current = next;
  }
}

const repoRoot = process.cwd();
const upstreamPath = process.env.ONE_PERSON_LAB_UPSTREAM_PATH
  ? path.resolve(repoRoot, process.env.ONE_PERSON_LAB_UPSTREAM_PATH)
  : findDefaultUpstream(repoRoot);

if (!upstreamPath || !existsSync(upstreamPath)) {
  fail("one-person-lab upstream path not found");
}

const status = spawnSync("git", ["status", "--short"], {
  cwd: upstreamPath,
  encoding: "utf8",
});

if (status.status !== 0) {
  fail(`git status failed in one-person-lab upstream: ${status.stderr || status.stdout}`);
}

const output = String(status.stdout || "").trim();
if (output) {
  fail(`one-person-lab upstream is not clean:\n${output}`);
}

console.log("one-person-lab upstream clean");
