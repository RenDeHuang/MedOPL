export function buildLaunchClientConstants({ directEntryDefaultJson }) {
  return `const STATE_KEY = "portal.opl.launch";
const BOOTSTRAP_KEY = "portal.opl.bootstrap";
const RUNTIME_BRIDGE_PATH = "/runtime-bridge";
const RUNTIME_BRIDGE_OPL_API_PATH = RUNTIME_BRIDGE_PATH + "/api/opl";

const DIRECT_ENTRY_DISMISS_KEY = "portal.opl.directEntryDismissed";

const OPL_MODULE_IDS = ["mas", "mag", "rca"];
const TIMING_MARKERS = ["portal_launch_ready_ms", "opl_dom_ready_ms", "opl_first_interaction_ms"];
const DIRECT_ENTRY_DEFAULT = ${directEntryDefaultJson};
const MODEL_SERVICE_SOURCE_COPY = "模型服务来源于 gflabtoken";`;
}

export const TELEMETRY_SECTION = `const launchStartedAtMs = performance.now();

window.__OPL_PORTAL_TIMING__ = window.__OPL_PORTAL_TIMING__ || {
  portal_launch_ready_ms: null,
  opl_dom_ready_ms: null,
  opl_first_interaction_ms: null,
  markers: []
};

function elapsedMs() {
  return Math.round(performance.now() - launchStartedAtMs);
}

function markOplTelemetry(marker, details = {}) {
  if (!TIMING_MARKERS.includes(marker)) return null;
  const timing = window.__OPL_PORTAL_TIMING__;
  if (timing[marker] === null || timing[marker] === undefined) {
    timing[marker] = elapsedMs();
  }
  const entry = {
    marker,
    valueMs: timing[marker],
    details,
    recordedAt: new Date().toISOString()
  };
  timing.markers.push(entry);
  try {
    window.dispatchEvent(new CustomEvent("opl:portal-telemetry", { detail: entry }));
  } catch {}
  return entry;
}

function markDomReady() {
  markOplTelemetry("opl_dom_ready_ms", { readyState: document.readyState || "" });
}

function installDomReadyMarker() {
  if (document.readyState === "interactive" || document.readyState === "complete") {
    markDomReady();
    return;
  }
  document.addEventListener("DOMContentLoaded", markDomReady, { once: true });
}

function markLaunchReady() {
  markOplTelemetry("portal_launch_ready_ms", { source: "opl-web-gateway" });
}

function markFirstInteraction(details = {}) {
  markOplTelemetry("opl_first_interaction_ms", details);
}`;
