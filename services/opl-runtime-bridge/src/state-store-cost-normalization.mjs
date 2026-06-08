export function normalizeCostRecords(records) {
  return Array.isArray(records) ? records.map(normalizeCostRecord) : [];
}

function normalizeCostRecord(item) {
  return item?.pricingSource === "contract-zero-cost"
    ? normalizeLegacyContractCost(item)
    : item;
}

function normalizeLegacyContractCost(item) {
  return {
    ...item,
    pricingSource: "legacy-contract-fixture",
    status: normalizeLegacyContractCostStatus(item.status),
  };
}

function normalizeLegacyContractCostStatus(status) {
  return status === "exact" ? "legacy_fixture" : status;
}
