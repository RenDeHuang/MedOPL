import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function findUpstreamPath() {
  if (process.env.ONE_PERSON_LAB_UPSTREAM_PATH) {
    return path.resolve(process.env.ONE_PERSON_LAB_UPSTREAM_PATH);
  }

  let current = repoRoot;
  for (;;) {
    const candidate = path.join(current, ".runtime", "one-person-lab-upstream");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(repoRoot, ".runtime", "one-person-lab-upstream");
}

const upstreamPath = findUpstreamPath();

let status = "";
try {
  status = execFileSync("git", ["-C", upstreamPath, "status", "--short"], { encoding: "utf8" });
} catch (error) {
  throw new Error(`failed to inspect one-person-lab upstream at ${upstreamPath}: ${error.message}`);
}

if (status.trim()) {
  throw new Error(`one-person-lab upstream must remain unmodified:\n${status}`);
}

console.log(JSON.stringify({ ok: true, upstreamPath, clean: true }, null, 2));
