export type PortalQueryValue = string | number | undefined;

export interface PortalPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type PortalAdminActionValue = string | number | boolean | null | undefined;

export interface PortalActionErrorShape {
  message?: string;
  businessMessage?: string;
}

export function normalizePortalBusinessError(cause: unknown, fallback: string) {
  const businessMessage = (cause as any)?.response?.data?.businessMessage;
  const message = typeof businessMessage === "string" && businessMessage.trim() ? businessMessage.trim() : fallback;
  const error = new Error(message) as Error & PortalActionErrorShape;
  error.businessMessage = message;
  return error;
}
