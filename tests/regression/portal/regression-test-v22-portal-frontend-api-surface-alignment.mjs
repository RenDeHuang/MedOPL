import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../../../services/portal/frontend/node_modules/typescript");

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "services", "portal", "frontend", "src", "api", "portal");
const appRoot = path.join(repoRoot, "services", "portal", "frontend", "src", "app");
const routesPath = path.join(appRoot, "routes.tsx");
const goRouterPath = path.join(repoRoot, "services", "medopl-go-backend", "internal", "server", "router.go");
const goControlPlanePath = path.join(repoRoot, "services", "medopl-go-backend", "internal", "server", "handlers", "controlplane.go");

const retiredShellPaths = [
  "/__portal-harness/components",
  "/packages",
  "/advanced/servers",
  "/admin/trace",
  "/admin/user",
  "/admin/groups",
  "/admin/workspace",
  "/admin/run",
  "/admin/usage",
  "/admin/sandboxes",
];

const requiredUsedExports = [
  "workspace.ts:fetchWorkspaceStorage",
  "workspace.ts:fetchStorageEntitlement",
  "workspace.ts:createWorkspaceFileUploadUrl",
  "workspace.ts:createWorkspaceFileDownloadUrl",
  "opl.ts:createOplFileRef",
  "opl.ts:startOplRun",
  "opl.ts:fetchOplArtifact",
];

const allowedAdjudicationStatuses = new Set([
  "active-used",
  "backend-only",
  "future-reserved",
]);

const unusedAdjudications = {
  "admin.ts:fetchAdminAgentTraces": {
    status: "future-reserved",
    reason: "Admin trace endpoint exists, but current React admin route set uses alerts/audit/system/ops instead of a dedicated agent trace page.",
  },
  "admin.ts:fetchAdminGroups": {
    status: "future-reserved",
    reason: "Backend and shell remnants expose groups, but current React admin navigation does not include a groups page.",
  },
  "admin.ts:fetchAdminUsage": {
    status: "future-reserved",
    reason: "Usage analytics endpoint is retained for a future admin drilldown, not the current admin dashboard route set.",
  },
  "admin.ts:fetchAdminSandboxes": {
    status: "future-reserved",
    reason: "Sandbox inventory is not part of the current React admin surface.",
  },
  "admin.ts:fetchAdminUserPortrait": {
    status: "future-reserved",
    reason: "User portrait drilldown is still represented by backend/shell links, while current React admin uses the users table and detail dialog.",
  },
  "admin.ts:fetchAdminWorkspacePortrait": {
    status: "future-reserved",
    reason: "Workspace portrait drilldown is not mounted in current React routes.",
  },
  "admin.ts:fetchAdminRunPortrait": {
    status: "future-reserved",
    reason: "Run portrait drilldown is not mounted in current React routes.",
  },
  "billing.ts:fetchCostsSummary": {
    status: "future-reserved",
    reason: "Cost summary projection is available for future cost drilldowns; current billing page uses billing summary/details.",
  },
  "billing.ts:fetchWorkspaceCosts": {
    status: "future-reserved",
    reason: "Workspace cost projection is not shown by the current workspace or billing pages.",
  },
  "billing.ts:fetchRunCosts": {
    status: "future-reserved",
    reason: "Run cost projection is not shown by the current trace page.",
  },
  "opl.ts:sendOplMessage": {
    status: "future-reserved",
    reason: "Real provider message canary exists, but Portal's current product surface is OPL launch/session binding rather than embedded chat.",
  },
  "opl.ts:fetchOplMessageStatus": {
    status: "future-reserved",
    reason: "Message status belongs to the future OPL bridge backflow surface, not the current launch-only Portal UI.",
  },
  "public.ts:fetchPublicSettings": {
    status: "backend-only",
    reason: "Public settings are consumed by the server-rendered public home and admin system payload, not directly by the React app.",
  },
  "production-bootstrap.ts:planProductionBootstrap": {
    status: "future-reserved",
    reason: "Production bootstrap is a Gap 01 contract-only API trace; it stays unmounted until admin/tenant/workspace bootstrap receives separate execution authorization.",
  },
  "production-bootstrap.ts:commitProductionBootstrap": {
    status: "future-reserved",
    reason: "Production bootstrap commit must fail closed before authorization and is tracked only as typed API shape for Gap 01.",
  },
  "production-operation.ts:planProductionPackageCOperation": {
    status: "future-reserved",
    reason: "Production Package C operation planning is Gap 02 contract-only API trace; it stays unmounted until Package C live operation receives separate authorization.",
  },
  "production-operation.ts:commitProductionPackageCOperation": {
    status: "future-reserved",
    reason: "Production Package C operation commit must fail closed before authorization and is tracked only as typed API shape for Gap 02.",
  },
  "production-ledger.ts:planProductionLedger": {
    status: "future-reserved",
    reason: "Production ResourceBinding ledger planning is Gap 03 contract-only API trace; it stays unmounted until PostgreSQL write/read receives separate authorization.",
  },
  "production-ledger.ts:commitProductionLedger": {
    status: "future-reserved",
    reason: "Production ResourceBinding ledger commit must fail closed before authorization and is tracked only as typed API shape for Gap 03.",
  },
  "production-commercial-ledger.ts:planProductionCommercialLedger": {
    status: "future-reserved",
    reason: "Production billing / audit / quota ledger planning is Gap 04 contract-only API trace; it stays unmounted until commercial ledger execution receives separate authorization.",
  },
  "production-commercial-ledger.ts:commitProductionCommercialLedger": {
    status: "future-reserved",
    reason: "Production billing / audit / quota ledger commit must fail closed before authorization and is tracked only as typed API shape for Gap 04.",
  },
  "production-workspace-lifecycle.ts:planProductionWorkspaceLifecycle": {
    status: "future-reserved",
    reason: "Production workspace suspend / resume / delete lifecycle planning is Gap 05 contract-only API trace; it stays unmounted until lifecycle execution receives separate authorization.",
  },
  "production-workspace-lifecycle.ts:commitProductionWorkspaceLifecycle": {
    status: "future-reserved",
    reason: "Production workspace suspend / resume / delete lifecycle commit must fail closed before authorization and is tracked only as typed API shape for Gap 05.",
  },
  "production-canary.ts:planProductionCanary": {
    status: "future-reserved",
    reason: "Production smoke / canary / rollback / cleanup evidence planning is Gap 06 contract-only API trace; it stays unmounted until canary execution receives separate authorization.",
  },
  "production-canary.ts:commitProductionCanary": {
    status: "future-reserved",
    reason: "Production smoke / canary / rollback / cleanup evidence commit must fail closed before authorization and is tracked only as typed API shape for Gap 06.",
  },
  "server-plans.ts:fetchServerPlans": {
    status: "future-reserved",
    reason: "Server plan catalog remains a lower-level backend surface; current React runtime UI is package-oriented.",
  },
  "sessions.ts:fetchSessions": {
    status: "future-reserved",
    reason: "Session list is not exposed as an active React page; current user trace page consumes session traces.",
  },
  "sessions.ts:fetchRuns": {
    status: "future-reserved",
    reason: "Run list is not exposed as an active React page; current task/result surface consumes session traces through an adapter.",
  },
  "traces.ts:fetchTraces": {
    status: "backend-only",
    reason: "Generic traces endpoint is admin scoped; ordinary React trace UI uses fetchSessionTraces.",
  },
};

