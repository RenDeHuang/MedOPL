import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, ".runtime", "cos-exact-bill-preview-v20.2");

function readEnv(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sanitizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return text;
  }
}

async function writeEvidence(payload) {
  await mkdir(evidenceDir, { recursive: true });
  const filePath = path.join(evidenceDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

function missingEnv() {
  const billingBaseUrl = trimTrailingSlash(
    readEnv("COS_LIVE_BILLING_BASE_URL")
      || readEnv("BILLING_BASE_URL")
      || readEnv("BILLING_SERVICE_URL")
      || readEnv("BILLING_RECONCILE_URL").replace(/\/reconcile\/?$/, ""),
  );
  const objectKey = readEnv("COS_LIVE_BILL_OBJECT_KEY", readEnv("COS_LIVE_BILL_OBJECT_PATH"));
  const required = [
    ["RUN_COS_LIVE", readEnv("RUN_COS_LIVE")],
    ["COS_LIVE_BILLING_BASE_URL", billingBaseUrl],
    ["COS_LIVE_BILL_OBJECT_KEY", objectKey],
  ];
  return required.filter(([, value]) => !value || (value === "0")).map(([name]) => name);
}

async function main() {
  const missing = missingEnv();
  if (missing.length > 0 || readEnv("RUN_COS_LIVE") !== "1") {
    const payload = {
      ok: true,
      skipped: true,
      reason: "missing_required_env",
      missing,
    };
    const evidencePath = await writeEvidence(payload);
    console.log(JSON.stringify({ ...payload, evidencePath }, null, 2));
    return;
  }

  const billingBaseUrl = trimTrailingSlash(
    readEnv("COS_LIVE_BILLING_BASE_URL")
      || readEnv("BILLING_BASE_URL")
      || readEnv("BILLING_SERVICE_URL")
      || readEnv("BILLING_RECONCILE_URL").replace(/\/reconcile\/?$/, ""),
  );
  const objectKey = readEnv("COS_LIVE_BILL_OBJECT_KEY", readEnv("COS_LIVE_BILL_OBJECT_PATH"));
  const previewUrl = `${billingBaseUrl}/billing/cos/reconcile`;
  const response = await fetch(previewUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ objectKey, COS_LIVE_BILL_OBJECT_KEY: objectKey }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`preview_request_failed:${response.status}`);
  }

  const evidence = {
    ok: payload?.ok === true,
    skipped: false,
    billingBaseUrl: sanitizeUrl(billingBaseUrl),
    latestFile: payload?.latestFile || null,
    parsedRowCount: Number(payload?.parsedRowCount || 0),
    attributedCount: Number(payload?.attributedCount || 0),
    unattributedCount: Number(payload?.unattributedCount || 0),
    rowsCount: Array.isArray(payload?.rows) ? payload.rows.length : 0,
    attributedRowsCount: Array.isArray(payload?.attributedRows) ? payload.attributedRows.length : 0,
    unattributedRowsCount: Array.isArray(payload?.unattributedRows) ? payload.unattributedRows.length : 0,
    wouldChargeCents: Number(payload?.wouldChargeCents || 0),
    wouldRefundCents: Number(payload?.wouldRefundCents || 0),
    wouldMakeupCents: Number(payload?.wouldMakeupCents || 0),
  };
  const evidencePath = await writeEvidence(evidence);
  console.log(JSON.stringify({ ...evidence, evidencePath }, null, 2));
}

await main();
