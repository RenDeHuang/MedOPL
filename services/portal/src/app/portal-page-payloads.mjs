import { createBillingPayloadBuilders } from "./portal-page-billing-payloads.mjs";
import { createOverviewPayloadBuilder } from "./portal-page-overview-payloads.mjs";
import { createWorkspacePayloadBuilder } from "./portal-page-workspace-payloads.mjs";

export {
  groupBillingByDay,
  normalizePageSize,
  paginateRows,
  parsePositiveInt,
  rangeBounds,
  withinDateRange,
} from "./portal-page-payload-primitives.mjs";

export function createPortalPagePayloads(deps) {
  const buildOverviewPayload = createOverviewPayloadBuilder(deps);
  const {
    buildBillingPayload,
    buildBillingDetailsPayload,
    buildBillingSummaryPayload,
  } = createBillingPayloadBuilders(deps);
  const buildWorkspacePayload = createWorkspacePayloadBuilder(deps);

  return {
    buildBillingPayload,
    buildBillingDetailsPayload,
    buildBillingSummaryPayload,
    buildOverviewPayload,
    buildWorkspacePayload,
  };
}