function repoRelative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function apiRelative(filePath) {
  return path.relative(apiRoot, filePath).replaceAll(path.sep, "/");
}

function readSource(filePath) {
  return readFileSync(filePath, "utf8");
}

function listFiles(dir, suffixes) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath, suffixes));
      continue;
    }
    if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function sourceKind(filePath) {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function sourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    readSource(filePath),
    ts.ScriptTarget.Latest,
    true,
    sourceKind(filePath),
  );
}

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === kind));
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function exportKey(file, name) {
  return `${file}:${name}`;
}

function collectPortalApiExports() {
  const exports = [];
  const exportsByFile = new Map();
  for (const filePath of listFiles(apiRoot, [".ts"])) {
    const parsed = sourceFile(filePath);
    const file = apiRelative(filePath);
    const names = new Set();
    function visit(node) {
      if (
        ts.isFunctionDeclaration(node) &&
        node.name &&
        hasModifier(node, ts.SyntaxKind.ExportKeyword) &&
        hasModifier(node, ts.SyntaxKind.AsyncKeyword)
      ) {
        const name = node.name.text;
        names.add(name);
        exports.push({
          key: exportKey(file, name),
          file,
          absoluteFile: filePath,
          name,
          line: lineOf(parsed, node.name),
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    exportsByFile.set(filePath, { file, names });
  }
  return { exports, exportsByFile };
}

function resolveRelativeImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function collectPortalApiUsage(exportsByFile) {
  const used = new Map();
  const appFiles = listFiles(appRoot, [".ts", ".tsx"]);

  function markUsed({ key, file, name }, appFile, source, node) {
    if (!used.has(key)) {
      used.set(key, {
        key,
        file,
        name,
        references: [],
      });
    }
    used.get(key).references.push(`${repoRelative(appFile)}:${lineOf(source, node)}`);
  }

  for (const appFile of appFiles) {
    const parsed = sourceFile(appFile);
    const namedImports = new Map();
    const namespaceImports = new Map();

    for (const statement of parsed.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const resolved = resolveRelativeImport(appFile, statement.moduleSpecifier.text);
      if (!resolved || !exportsByFile.has(resolved)) continue;
      const importClause = statement.importClause;
      if (!importClause || importClause.isTypeOnly) continue;

      const exportInfo = exportsByFile.get(resolved);
      const namedBindings = importClause.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const imported of namedBindings.elements) {
          if (imported.isTypeOnly) continue;
          const exportedName = imported.propertyName?.text || imported.name.text;
          if (!exportInfo.names.has(exportedName)) continue;
          namedImports.set(imported.name.text, {
            key: exportKey(exportInfo.file, exportedName),
            file: exportInfo.file,
            name: exportedName,
          });
        }
      }
      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        namespaceImports.set(namedBindings.name.text, exportInfo);
      }
    }

    function visit(node) {
      if (ts.isImportDeclaration(node)) return;
      if (ts.isIdentifier(node) && namedImports.has(node.text)) {
        markUsed(namedImports.get(node.text), appFile, parsed, node);
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        namespaceImports.has(node.expression.text)
      ) {
        const exportInfo = namespaceImports.get(node.expression.text);
        if (exportInfo.names.has(node.name.text)) {
          markUsed({
            key: exportKey(exportInfo.file, node.name.text),
            file: exportInfo.file,
            name: node.name.text,
          }, appFile, parsed, node.name);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
  }

  return used;
}

function groupRows(rows) {
  return rows.reduce((groups, row) => {
    groups[row.file] ||= [];
    groups[row.file].push(row.name);
    return groups;
  }, {});
}

function statusSummary(rows) {
  return rows.reduce((summary, row) => {
    summary[row.status] = (summary[row.status] || 0) + 1;
    return summary;
  }, {});
}

function normalizeFrontendApiRoute(route) {
  return String(route || "")
    .replace(/\$\{encodeURIComponent\([^)]*\)\}/gu, ":param")
    .replace(/\/:param\/status$/u, "/:param/status")
    .replace(/\/:param$/u, "/:param");
}

function collectFrontendApiRoutes() {
  const routes = [];
  for (const filePath of listFiles(apiRoot, [".ts"])) {
    const source = readSource(filePath);
    const file = apiRelative(filePath);
    for (const match of source.matchAll(/goControlPlaneClient\.(get|post|put|patch|delete)<[^>]*>\(\s*`([^`]+)`|goControlPlaneClient\.(get|post|put|patch|delete)\(\s*`([^`]+)`|goControlPlaneClient\.(get|post|put|patch|delete)<[^>]*>\(\s*"([^"]+)"|goControlPlaneClient\.(get|post|put|patch|delete)\(\s*"([^"]+)"/gu)) {
      const method = (match[1] || match[3] || match[5] || match[7] || "").toUpperCase();
      const route = match[2] || match[4] || match[6] || match[8] || "";
      routes.push({
        file,
        method,
        route: normalizeFrontendApiRoute(route),
      });
    }
    for (const match of source.matchAll(/postLabMutation\("([^"]+)"/gu)) {
      routes.push({
        file,
        method: "POST",
        route: normalizeFrontendApiRoute(match[1]),
      });
    }
  }
  return routes.sort((a, b) => `${a.file}:${a.method}:${a.route}`.localeCompare(`${b.file}:${b.method}:${b.route}`));
}

function normalizeGoRoute(route) {
  return String(route || "").replace(/:([A-Za-z0-9_]+)/gu, ":param");
}

function collectGoBackendRoutes() {
  const routerSource = readSource(goRouterPath);
  const controlPlaneSource = readSource(goControlPlanePath);
  const routes = [];
  for (const match of routerSource.matchAll(/router\.(GET|POST|PUT|PATCH|DELETE)\("([^"]+)"/gu)) {
    routes.push({ method: match[1], route: normalizeGoRoute(match[2]) });
  }
  for (const match of routerSource.matchAll(/api\.(GET|POST|PUT|PATCH|DELETE)\("([^"]+)"/gu)) {
    routes.push({ method: match[1], route: normalizeGoRoute(`/api${match[2]}`) });
  }
  for (const match of controlPlaneSource.matchAll(/api\.(GET|POST|PUT|PATCH|DELETE)\("([^"]+)"/gu)) {
    routes.push({ method: match[1], route: normalizeGoRoute(`/api${match[2]}`) });
  }
  return routes.sort((a, b) => `${a.method}:${a.route}`.localeCompare(`${b.method}:${b.route}`));
}

function collectRouteAlignmentReport() {
  const routeSource = readSource(routesPath);
  const routePaths = [...routeSource.matchAll(/path:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .map((route) => (route === "/" ? route : `/${route}`))
    .sort();

  const frontendApiRoutes = collectFrontendApiRoutes();
  const goRoutes = collectGoBackendRoutes();
  const goRouteKeys = new Set(goRoutes.map((item) => `${item.method} ${item.route}`));
  const missingGoRoutes = frontendApiRoutes.filter((item) => !goRouteKeys.has(`${item.method} /api${item.route}`));

  return {
    status: "go-backend-enforced",
    reactRoutes: routePaths,
    frontendApiRoutes,
    goRoutes,
    missingGoRoutes,
  };
}

const { exports, exportsByFile } = collectPortalApiExports();
const usedMap = collectPortalApiUsage(exportsByFile);
const usedRows = exports.filter((item) => usedMap.has(item.key));
const unusedRows = exports.filter((item) => !usedMap.has(item.key));
const exportKeys = new Set(exports.map((item) => item.key));
const unusedKeys = new Set(unusedRows.map((item) => item.key));
const usedKeys = new Set(usedRows.map((item) => item.key));
const missingRequiredUsedExports = requiredUsedExports.filter((key) => !usedKeys.has(key));

const invalidAdjudications = [];
const staleAdjudications = [];
const usedAdjudications = [];
for (const [key, value] of Object.entries(unusedAdjudications)) {
  if (!exportKeys.has(key)) staleAdjudications.push(key);
  if (usedKeys.has(key)) usedAdjudications.push(key);
  if (!allowedAdjudicationStatuses.has(value.status) || typeof value.reason !== "string" || !value.reason.trim()) {
    invalidAdjudications.push(key);
  }
}

assert.deepEqual(staleAdjudications, [], `frontend_api_adjudication_must_target_existing_export:${JSON.stringify(staleAdjudications)}`);
assert.deepEqual(usedAdjudications, [], `frontend_api_adjudication_must_not_target_used_export:${JSON.stringify(usedAdjudications)}`);
assert.deepEqual(invalidAdjudications, [], `frontend_api_adjudication_invalid:${JSON.stringify(invalidAdjudications)}`);
assert.deepEqual(missingRequiredUsedExports, [], `frontend_api_required_workspace_exports_must_be_used:${JSON.stringify(missingRequiredUsedExports)}`);

const uncategorizedUnused = unusedRows.filter((item) => !unusedAdjudications[item.key]);
const missingExports = Object.keys(unusedAdjudications).filter((key) => !unusedKeys.has(key));
const activeUsedButUnused = unusedRows
  .filter((item) => unusedAdjudications[item.key]?.status === "active-used")
  .map((item) => item.key);
assert.deepEqual(missingExports, [], `frontend_api_unused_adjudication_not_unused:${JSON.stringify(missingExports)}`);
assert.deepEqual(uncategorizedUnused, [], `frontend_api_uncategorized_unused:${JSON.stringify(uncategorizedUnused, null, 2)}`);
assert.deepEqual(activeUsedButUnused, [], `frontend_api_active_used_exports_must_be_consumed:${JSON.stringify(activeUsedButUnused)}`);

const adjudicatedUnusedRows = unusedRows.map((row) => ({
  ...row,
  status: unusedAdjudications[row.key].status,
  reason: unusedAdjudications[row.key].reason,
}));

const retiredFrontendApiExports = [
  "admin.ts:updateAdminRegistrationSettings",
  "billing.ts:fetchBilling",
  "traces.ts:fetchTraceSummary",
];
const leakedRetiredExports = retiredFrontendApiExports.filter((key) => exportKeys.has(key));
assert.deepEqual(leakedRetiredExports, [], `frontend_api_retired_exports_must_be_removed:${JSON.stringify(leakedRetiredExports)}`);

const routeAlignment = collectRouteAlignmentReport();
assert.deepEqual(routeAlignment.missingGoRoutes, [], `frontend_api_routes_must_exist_in_go_backend:${JSON.stringify(routeAlignment.missingGoRoutes, null, 2)}`);
const leakedRetiredShellPaths = retiredShellPaths.filter((routePath) => routeAlignment.reactRoutes.includes(routePath));
assert.deepEqual(leakedRetiredShellPaths, [], `portal_retired_shell_paths_must_be_removed:${JSON.stringify(leakedRetiredShellPaths)}`);

console.log(JSON.stringify({
  ok: true,
  contract: "v22_portal_frontend_api_surface_alignment",
  totals: {
    exportedAsyncFunctions: exports.length,
    activeUsed: usedRows.length,
    unused: unusedRows.length,
    uncategorizedUnused: uncategorizedUnused.length,
  },
  activeUsedByFile: groupRows(usedRows),
  unusedStatusSummary: statusSummary(adjudicatedUnusedRows),
  unusedByFile: groupRows(adjudicatedUnusedRows),
  routeAlignment,
}, null, 2));
