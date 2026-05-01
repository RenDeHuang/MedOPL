import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const dockerignore = readFileSync(".dockerignore", "utf8");
const lines = dockerignore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

for (const required of ["node_modules", "**/node_modules", ".runtime", ".git"]) {
  assert(lines.includes(required), `.dockerignore must exclude ${required}`);
}

console.log("root dockerignore smoke passed");
