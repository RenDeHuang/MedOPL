export function createCosBillingRuntime({
  cosBillReader,
  buildCosBillReader,
  cosConfig,
  firstNonEmpty,
  normalizeCosBillRow,
  summaryFromTencentBillRows,
  applyResourceAttributionToRows,
  requiredCostTags = [],
  fetchImpl = globalThis.fetch,
  resourceProvisionerUrl = "",
  resourceProvisionerTimeoutMs = 20000,
  abortSignalTimeout = (timeoutMs) => AbortSignal.timeout(timeoutMs),
  now = () => new Date().toISOString(),
  fetchExactSummary,
} = {}) {
  if (!cosBillReader) throw new Error("cosBillReader is required");
  if (typeof buildCosBillReader !== "function") throw new Error("buildCosBillReader is required");
  if (!cosConfig || typeof cosConfig !== "object") throw new Error("cosConfig is required");
  if (typeof firstNonEmpty !== "function") throw new Error("firstNonEmpty is required");
  if (typeof normalizeCosBillRow !== "function") throw new Error("normalizeCosBillRow is required");
  if (typeof summaryFromTencentBillRows !== "function") throw new Error("summaryFromTencentBillRows is required");
  if (typeof applyResourceAttributionToRows !== "function") throw new Error("applyResourceAttributionToRows is required");

  function normalizeCosTarget(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { objectKey: "", prefix: "" };
    }
    return {
      objectKey: firstNonEmpty(input.objectKey, input.object_key, input.COS_LIVE_BILL_OBJECT_KEY),
      prefix: firstNonEmpty(input.prefix, input.COS_LIVE_BILL_PREFIX),
    };
  }

  function buildCosBillStatus() {
    return {
      ok: Boolean(cosConfig.bucket && cosConfig.region),
      credentialsConfigured: cosBillReader.configured(),
      source: "tencent_cloud_cos_bill_delivery",
      bucket: cosConfig.bucket,
      region: cosConfig.region,
      prefix: cosConfig.prefix,
      endpoint: cosBillReader.endpoint,
      deliveryConfigured: Boolean(cosConfig.bucket && cosConfig.region),
      note: "COS bill files are used for daily reconciliation. Exact cost must come from Tencent bill detail or COS bill files.",
    };
  }

  function cosReaderForTarget(target = {}) {
    const normalized = normalizeCosTarget(target);
    if (!normalized.prefix || normalized.prefix === cosBillReader.prefix) {
      return { reader: cosBillReader, target: normalized };
    }
    return {
      reader: buildCosBillReader({
        bucket: cosConfig.bucket,
        region: cosConfig.region,
        prefix: normalized.prefix,
        endpoint: cosConfig.endpoint,
        secretId: cosConfig.secretId,
        secretKey: cosConfig.secretKey,
      }),
      target: normalized,
    };
  }

  async function parseCosBillTarget(target = {}) {
    const { reader, target: normalizedTarget } = cosReaderForTarget(target);
    if (normalizedTarget.objectKey) {
      return reader.parseFile(normalizedTarget.objectKey);
    }
    return reader.parseLatestFile();
  }

  async function fetchProvisionResourceMappings() {
    if (!resourceProvisionerUrl || typeof fetchImpl !== "function") return [];
    try {
      const response = await fetchImpl(new URL("/resource-mappings", resourceProvisionerUrl), {
        signal: abortSignalTimeout(resourceProvisionerTimeoutMs),
        headers: { accept: "application/json" },
      });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload?.items) ? payload.items : [];
    } catch {
      return [];
    }
  }

  async function normalizeCosBillRowsWithAttribution(parsedRows = []) {
    const rows = parsedRows.map(normalizeCosBillRow);
    if (rows.every((row) => row.attributed)) return rows;
    const mappings = await fetchProvisionResourceMappings();
    return applyResourceAttributionToRows(rows, mappings);
  }

  async function buildCosBillFilesPayload() {
    const status = buildCosBillStatus();
    try {
      const files = await cosBillReader.listFiles({ maxKeys: 50 });
      return {
        ...status,
        readable: true,
        lastReadAt: now(),
        fileCount: files.length,
        files,
      };
    } catch (error) {
      return {
        ...status,
        readable: false,
        lastReadAt: now(),
        error: String(error.message || error),
        errorStatus: error.status || null,
      };
    }
  }

  async function buildCosBillReconcilePayload(target = {}) {
    const status = buildCosBillStatus();
    try {
      const parsed = await parseCosBillTarget(target);
      const rows = await normalizeCosBillRowsWithAttribution(parsed.rows);
      const attributed = rows.filter((row) => row.attributed);
      const unattributed = rows.filter((row) => !row.attributed);
      return {
        ...status,
        ok: true,
        reconciled: false,
        preview: true,
        hasAttributableRows: attributed.length > 0,
        exactSource: "tencent_cos_daily_bill",
        lastReadAt: now(),
        latestFile: parsed.latest,
        parsedRowCount: rows.length,
        attributedCount: attributed.length,
        unattributedCount: unattributed.length,
        totalCost: Number(attributed.reduce((sum, row) => sum + Number(row.totalCost || 0), 0).toFixed(5)),
        items: attributed.slice(0, 200),
        unattributed: unattributed.slice(0, 100),
      };
    } catch (error) {
      return {
        ...status,
        ok: false,
        reconciled: false,
        lastReadAt: now(),
        error: String(error.message || error),
        errorStatus: error.status || null,
      };
    }
  }

  async function fetchCosExactSummary(customerId = "", workspaceId = "", target = {}) {
    const parsed = await parseCosBillTarget(target);
    const rows = (await normalizeCosBillRowsWithAttribution(parsed.rows)).filter((row) => row.attributed);
    return summaryFromTencentBillRows(rows.map((row) => ({
      RunId: row.runId,
      ResourceOrderId: row.resourceOrderId,
      ServerPlanId: row.serverPlanId,
      WorkspaceId: row.workspaceId,
      CustomerId: row.tenantId,
      TenantId: row.tenantId,
      RealTotalCost: row.totalCost,
      ResourceId: row.matchedResourceId || row["资源ID"] || row.ResourceId || row.InstanceId,
      Tags: {
        resource_order_id: row.resourceOrderId,
        run_id: row.runId,
        server_plan_id: row.serverPlanId,
        tenant_id: row.tenantId,
        workspace_id: row.workspaceId,
      },
    })), customerId, workspaceId);
  }

  function buildAttributionPayload(items = [], resourceOrderId = "") {
    const normalizedResourceOrderId = String(resourceOrderId || "").trim();
    const related = items.filter((item) => normalizedResourceOrderId && JSON.stringify(item || {}).includes(normalizedResourceOrderId));
    const unattributed = items.filter((item) => {
      const text = JSON.stringify(item || {});
      return !requiredCostTags.every((key) => text.includes(key));
    });
    const totalCost = related.reduce((sum, item) => sum + Number(item.totalCost || item.TotalCost || item.realTotalCost || item.RealTotalCost || 0), 0);
    return {
      ok: true,
      source: "tencent_cloud_bill_attribution",
      resourceOrderId: normalizedResourceOrderId,
      requiredTags: requiredCostTags,
      relatedCount: related.length,
      unattributedCount: unattributed.length,
      totalCost: Number(totalCost.toFixed(5)),
      items: related.slice(0, 100),
      unattributed: unattributed.slice(0, 50),
    };
  }

  async function collectAttributionItems(url) {
    if (typeof fetchExactSummary !== "function") {
      throw new Error("fetchExactSummary is required");
    }
    const customerId = String(url?.searchParams?.get("customer_id") || "").trim();
    const workspaceId = String(url?.searchParams?.get("workspace_id") || "").trim();
    const windowValue = String(url?.searchParams?.get("window") || "720h").trim() || "720h";
    const exact = await fetchExactSummary(customerId, workspaceId, windowValue);
    return [
      ...(Array.isArray(exact?.runs) ? exact.runs : []),
      ...(Array.isArray(exact?.items) ? exact.items : []),
      ...(Array.isArray(exact?.unattributed?.items) ? exact.unattributed.items : []),
    ];
  }

  return {
    buildCosBillStatus,
    normalizeCosTarget,
    cosReaderForTarget,
    parseCosBillTarget,
    fetchProvisionResourceMappings,
    normalizeCosBillRowsWithAttribution,
    buildCosBillFilesPayload,
    buildCosBillReconcilePayload,
    fetchCosExactSummary,
    buildAttributionPayload,
    collectAttributionItems,
  };
}
