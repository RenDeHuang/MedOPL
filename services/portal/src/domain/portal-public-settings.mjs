const DEFAULT_PUBLIC_SITE_SETTINGS = Object.freeze({
  siteName: "MedOPL",
  siteLogo: "",
  siteSubtitle: "托管 OPL 科研工作台",
  homeContent: "",
});

function cleanText(value = "") {
  return String(value || "").trim();
}

export function defaultPublicSiteSettings() {
  return { ...DEFAULT_PUBLIC_SITE_SETTINGS };
}

export function normalizePublicSiteSettings(input = {}) {
  return {
    siteName: cleanText(input.siteName) || DEFAULT_PUBLIC_SITE_SETTINGS.siteName,
    siteLogo: cleanText(input.siteLogo),
    siteSubtitle: cleanText(input.siteSubtitle) || DEFAULT_PUBLIC_SITE_SETTINGS.siteSubtitle,
    homeContent: String(input.homeContent || "").trim(),
  };
}

export function ensurePublicSiteSettings(db = {}) {
  if (!db.settings || typeof db.settings !== "object") db.settings = {};
  const normalized = normalizePublicSiteSettings(db.settings.publicSite || {});
  db.settings.publicSite = normalized;
  return normalized;
}

export function updatePublicSiteSettings(db = {}, input = {}) {
  const current = ensurePublicSiteSettings(db);
  db.settings.publicSite = normalizePublicSiteSettings({
    ...current,
    siteName: input.siteName,
    siteLogo: input.siteLogo,
    siteSubtitle: input.siteSubtitle,
    homeContent: input.homeContent,
  });
  return db.settings.publicSite;
}
