import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const commercialLaunchFreezeMatrixPath = "contracts/medopl-commercial-launch-freeze-matrix.json";

function sanitizeSliceId(sliceId) {
  return String(sliceId || "").trim().replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
}

function isNewTargetStatus(status) {
  const value = String(status || "");
  return value.startsWith("A") || value.startsWith("C") || value.startsWith("R") || value.includes("A");
}

function pathMatchesAdmissionPattern(file, pattern) {
  const normalizedPattern = String(pattern || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalizedPattern) return false;
  if (normalizedPattern.endsWith("/**")) return file === normalizedPattern.slice(0, -3) || file.startsWith(normalizedPattern.slice(0, -2));
  if (normalizedPattern.endsWith("/")) return file.startsWith(normalizedPattern);
  return file === normalizedPattern;
}

function fileAllowedByAdmission(file, admission) {
  const allowedPaths = admission?.allowed_paths || [];
  if (allowedPaths.length === 0) return true;
  return allowedPaths.some((pattern) => pathMatchesAdmissionPattern(file, pattern));
}

function readCommercialLaunchFreezeMatrix(repoRoot) {
  const matrixPath = path.join(repoRoot, commercialLaunchFreezeMatrixPath);
  if (!existsSync(matrixPath)) return null;
  return JSON.parse(readFileSync(matrixPath, "utf8"));
}

function commercialLaunchSurfaceIds(freezeMatrix) {
  return (freezeMatrix?.commercial_launch_freeze_matrix?.surfaces || [])
    .map((surface) => String(surface?.id || "").trim())
    .filter(Boolean);
}

function commercialLaunchRequiredFields(freezeMatrix) {
  return (freezeMatrix?.new_surface_admission?.required_fields || [])
    .map((field) => String(field || "").trim())
    .filter(Boolean);
}

function isCommercialLaunchFile(file) {
  return [
    /^services\/portal\/frontend\/src\/app\/pages(?:\/|$)/u,
    /^services\/portal\/frontend\/src\/app\/components(?:\/|$)/u,
    /^services\/portal\/frontend\/src\/app\/routes\.tsx$/u,
    /^services\/portal\/frontend\/src\/app\/components\/Layout\.tsx$/u,
    /^contracts\/medopl-commercial-launch-freeze-matrix\.json$/u,
    /^contracts\/medopl-portal-(?:page-state-matrix|interaction-flow-contract|ui-quality-contract)\.json$/u,
    /^contracts\/medopl-(?:product-profile|api-contract|billing-ledger-contract|release-boundary|production-receipt-boundary)\.json$/u,
    /^docs\/(?:active|product|specs)\/README\.md$/u,
    /^tests\/frontend\/frontend-test-v22-portal-page-state-matrix\.mjs$/u,
    /^tests\/regression\/portal\/regression-test-v22-portal-resource-control-ui-browser\.mjs$/u,
  ].some((pattern) => pattern.test(file));
}

