import { goControlPlaneClient } from "../client";
import type { CommercialProfile, SelectedServerPlan } from "./types";

export type { CommercialProfile } from "./types";

export interface CurrentUserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  accountStatus: string;
  billingStatus: string;
  entitlementStatus: string;
  commercial?: CommercialProfile;
  selectedServerPlan?: SelectedServerPlan | null;
  initials: string;
  currentTaskSlug: string;
  productProfile?: {
    runtimeMode: string;
    opsProfileEnabled: boolean;
    opsSurfaceEnabled: boolean;
  };
}

export async function fetchCurrentUser() {
  const { data } = await goControlPlaneClient.get<CurrentUserPayload>("/me");
  return data;
}
