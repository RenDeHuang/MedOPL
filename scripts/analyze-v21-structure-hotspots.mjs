import { readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const ts = require("../services/portal/frontend/node_modules/typescript");
const { parse: parseVueSfc } = require("../services/portal/frontend/node_modules/@vue/compiler-sfc");

const SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".vue"]);
const EXCLUDED_DIRS = new Set([".git", ".runtime", ".sentrux", "node_modules", "dist", "build", "coverage"]);
const TOP_LIMIT_DEFAULT = 20;

const V21_BOUNDARY_PATTERNS = [
  {
    file: "services/opl-runtime-bridge/src/runtime-bridge-runs.mjs",
    kind: "managed_runtime_hot_path",
    patterns: [
      { token: "runner-client", reason: "default run facade imports runner client" },
      { token: "/portal/internal/resource-orders/prepare-run", reason: "default run facade prepares resource order" },
      { token: "createRunnerWorkspace", reason: "default run facade creates runner workspace" },
      { token: "submitRun(", reason: "default run facade submits managed runner run" },
    ],
  },
  {
    file: "services/portal/src/app/portal-runtime.mjs",
    kind: "ops_surface_coupling",
    patterns: [
      { token: "fetchHarborImageRows", reason: "portal runtime still owns Harbor image projection" },
      { token: "RESOURCE_PROVISIONER_URL", reason: "portal runtime still wires provisioner client" },
    ],
  },
  {
    file: "services/portal/src/domain/portal-api-payloads.mjs",
    kind: "ops_cost_surface_coupling",
    patterns: [
      { token: "billing-aggregator / OpenCost", reason: "user product payload still names OpenCost as default cost source" },
      { token: "Harbor API", reason: "user product payload still names Harbor as default registry source" },
    ],
  },
];

const DOMAIN_TERMS = [
  "portal",
  "runtime",
  "runner",
  "resource",
  "billing",
  "storage",
  "workspace",
  "session",
  "provisioner",
  "harbor",
  "minio",
  "opencost",
  "rancher",
  "k8s",
  "nodepool",
];

function parseArgs(argv) {
  const result = {
    root: process.cwd(),
    file: "",
    json: false,
    limit: TOP_LIMIT_DEFAULT,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      result.json = true;
    } else if (arg === "--root") {
      result.root = path.resolve(argv[++i] || result.root);
    } else if (arg === "--file") {
      result.file = String(argv[++i] || "").trim().split(path.sep).join("/");
    } else if (arg === "--limit") {
      result.limit = Number(argv[++i] || TOP_LIMIT_DEFAULT);
    } else if (!arg.startsWith("--")) {
      result.root = path.resolve(arg);
    }
  }
  if (!Number.isFinite(result.limit) || result.limit <= 0) result.limit = TOP_LIMIT_DEFAULT;
  return result;
}

async function walkFiles(root, current = root, files = []) {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      await walkFiles(root, path.join(current, entry.name), files);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    files.push(path.relative(root, path.join(current, entry.name)).split(path.sep).join("/"));
  }
  return files;
}

function buildLineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function lineForIndex(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(1, high + 1);
}

function scriptKindFor(file) {
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function vueScriptSegments(file, source) {
  const parsed = parseVueSfc(source, { filename: file });
  const blocks = [parsed.descriptor.script, parsed.descriptor.scriptSetup].filter(Boolean);
  return blocks.map((block, index) => ({
    code: block.loc.source,
    fileName: `${file}#script${index}`,
    lineOffset: Math.max(0, Number(block.loc.start.line || 1) - 1),
    kind: block.lang === "ts" ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  }));
}

function sourceSegments(file, source) {
  if (file.endsWith(".vue")) return vueScriptSegments(file, source);
  return [{
    code: source,
    fileName: file,
    lineOffset: 0,
    kind: scriptKindFor(file),
  }];
}

function nodeNameText(name) {
  if (!name) return "";
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText();
}

function functionName(node) {
  if (node.name) return nodeNameText(node.name);
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent)) return nodeNameText(parent.name);
  if (parent && ts.isPropertyAssignment(parent)) return nodeNameText(parent.name);
  if (parent && ts.isExportAssignment(parent)) return "default";
  return "<anonymous>";
}