export function readSliceAdmission(repoRoot, sliceId) {
  if (!sliceId || sliceId === true) return null;
  const safeSliceId = sanitizeSliceId(sliceId);
  if (!safeSliceId) return null;
  const manifestPath = path.join(repoRoot, ".runtime", "slices", safeSliceId, "slice.json");
  if (!existsSync(manifestPath)) throw new Error(`slice_manifest_not_found:${path.relative(repoRoot, manifestPath)}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return manifest.admission || null;
}

export function evaluateSliceAdmission({
  changedFiles = [],
  changedStatuses = new Map(),
  sliceAdmission,
  lineBudgetDiff = {},
  repoRoot = process.cwd(),
  skipCommercialLaunchFreezeAdmission = false,
} = {}) {
  const normalizedFiles = changedFiles.map((file) => String(file || "").replaceAll("\\", "/").replace(/^\.\//, "")).filter(Boolean);
  const findings = [];
  const commercialLaunchFiles = normalizedFiles.filter(isCommercialLaunchFile);
  if (!skipCommercialLaunchFreezeAdmission && commercialLaunchFiles.length > 0) {
    const freezeMatrix = readCommercialLaunchFreezeMatrix(repoRoot);
    const availableSurfaces = commercialLaunchSurfaceIds(freezeMatrix);
    const requiredFields = commercialLaunchRequiredFields(freezeMatrix);
    if (!sliceAdmission) {
      findings.push({
        code: "commercial_launch_freeze_admission_missing",
        severity: "blocker",
        files: commercialLaunchFiles,
        requiredFields,
        availableSurfaces,
        matrix: commercialLaunchFreezeMatrixPath,
      });
    } else {
      const missing = requiredFields.filter((field) => {
        const value = sliceAdmission[field];
        return Array.isArray(value) ? value.length === 0 : !String(value || "").trim();
      });
      if (missing.length > 0) {
        findings.push({
          code: "commercial_launch_freeze_admission_incomplete",
          severity: "blocker",
          files: commercialLaunchFiles,
          missing,
          requiredFields,
          matrix: commercialLaunchFreezeMatrixPath,
        });
      }
      if (sliceAdmission.freeze_surface && !availableSurfaces.includes(sliceAdmission.freeze_surface)) {
        findings.push({
          code: "commercial_launch_freeze_surface_unknown",
          severity: "blocker",
          files: commercialLaunchFiles,
          freezeSurface: sliceAdmission.freeze_surface,
          availableSurfaces,
          matrix: commercialLaunchFreezeMatrixPath,
        });
      }
    }
  }
  if (!sliceAdmission) return findings;
  const sliceType = sliceAdmission.slice_type || "product";

  const forbiddenByAdmission = normalizedFiles.filter((file) =>
    (sliceAdmission.forbidden_paths || []).some((pattern) => pathMatchesAdmissionPattern(file, pattern)));
  if (forbiddenByAdmission.length > 0) {
    findings.push({ code: "slice_forbidden_path_changed", severity: "blocker", files: forbiddenByAdmission });
  }

  const outsideAllowed = normalizedFiles.filter((file) => !fileAllowedByAdmission(file, sliceAdmission));
  if (outsideAllowed.length > 0) {
    findings.push({ code: "slice_changed_file_outside_allowed_paths", severity: "blocker", files: outsideAllowed });
  }

  const newTopLevelScripts = normalizedFiles.filter((file) =>
    /^scripts\/v22-[^/]+\.mjs$/u.test(file)
    && isNewTargetStatus(changedStatuses.get(file)));
  if (!sliceAdmission.new_top_level_scripts_allowed && newTopLevelScripts.length > 0) {
    findings.push({ code: "slice_new_top_level_script_forbidden", severity: "blocker", files: newTopLevelScripts });
  }

  const newHealthTests = normalizedFiles.filter((file) =>
    /^tests\/health\/[^/]+\.mjs$/u.test(file)
    && isNewTargetStatus(changedStatuses.get(file)));
  if (!sliceAdmission.new_health_tests_allowed && newHealthTests.length > 0) {
    findings.push({ code: "slice_new_health_test_forbidden", severity: "blocker", files: newHealthTests });
  }

  const newContracts = normalizedFiles.filter((file) =>
    /^contracts\/[^/]+\.json$/u.test(file)
    && isNewTargetStatus(changedStatuses.get(file)));
  if (!sliceAdmission.new_contracts_allowed && newContracts.length > 0) {
    findings.push({ code: "slice_new_contract_forbidden", severity: "blocker", files: newContracts });
  }

  const cloudFiles = normalizedFiles.filter((file) =>
    file.startsWith("deploy/")
    || file.startsWith("infra/")
    || file.startsWith("adapters/")
    || file.startsWith("tests/cloud/")
    || file.includes("cloud"));
  if (!sliceAdmission.touches_cloud && cloudFiles.length > 0) {
    findings.push({ code: "slice_cloud_surface_forbidden", severity: "blocker", files: cloudFiles });
  }

  const activeDocFiles = normalizedFiles.filter((file) => file === "docs/active/README.md");
  if (!sliceAdmission.touches_active_docs && activeDocFiles.length > 0 && sliceType !== "cleanup") {
    findings.push({ code: "slice_active_docs_change_requires_admission", severity: "blocker", files: activeDocFiles });
  }

  const grownOversizeFiles = lineBudgetDiff.grownOversizeFiles || [];
  if (sliceAdmission.must_reduce_or_hold_bloat && grownOversizeFiles.length > 0) {
    findings.push({ code: "slice_oversize_file_growth_forbidden", severity: "blocker", files: grownOversizeFiles.map((item) => item.file || item) });
  }

  if (sliceType === "cloud") {
    const missing = [];
    if (!sliceAdmission.operation_class) missing.push("operation_class");
    if (!sliceAdmission.evidence_sink) missing.push("evidence_sink");
    if (!sliceAdmission.receipt_manifest_required) missing.push("receipt_manifest_required");
    if (!sliceAdmission.cannot_claim?.includes("production complete")) missing.push("cannot_claim.production_complete");
    if (missing.length > 0) findings.push({ code: "slice_cloud_admission_incomplete", severity: "blocker", missing });
  }

  return findings;
}
