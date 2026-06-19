const EXECUTION_GATE_KEY = "RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION";
const TENCENT_EXECUTION_GATE_KEY = "RUN_TENCENT_CREATE_RELEASE_EXECUTION";

export const REQUIRED_KEYS = Object.freeze([
  EXECUTION_GATE_KEY,
  "MEDOPL_POSTGRES_LEDGER_HOST",
  "MEDOPL_POSTGRES_LEDGER_PORT",
  "MEDOPL_POSTGRES_LEDGER_DATABASE",
  "MEDOPL_POSTGRES_LEDGER_USER",
  "MEDOPL_POSTGRES_LEDGER_PASSWORD",
  "MEDOPL_POSTGRES_LEDGER_SSLMODE",
]);
const OPTIONAL_KEYS = Object.freeze(["MEDOPL_POSTGRES_LEDGER_SCHEMA", TENCENT_EXECUTION_GATE_KEY]);
export const ALLOWLIST = Object.freeze([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);

export function clean(value = "") {
  return String(value || "").trim();
}

export function redactedText(value = "") {
  return String(value || "")
    .replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, "[redacted-db-url]")
    .replace(/password\s*[:=]\s*[^,\s;]+/giu, "password=[redacted]")
    .replace(/SecretId|SecretKey|KUBECONFIG|kubeconfig/giu, "[redacted-sensitive-key]")
    .slice(0, 512);
}

function stripQuotes(value = "") {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function parseLine(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
  const index = normalized.indexOf("=");
  if (index <= 0) return null;
  return [normalized.slice(0, index).trim(), stripQuotes(normalized.slice(index + 1))];
}

export function parsePostgresLedgerEnv(content = "") {
  const env = new Map();
  for (const line of String(content || "").split(/\r?\n/u)) {
    const parsed = parseLine(line);
    if (parsed) env.set(parsed[0], parsed[1]);
  }
  return env;
}

function forbiddenKey(key = "") {
  if (key === TENCENT_EXECUTION_GATE_KEY) return false;
  return (
    /^TENCENT_/u.test(key)
    || /^PACKAGE_D_/u.test(key)
    || /(?:^|_)KUBECONFIG$/u.test(key)
    || /KUBE/u.test(key)
    || /SECRET_ID|SECRET_KEY/u.test(key)
    || /DEPLOY/u.test(key)
    || /BUILD_PUSH/u.test(key)
  );
}

export function validateIdentifier(value = "", label = "identifier") {
  const text = clean(value);
  if (!/^[a-z_][a-z0-9_]*$/u.test(text)) {
    throw new Error(`package_c_postgres_ledger_invalid_${label}`);
  }
  return text;
}

function value(env, key) {
  return clean(env.get(key));
}

export function validatePostgresLedgerEnv(env) {
  const forbidden = [...env.keys()].filter((key) => !ALLOWLIST.includes(key) || forbiddenKey(key)).sort();
  const missing = REQUIRED_KEYS.filter((key) => value(env, key) === "");
  const errors = [];
  if (value(env, EXECUTION_GATE_KEY) !== "1") errors.push("RUN_MEDOPL_POSTGRES_LEDGER_EXECUTION_must_be_1");
  const tencentMutationRunGate = value(env, TENCENT_EXECUTION_GATE_KEY) || "0";
  if (tencentMutationRunGate !== "0") errors.push("RUN_TENCENT_CREATE_RELEASE_EXECUTION_must_be_0");
  const port = Number(value(env, "MEDOPL_POSTGRES_LEDGER_PORT"));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) errors.push("MEDOPL_POSTGRES_LEDGER_PORT_invalid");
  const sslMode = value(env, "MEDOPL_POSTGRES_LEDGER_SSLMODE");
  if (sslMode && !["disable", "require", "verify-ca", "verify-full"].includes(sslMode)) {
    errors.push("MEDOPL_POSTGRES_LEDGER_SSLMODE_invalid");
  }
  const schema = value(env, "MEDOPL_POSTGRES_LEDGER_SCHEMA") || "public";
  try {
    validateIdentifier(schema, "schema");
  } catch {
    errors.push("MEDOPL_POSTGRES_LEDGER_SCHEMA_invalid");
  }
  const ok = forbidden.length === 0 && missing.length === 0 && errors.length === 0;
  return {
    ok,
    forbidden,
    missing,
    errors,
    allowlist: ALLOWLIST,
    requiredKeys: REQUIRED_KEYS,
    config: ok ? {
      executionGate: value(env, EXECUTION_GATE_KEY),
      tencentMutationRunGate,
      host: value(env, "MEDOPL_POSTGRES_LEDGER_HOST"),
      port,
      database: value(env, "MEDOPL_POSTGRES_LEDGER_DATABASE"),
      user: value(env, "MEDOPL_POSTGRES_LEDGER_USER"),
      password: value(env, "MEDOPL_POSTGRES_LEDGER_PASSWORD"),
      sslMode,
      schema,
    } : null,
  };
}

export function redactPostgresLedgerConfig(config = {}) {
  return {
    executionGate: clean(config.executionGate) === "1" ? "1" : "0",
    tencentMutationRunGate: clean(config.tencentMutationRunGate) === "1" ? "1" : "0",
    host: clean(config.host) ? "[redacted-host]" : "",
    port: Number(config.port) || 0,
    database: clean(config.database) ? "[redacted-database]" : "",
    user: clean(config.user) ? "[redacted-user]" : "",
    password: "[redacted]",
    sslMode: clean(config.sslMode),
    schema: clean(config.schema || "public"),
    connectionUrl: "[not-used]",
  };
}
