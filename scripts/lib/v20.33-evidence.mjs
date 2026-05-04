import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const V20_33_SENSITIVE_PATTERN = /cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token/i;

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizeText(value = "") {
  return String(value || "")
    .replace(/\b(cookie|authorization|q-ak|x-cos-security-token|providerKey|password|secret|token)\b[^,\n]*/gi, "$1=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi, "Bearer [redacted]")
    .replace(/\bAKID[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b(?:sk-|ghp_|q-ak:|x-cos-security-token:)[A-Za-z0-9._:-]{8,}\b/gi, "[redacted]")
    .replace(/\bsuper-secret[A-Za-z0-9._:-]*\b/gi, "[redacted]");
}

export function redactSensitiveEvidence(value) {
  if (Array.isArray(value)) return value.map((item) => redactSensitiveEvidence(item));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? sanitizeText(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      V20_33_SENSITIVE_PATTERN.test(key) ? "[redacted]" : redactSensitiveEvidence(item),
    ]),
  );
}

function normalizeStageDetails(details = {}) {
  return {
    blockingUser: Boolean(details.blockingUser),
    userVisibleState: String(details.userVisibleState || "unknown").trim() || "unknown",
  };
}

export function createEvidenceRecorder({ evidenceDir, contract }) {
  if (!evidenceDir) throw new Error("evidenceDir_required");
  const stages = [];

  function addStage(stage, details = {}) {
    const base = normalizeStageDetails(details);
    const at = nowIso();
    stages.push(redactSensitiveEvidence({
      stage,
      startedAt: details.startedAt || at,
      endedAt: details.endedAt || at,
      latencyMs: Number.isFinite(Number(details.latencyMs)) ? Number(details.latencyMs) : 0,
      ok: details.ok ?? true,
      ...base,
      ...details,
    }));
    return stages[stages.length - 1];
  }

  async function runStage(stage, details, task, detailsForResult = (result) => result || {}) {
    const startedAt = nowIso();
    const startedMs = Date.now();
    try {
      const result = await task();
      addStage(stage, {
        ...normalizeStageDetails(details),
        startedAt,
        endedAt: nowIso(),
        latencyMs: Date.now() - startedMs,
        ok: true,
        ...detailsForResult(result),
      });
      return result;
    } catch (error) {
      addStage(stage, {
        ...normalizeStageDetails(details),
        startedAt,
        endedAt: nowIso(),
        latencyMs: Date.now() - startedMs,
        ok: false,
        error: sanitizeText(error instanceof Error ? error.message : String(error)),
      });
      throw error;
    }
  }

  async function writeEvidence(payload) {
    await mkdir(evidenceDir, { recursive: true });
    const filePath = path.join(evidenceDir, `${nowIso().replace(/[:.]/g, "-")}.json`);
    const safePayload = redactSensitiveEvidence({
      contract,
      ...payload,
      stages: payload?.stages || stages,
    });
    await writeFile(filePath, `${JSON.stringify(safePayload, null, 2)}\n`, "utf8");
    return filePath;
  }

  return {
    stages,
    addStage,
    runStage,
    writeEvidence,
  };
}
