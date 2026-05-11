import { apiClient } from "../client";

export interface PublicSettingsPayload {
  siteName: string;
  siteLogo: string;
  siteSubtitle: string;
  homeContent: string;
}

export async function fetchPublicSettings() {
  const { data } = await apiClient.get<PublicSettingsPayload>("/public/settings");
  return data;
}
