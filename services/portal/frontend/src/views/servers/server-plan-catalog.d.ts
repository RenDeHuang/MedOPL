export const SERVER_PLAN_PAGE_SIZE: number;

export interface ServerPlanCatalogLikeItem {
  cpu?: number;
  memoryGb?: number;
  salable?: boolean;
  canOrder?: boolean;
  hourlyPrice?: number;
  discountPrice?: number;
  unitPrice?: number;
  originalPrice?: number;
  availabilityStatus?: string;
  statusCategory?: string;
  soldOutReason?: string;
  reason?: string;
}

export function planCanOrder(plan?: ServerPlanCatalogLikeItem): boolean;
export function planHourlyPrice(plan?: ServerPlanCatalogLikeItem): number;
export function planAvailabilityLabel(plan?: ServerPlanCatalogLikeItem): string;
export function planDisabledReason(plan?: ServerPlanCatalogLikeItem): string;
export function collectServerPlanFilterOptions(items?: ServerPlanCatalogLikeItem[]): { cpu: number[]; memoryGb: number[] };
export function filterServerPlans<T extends ServerPlanCatalogLikeItem>(items?: T[], filters?: { cpu?: string | number; memoryGb?: string | number }): T[];
export function paginateServerPlans<T>(items?: T[], page?: number, pageSize?: number): {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
