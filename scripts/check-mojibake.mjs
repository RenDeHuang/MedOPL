import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const includeRoots = [
  "adapters",
  "configs",
  "docs",
  "scripts",
  path.join("services", "portal", "frontend", "src"),
  path.join("services", "portal", "src"),
];
const ignoredSegments = new Set([
  ".git",
  ".omx",
  ".runtime",
  "dist",
  "node_modules",
  "logs",
]);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".ts",
  ".vue",
  ".yaml",
  ".yml",
]);

// Common mojibake code points seen when UTF-8 Chinese was decoded as GBK/ANSI.
const mojibakeChars = [
  0x934a, 0x93c8, 0x93c3, 0x6d60, 0x9422, 0x9428, 0x95ab, 0x93c9,
  0x935a, 0x7eef, 0x59dd, 0x59ab, 0x7490, 0x935b, 0x95c2, 0x5a34,
  0x7459, 0x7ba0, 0x93b4, 0x9418, 0x5bee, 0x7035, 0x8dfa, 0xfffd,
].map((code) => String.fromCharCode(code));

function hasMojibake(line) {
  return mojibakeChars.some((char) => line.includes(char));
}

function shouldIgnore(filePath) {
  const parts = path.relative(root, filePath).split(path.sep);
  return parts.some((part) => ignoredSegments.has(part));
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(fullPath)) continue;
    if (entry.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }
    if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      yield fullPath;
    }
  }
}

const findings = [];
for (const relativeRoot of includeRoots) {
  const absoluteRoot = path.join(root, relativeRoot);
  for await (const filePath of walk(absoluteRoot)) {
    const content = await readFile(filePath, "utf8").catch(() => "");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hasMojibake(line)) {
        findings.push({
          file: path.relative(root, filePath).replaceAll("\\", "/"),
          line: index + 1,
          text: line.trim().slice(0, 180),
        });
      }
    });
  }
}

if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checkedRoots: includeRoots }, null, 2));
