export function hasSoldOutMarker(statusCategory = "", soldOutReason = "") {
  const category = String(statusCategory || "").trim().toLowerCase();
  const reason = String(soldOutReason || "").trim();
  if (reason) return true;
  const normalized = category.replace(/[^a-z0-9]+/g, "");
  if (["enoughstock", "normalstock", "instock"].includes(normalized)) return false;
  return [
    "soldout",
    "stockout",
    "outofstock",
    "nostock",
    "understock",
    "insufficient",
    "shortage",
    "inventoryshortage",
  ].some((marker) => normalized.includes(marker))
    || category.includes("sold out")
    || category.includes("out of stock")
    || category.includes("库存不足")
    || category.includes("无库存")
    || category.includes("售罄");
}

export function resolvePlanSaleStatus({
  plan = {},
  quote = {},
  firstString,
  firstNumber,
}) {
  const availabilityStatus = firstString(plan.availabilityStatus, plan.status, quote.availabilityStatus).toUpperCase();
  const statusCategory = firstString(plan.statusCategory, quote.statusCategory);
  const soldOutReason = firstString(plan.soldOutReason, quote.soldOutReason);
  const hourlyPrice = firstNumber(
    quote.discountPrice,
    quote.unitPrice,
    quote.originalPrice,
    plan.hourlyPrice,
    plan.discountPrice,
    plan.unitPrice,
    plan.originalPrice,
  );
  const hasPrice = hourlyPrice > 0;
  const canOrder = hasSoldOutMarker(statusCategory, soldOutReason)
    ? false
    : availabilityStatus
      ? availabilityStatus === "SELL" && hasPrice
      : Boolean((plan.canOrder ?? plan.salable ?? quote.salable) && hasPrice);
  return { availabilityStatus, statusCategory, soldOutReason, hourlyPrice, canOrder };
}
