const normalizeFile = (file) => String(file || "").replaceAll("\\", "/").replace(/^\.\//u, "");

function matchesPrefix(file, prefixes = []) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export const TEST_ENVIRONMENTS = Object.freeze(["local", "staging", "production-canary"]);
export const TEST_SURFACES = Object.freeze([
  "product",
  "frontend",
  "backend",
  "runtime",
  "cloud",
  "release",
  "hygiene",
  "contract",
  "docs",
  "smoke",
  "regression",
]);

export const TEST_PLAN_BASE_COMMANDS = Object.freeze([
  "npm run test:health",
  "npm run test:smoke",
  "npm run test:contract",
]);

const TEST_PLAN_CHANGED_SURFACE_COMMANDS = Object.freeze([
  "npm run test:fast",
  "npm run test:lanes",
]);

const TEST_PLAN_FULL_LOCAL_COMMANDS = Object.freeze([
  "npm run test:regression",
  "npm run verify:local-release-candidate",
]);

export const TEST_PLAN_CANNOT_CLAIM = Object.freeze([
  "production readiness",
  "real cloud execution",
  "deploy completion",
  "Kubernetes command success",
  "live-test coverage",
]);

export const TEST_POLICY_SURFACE_COVERAGE = Object.freeze({
  laneToSurfaces: Object.freeze({
    product: Object.freeze(["product"]),
    frontend: Object.freeze(["frontend"]),
    backend: Object.freeze(["backend"]),
    runtime: Object.freeze(["runtime"]),
    release: Object.freeze(["release"]),
    cloud: Object.freeze(["cloud"]),
    hygiene: Object.freeze(["hygiene"]),
    health: Object.freeze(["hygiene"]),
    smoke: Object.freeze(["smoke"]),
    contract: Object.freeze(["contract"]),
    "regression-portal": Object.freeze(["regression", "frontend"]),
    "regression-opl": Object.freeze(["regression", "runtime"]),
    "regression-runtime-bridge": Object.freeze(["regression", "runtime"]),
    "real-cloud-readiness": Object.freeze(["cloud"]),
    "future-authorized": Object.freeze(["cloud"]),
    "retired-governance": Object.freeze(["hygiene"]),
  }),
  categoryToSurfaces: Object.freeze({
    product: Object.freeze(["product"]),
    frontend: Object.freeze(["frontend"]),
    backend: Object.freeze(["backend"]),
    runtime: Object.freeze(["runtime"]),
    release: Object.freeze(["release"]),
    cloud: Object.freeze(["cloud"]),
    hygiene: Object.freeze(["hygiene"]),
    smoke: Object.freeze(["smoke"]),
    contract: Object.freeze(["contract"]),
    regression: Object.freeze(["regression", "frontend", "runtime"]),
    "retired-governance": Object.freeze(["hygiene"]),
    "suite-wrapper": Object.freeze(["smoke", "contract"]),
  }),
  registrySurfaceToPolicySurfaces: Object.freeze({
    "control-plane": Object.freeze(["product", "backend", "hygiene", "contract"]),
    portal: Object.freeze(["frontend", "regression"]),
    opl: Object.freeze(["runtime", "regression"]),
    "runtime-bridge": Object.freeze(["runtime", "regression"]),
    cloud: Object.freeze(["cloud", "release"]),
  }),
});

export const TEST_SURFACE_RULES = Object.freeze([
  Object.freeze({
    id: "frontend-source",
    surface: "frontend",
    environment: "local",
    pathPrefixes: Object.freeze([
      "services/portal/frontend/",
      "tests/frontend/",
      "tests/regression/portal/",
    ]),
    commands: Object.freeze([
      "npm run test:frontend",
      "npm run test:regression",
    ]),
    reason: "frontend surface changed",
  }),
  Object.freeze({
    id: "portal-control-plane",
    surface: "product",
    environment: "local",
    match(file) {
      return file.startsWith("services/portal/") && !file.startsWith("services/portal/frontend/");
    },
    commands: Object.freeze([
      "npm --prefix services/portal run check",
      "npm run test:regression",
    ]),
    reason: "portal control-plane changed",
  }),
  Object.freeze({
    id: "go-backend",
    surface: "backend",
    environment: "local",
    pathPrefixes: Object.freeze([
      "services/medopl-go-backend/",
      "tests/backend/",
    ]),
    commands: Object.freeze([
      "npm run test:backend",
      "bash -lc \"cd services/medopl-go-backend && GOPROXY=https://goproxy.cn,direct GOSUMDB=sum.golang.google.cn go test ./...\"",
    ]),
    reason: "backend API or Go service changed",
  }),
  Object.freeze({
    id: "runtime-bridge",
    surface: "runtime",
    environment: "local",
    pathPrefixes: Object.freeze([
      "services/opl-runtime-bridge/",
      "services/opl-web-gateway/",
      "tests/runtime/",
      "tests/regression/runtime-bridge/",
      "tests/regression/opl/",
    ]),
    commands: Object.freeze([
      "npm run test:runtime",
      "npm run test:regression",
    ]),
    reason: "runtime or OPL boundary changed",
  }),
  Object.freeze({
    id: "release-boundary",
    surface: "release",
    environment: "local",
    pathPrefixes: Object.freeze([
      "tests/release/",
      "docs/evidence/",
    ]),
    match(file) {
      return file.startsWith("contracts/medopl-release-boundary");
    },
    commands: Object.freeze(["npm run test:release"]),
    reason: "release boundary changed",
  }),
  Object.freeze({
    id: "cloud-boundary",
    surface: "cloud",
    environment: "local",
    authorizedEnvironment: "staging",
    pathPrefixes: Object.freeze([
      "tests/cloud/",
      "tests/support/cloud-prework/",
    ]),
    match(file) {
      return file.startsWith("contracts/medopl-cloud-boundary");
    },
    commands: Object.freeze([
      "npm run test:cloud",
      "npm run test:real-cloud-readiness",
    ]),
    authorizedCommands: Object.freeze(["npm run test:cloud-future-authorized"]),
    cannotClaim: Object.freeze([
      "future-authorized cloud mutation",
      "production canary coverage",
    ]),
    reason: "cloud boundary changed",
  }),
  Object.freeze({
    id: "governance-and-hygiene",
    surface: "hygiene",
    environment: "local",
    pathPrefixes: Object.freeze([
      "scripts/",
      "tests/governance/",
      "tests/health/",
      "tests/hygiene/",
      "tests/fixtures/v22/",
    ]),
    match(file) {
      return file === "package.json" || /^tests\/[^/]+\.mjs$/u.test(file);
    },
    commands: Object.freeze([
      "npm run test:hygiene",
      "npm run test:health",
      "npm run test:contract",
    ]),
    reason: "runner, governance, or hygiene boundary changed",
  }),
  Object.freeze({
    id: "contract-surface",
    surface: "contract",
    environment: "local",
    pathPrefixes: Object.freeze([
      "contracts/",
      "specs/",
    ]),
    commands: Object.freeze(["npm run test:contract"]),
    reason: "machine-readable contract changed",
  }),
  Object.freeze({
    id: "docs-surface",
    surface: "docs",
    environment: "local",
    match(file) {
      return file.startsWith("docs/") || file === "README.md" || file === "AGENTS.md" || file === "TASTE.md";
    },
    commands: Object.freeze([
      "npm run test:health",
      "npm run check:diff",
    ]),
    reason: "human-readable docs entry changed",
  }),
]);

function fileMatchesRule(file, rule) {
  if (typeof rule.match === "function" && rule.match(file)) return true;
  return matchesPrefix(file, rule.pathPrefixes);
}

export function planCommandsForFiles(files, { profile = "changed-surface" } = {}) {
  const normalizedFiles = unique(files.map(normalizeFile));
  const matchedSurfaces = [];
  const environments = [];
  const authorizedEnvironments = [];
  const recommendedCommands = [...TEST_PLAN_BASE_COMMANDS];
  const authorizedCommands = [];
  const cannotClaim = [...TEST_PLAN_CANNOT_CLAIM];
  const reasons = [];

  if (profile === "changed-surface") {
    recommendedCommands.push(...TEST_PLAN_CHANGED_SURFACE_COMMANDS);
  }
  if (profile === "full-local") {
    recommendedCommands.push(...TEST_PLAN_CHANGED_SURFACE_COMMANDS, ...TEST_PLAN_FULL_LOCAL_COMMANDS);
  }

  for (const file of normalizedFiles) {
    for (const rule of TEST_SURFACE_RULES) {
      if (!fileMatchesRule(file, rule)) continue;
      matchedSurfaces.push(rule.surface);
      environments.push(rule.environment);
      if (rule.authorizedEnvironment) authorizedEnvironments.push(rule.authorizedEnvironment);
      recommendedCommands.push(...(rule.commands || []));
      authorizedCommands.push(...(rule.authorizedCommands || []));
      cannotClaim.push(...(rule.cannotClaim || []));
      reasons.push(Object.freeze({
        file,
        ruleId: rule.id,
        surface: rule.surface,
        environment: rule.environment,
        message: rule.reason,
      }));
    }
  }

  return Object.freeze({
    matchedSurfaces: Object.freeze(unique(matchedSurfaces)),
    environments: Object.freeze(unique(environments)),
    authorizedEnvironments: Object.freeze(unique(authorizedEnvironments)),
    recommendedCommands: Object.freeze(unique(recommendedCommands)),
    authorizedCommands: Object.freeze(unique(authorizedCommands)),
    reasons: Object.freeze(reasons),
    cannotClaim: Object.freeze(unique(cannotClaim)),
  });
}