function isCountedFunction(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node);
}

function countFunctionBodyMetrics(node) {
  const body = node.body || node;
  let branches = 0;
  let awaits = 0;
  function visit(child) {
    if (child !== node && isCountedFunction(child)) return;
    if (
      ts.isIfStatement(child)
      || ts.isForStatement(child)
      || ts.isForInStatement(child)
      || ts.isForOfStatement(child)
      || ts.isWhileStatement(child)
      || ts.isDoStatement(child)
      || ts.isSwitchStatement(child)
      || ts.isCaseClause(child)
      || ts.isCatchClause(child)
      || ts.isConditionalExpression(child)
      || (ts.isBinaryExpression(child) && (
        child.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || child.operatorToken.kind === ts.SyntaxKind.BarBarToken
      ))
    ) {
      branches += 1;
    }
    if (ts.isAwaitExpression(child)) awaits += 1;
    ts.forEachChild(child, visit);
  }
  visit(body);
  return { branches, awaits };
}

function extractFunctions(file, source) {
  const matches = [];
  for (const segment of sourceSegments(file, source)) {
    const sourceFile = ts.createSourceFile(segment.fileName, segment.code, ts.ScriptTarget.Latest, true, segment.kind);
    function visit(node) {
      if (isCountedFunction(node)) {
        const start = node.getStart(sourceFile);
        const end = node.end;
        const startLine = sourceFile.getLineAndCharacterOfPosition(start).line + 1 + segment.lineOffset;
        const endLine = sourceFile.getLineAndCharacterOfPosition(end).line + 1 + segment.lineOffset;
        const originalBody = segment.code.slice(start, end);
        const { branches, awaits } = countFunctionBodyMetrics(node);
        const domainHits = domainHitsFor(originalBody);
        matches.push({
          name: functionName(node),
          line: startLine,
          endLine,
          lines: endLine - startLine + 1,
          branches,
          awaits,
          domainBreadth: domainHits.length,
          domainHits,
          score: (endLine - startLine + 1) + branches * 6 + awaits * 2 + domainHits.length * 4,
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return matches;
}

function extractImports(file, source) {
  const imports = [];
  for (const segment of sourceSegments(file, source)) {
    const sourceFile = ts.createSourceFile(segment.fileName, segment.code, ts.ScriptTarget.Latest, true, segment.kind);
    function visit(node) {
      if (
        ts.isImportDeclaration(node)
        && ts.isStringLiteral(node.moduleSpecifier)
      ) {
        imports.push(node.moduleSpecifier.text);
      }
      if (
        ts.isExportDeclaration(node)
        && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)
      ) {
        imports.push(node.moduleSpecifier.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return imports;
}

function countExports(file, source) {
  let exports = 0;
  for (const segment of sourceSegments(file, source)) {
    const sourceFile = ts.createSourceFile(segment.fileName, segment.code, ts.ScriptTarget.Latest, true, segment.kind);
    function visit(node) {
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) || [] : [];
      if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) exports += 1;
      if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) exports += 1;
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return exports;
}

function domainHitsFor(content) {
  const lower = content.toLowerCase();
  return DOMAIN_TERMS.filter((term) => lower.includes(term));
}

function resolveLocalImport(file, spec, knownFiles) {
  if (!spec.startsWith(".")) return "";
  const fromDir = path.posix.dirname(file);
  const base = path.posix.normalize(path.posix.join(fromDir, spec));
  const candidates = [
    base,
    `${base}.mjs`,
    `${base}.js`,
    `${base}.ts`,
    `${base}.vue`,
    `${base}/index.mjs`,
    `${base}/index.js`,
    `${base}/index.ts`,
  ];
  return candidates.find((item) => knownFiles.has(item)) || "";
}

function fileScore(fileReport) {
  return fileReport.lines
    + fileReport.imports.length * 12
    + fileReport.exports * 8
    + fileReport.fanIn * 10
    + fileReport.fanOut * 10
    + fileReport.domainBreadth * 12;
}

function collectBoundaryRisks(file, source, lineStarts) {
  const risks = [];
  for (const group of V21_BOUNDARY_PATTERNS) {
    if (group.file !== file) continue;
    for (const item of group.patterns) {
      const index = source.indexOf(item.token);
      if (index < 0) continue;
      risks.push({
        kind: group.kind,
        file,
        line: lineForIndex(lineStarts, index),
        token: item.token,
        reason: item.reason,
      });
    }
  }
  return risks;
}

async function analyze(root) {
  const files = (await walkFiles(root)).sort();
  const knownFiles = new Set(files);
  const reports = [];
  const functionHotspots = [];
  const boundaryRisks = [];
  const edges = [];

  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    const lineStarts = buildLineStarts(source);
    const imports = extractImports(file, source);
    for (const spec of imports) {
      const target = resolveLocalImport(file, spec, knownFiles);
      if (target) edges.push({ from: file, to: target });
    }
    const functions = extractFunctions(file, source);
    const domainHits = domainHitsFor(source);
    const report = {
      file,
      lines: source.split("\n").length,
      imports,
      relativeImports: imports.filter((item) => item.startsWith(".")),
      exports: countExports(file, source),
      functions: functions.length,
      domainBreadth: domainHits.length,
      domainHits,
      fanIn: 0,
      fanOut: 0,
      score: 0,
    };
    reports.push(report);
    for (const fn of functions) {
      functionHotspots.push({ file, ...fn });
    }
    boundaryRisks.push(...collectBoundaryRisks(file, source, lineStarts));
  }

  const fanIn = new Map();
  const fanOut = new Map();
  for (const edge of edges) {
    fanOut.set(edge.from, (fanOut.get(edge.from) || 0) + 1);
    fanIn.set(edge.to, (fanIn.get(edge.to) || 0) + 1);
  }
  for (const report of reports) {
    report.fanIn = fanIn.get(report.file) || 0;
    report.fanOut = fanOut.get(report.file) || 0;
    report.score = fileScore(report);
  }

  return {
    ok: true,
    root,
    summary: {
      files: reports.length,
      importEdges: edges.length,
      functionCount: functionHotspots.length,
      boundaryRiskCount: boundaryRisks.length,
    },
    fileHotspots: reports.sort((a, b) => b.score - a.score),
    functionHotspots: functionHotspots.sort((a, b) => b.score - a.score),
    v21BoundaryRisks: boundaryRisks,
  };
}

function limited(payload, limit, file = "") {
  if (file) {
    return {
      ...payload,
      fileHotspots: payload.fileHotspots.filter((item) => item.file === file),
      functionHotspots: payload.functionHotspots.filter((item) => item.file === file),
    };
  }
  return {
    ...payload,
    fileHotspots: payload.fileHotspots.slice(0, limit),
    functionHotspots: payload.functionHotspots.slice(0, limit),
  };
}

function printText(payload) {
  console.log(`v21 structure hotspots: files=${payload.summary.files}, functions=${payload.summary.functionCount}, boundaryRisks=${payload.summary.boundaryRiskCount}`);
  console.log("\nFile hotspots:");
  for (const item of payload.fileHotspots) {
    console.log(`- ${item.file}:${item.lines} score=${item.score} fanIn=${item.fanIn} fanOut=${item.fanOut} domains=${item.domainHits.join(",")}`);
  }
  console.log("\nFunction hotspots:");
  for (const item of payload.functionHotspots) {
    console.log(`- ${item.file}:${item.line} ${item.name} lines=${item.lines} branches=${item.branches} awaits=${item.awaits} score=${item.score}`);
  }
  if (payload.v21BoundaryRisks.length) {
    console.log("\nV21 boundary risks:");
    for (const item of payload.v21BoundaryRisks) {
      console.log(`- ${item.file}:${item.line} ${item.kind} ${item.token}: ${item.reason}`);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const payload = limited(await analyze(args.root), args.limit, args.file);
if (args.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  printText(payload);
}
