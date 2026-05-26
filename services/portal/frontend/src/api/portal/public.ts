import { goControlPlaneClient } from "../client";

export interface PublicSettingsPayload {
  siteName: string;
  siteLogo: string;
  siteSubtitle: string;
  homeContent: string;
}

export async function fetchPublicSettings() {
  const { data } = await goControlPlaneClient.get<PublicSettingsPayload>("/public/settings");
  return data;
}
