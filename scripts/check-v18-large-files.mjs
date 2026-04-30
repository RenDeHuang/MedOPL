import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const limits = [
  {
    file: "services/portal/src/app/portal-app.mjs",
    maxLines: Number(process.env.V18_PORTAL_APP_MAX_LINES || 800),
  },
  {
    globRoot: "services/portal/src/routes",
    maxLines: Number(process.env.V18_ROUTE_MAX_LINES || 500),
  },
  {
    globRoot: "services/portal/src/services",
    maxLines: Number(process.env.V18_SERVICE_MAX_LINES || 500),
  },
  {
    globRoot: "services/portal/src/domain",
    maxLines: Number(process.env.V18_DOMAIN_MAX_LINES || 500),
  },
];

function lineCount(file) {
  return readFileSync(file, "utf8").split(/\r?\n/).length;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const item of readdirSync(dir)) {
    const absolute = path.join(dir, item);
    const stat = statSync(absolute);
    if (stat.isDirectory()) files.push(...walk(absolute));
    else if (item.endsWith(".mjs") || item.endsWith(".js")) files.push(absolute);
  }
  return files;
}

const failures = [];
for (const limit of limits) {
  if (limit.file) {
    const absolute = path.resolve(process.cwd(), limit.file);
    if (!existsSync(absolute)) continue;
    const lines = lineCount(absolute);
    if (lines > limit.maxLines) failures.push(`${limit.file}: ${lines} lines > ${limit.maxLines}`);
    continue;
  }

  const root = path.resolve(process.cwd(), limit.globRoot);
  for (const absolute of walk(root)) {
    const relative = path.relative(process.cwd(), absolute).replaceAll("\\", "/");
    const lines = lineCount(absolute);
    if (lines > limit.maxLines) failures.push(`${relative}: ${lines} lines > ${limit.maxLines}`);
  }
}

if (failures.length) {
  console.error(`v18 large-file gate failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("v18 large-file gate passed");
