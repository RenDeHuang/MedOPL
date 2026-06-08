import { goControlPlaneClient } from "../client";
import type { PublicSettingsPayload } from "./types";

export async function fetchPublicSettings() {
  const { data } = await goControlPlaneClient.get<PublicSettingsPayload>("/public/settings");
  return data;
}
