import { fetchCurrentUser } from "../../api/portal/commercial";
import { fetchAnnouncements } from "../../api/portal/sessions";
import { dateText } from "./portalFormatters";
import { usePortalQuery } from "./portalQuery";

export async function loadCurrentUserModel() {
  const user = await fetchCurrentUser();
  return {
    userName: user.name || user.email || "MedOPL 用户",
    userEmail: user.email || "",
    status: user.status === "disabled" ? "disabled" : user.status === "restricted" ? "restricted" : "active",
    initials: (user.initials || user.name || user.email || "用户").slice(0, 2),
  } as const;
}

export async function loadAnnouncementModel() {
  const announcements = await fetchAnnouncements();
  return {
    announcements: announcements.items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      isPinned: Boolean(item.pinned),
      createdAt: dateText(item.createdAt),
      updatedAt: dateText(item.updatedAt),
    })),
  };
}

export function useCurrentUserModel() {
  return usePortalQuery(loadCurrentUserModel, []);
}

export function useAnnouncementModel() {
  return usePortalQuery(loadAnnouncementModel, []);
}
