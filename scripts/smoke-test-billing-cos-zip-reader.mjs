import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { buildCosBillReader } = await import(new URL("../adapters/billing-aggregator/src/cos-bill-reader.mjs", import.meta.url).href);
const runtimeRoot = path.join(repoRoot, ".runtime");

const HTTPS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3miV/zi/nVsZ9
ACR7wC7p0WxNt2IXfT5EgUmksz88wyX+GxzXFjveot2d3ltmzzMp+BKE/DURBv/R
1AjkY1/gZPgKRnzy56rHL/T0Y96g6TIa0NFZggSdvM8ItZVcUFSgup6Z6alFdpTH
3XCmJUh+fyGC3BW1BBVkmRXpFFHQ1QG1dWl5SSCXtIhJBozeMr5pQx/iehRTHyR7
2WHCj2Il7U4SEpq3IwlVnNuHH/dfNeTf6jYyPJlsqblH4gCxh0/YLXfC7GrXKHRG
o1N+FsTBxweicauiq1OZDEer1O+OJOtoz9/ukXhkuPwEXdOkegqGTo3mgvL9mDfQ
mcfthe9DAgMBAAECggEACFSrN5WwdhZpjTRwyK4GCD/4t7yxa7rCv4hU7MSMAwLL
z4WFanusyG5VZfC37v30fAawjcOFLjpGE0xEAbDsocQ9vkxH0Rxn6FUpuokUNJ2V
fhf+18k0J8AbGMcRzuLU5DIeONecVvWJd1l532AOXlxVte1XOCPGS2PoKu+WwsXu
Q9w2rF+ymILXjmPOURbm54VmhaldbXFWf738dxKYRdaAfsas5DfP112hJKIyVJlv
IGTMUH/hwGb1q3Iu4wuR0m9pKj9w02vOckdX8eP0Qhjln4FQKF+Gl0XmZ5hdjqLI
jc8rJbpN2Ug3fhXHp6v61T4EhaWb1LRPDeMCvUlzsQKBgQD7Uls6QUJdTpPYlWnT
r9eL/qmrxEEKPetVzXk0QcDt1sMqP1Om8P/XtXTWzuIPKpkrRP/R18sYNWZPJvJF
xZgAC6YHnvzHYANJJPkQPcfyg4AJyP1QrLXkR+GreZnKRkrER6eCDwT8y3+jkKm7
dfJfuHBg6F/m/ArpB4KOYWoGKQKBgQC7BRSg+lrRKB4vF+dF42Hw7HPqQWoLiMEG
60jxz0koqDqN47+GrgAt4TpPxEPZrI3w+aYP/TiFWjYt6uKdsGhzS7+hlbjohUui
CrKJZMLMjpXCJ7cEaTOmzeyuuFlK2BRN0YybUi4xxRD9OqG49QZ2J+4JUsei+q55
CdL1rvy/iwKBgCe+cmbYAyK2VnMdzcqIOFIPR82+D3sLJ7g98jjtXRE/sUVxFk2E
NzFppLyDowQ6/FX3Z21L7vY5G6DQy+d0xADd1rfF0LvG1z4t9qU23/PeD9V8T3L+
nRUouOthI4z1aMV5f2f18Bf6Jok7S1w13sp8ZGku1lu06BTJ9z+E8DthAoGBALK5
ajtkxYF4W1AaAdSSNjjtXuERXmxjZkRcebtMoteN3VdXvOLSSi2OPhGYuFa/Rm5x
xbcmAOu/iGNdQu/7c/Yq/5lF4g2jxOG4Y2JVvquJ36hKF+bJOqk/xd47ImoaEV1E
0qBkauz5LQEzFPYSgvhLtHmIeGxSMIZPUyGi9rt9AoGBAPTwTOKC6Agvcs4MSUFF
tA91d2qwEQrwUencs4ooTuXDOLQeiVcGGWfd8UG6lYI4Qhzf8RVv7RUXwqC97hbY
jEBUHI/zo8uTh30kAYsbZSn2hkjwSYy1VQGWQ47itz1F+pL3LdmV1DwvArGiFeZi
jmk9gbe7+QW0gpdfLDqt021U
-----END PRIVATE KEY-----`;

const HTTPS_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUUCBG+SG93zQXlG3T2c2EYyxzZ0EwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDUwMTA0MDkzN1oXDTI2MDUw
MjA0MDkzN1owFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAt5olf84v51bGfQAke8Au6dFsTbdiF30+RIFJpLM/PMMl
/hsc1xY73qLdnd5bZs8zKfgShPw1EQb/0dQI5GNf4GT4CkZ88ueqxy/09GPeoOky
GtDRWYIEnbzPCLWVXFBUoLqemempRXaUx91wpiVIfn8hgtwVtQQVZJkV6RRR0NUB
tXVpeUkgl7SISQaM3jK+aUMf4noUUx8ke9lhwo9iJe1OEhKatyMJVZzbhx/3XzXk
3+o2MjyZbKm5R+IAsYdP2C13wuxq1yh0RqNTfhbEwccHonGroqtTmQxHq9TvjiTr
aM/f7pF4ZLj8BF3TpHoKhk6N5oLy/Zg30JnH7YXvQwIDAQABo1MwUTAdBgNVHQ4E
FgQUU6Rr04MFCEb7fDKo3NmIdZEE5PowHwYDVR0jBBgwFoAUU6Rr04MFCEb7fDKo
3NmIdZEE5PowDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAIxVS
/oN+u1D1P4jfNy2v1GvepAStByestQ7keTSL2bJ/8aJUN9j4IMjv4SJMXBHmUL68
3ZwmRuNrP1cHqFOUuhIvGF0zu0kFW3B/IM8Z5/MrpqN9/eaMgXArGMGRg4KPjZWv
vzwS9Xemw3d46gniycn0poQiepAhz82tRoLCXv8+ZAbnX9qRQWix4N5LQtKTLym9
aEQP+j69Bkv26GsWdwzZkN1UuJjHUURIy3tNvRaquT+OSzW0piZ6+N81nZRb34WG
waud3pwu8U8q0F2BfUlawGE9rd6Fb4emlvuk0JJg1WvNKoPM7HBdzyn9td8bxZ+c
TRUu4jUvNNrJ20MYcQ==
-----END CERTIFICATE-----`;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries = []) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const bodyBuffer = Buffer.from(entry.body, "utf8");
    const compressionMethod = entry.method === "store" ? 0 : 8;
    const compressedBody = compressionMethod === 0 ? bodyBuffer : deflateRawSync(bodyBuffer);
    const checksum = crc32(bodyBuffer);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedBody.length, 18);
    localHeader.writeUInt32LE(bodyBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuffer, compressedBody]);
    localParts.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedBody.length, 20);
    centralHeader.writeUInt32LE(bodyBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(Buffer.concat([centralHeader, nameBuffer]));

    offset += localRecord.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function buildListXml(key, size) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<ListBucketResult>",
    "  <Contents>",
    `    <Key>${key}</Key>`,
    "    <LastModified>2026-05-01T04:00:00.000Z</LastModified>",
    `    <ETag>\"${createHash("md5").update(key).digest("hex")}\"</ETag>`,
    `    <Size>${size}</Size>`,
    "    <StorageClass>STANDARD</StorageClass>",
    "  </Contents>",
    "</ListBucketResult>",
  ].join("");
}

function buildListXmlFromItems(items = []) {
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<ListBucketResult>",
    ...items.map((item) => [
      "  <Contents>",
      `    <Key>${item.key}</Key>`,
      `    <LastModified>${item.lastModified}</LastModified>`,
      `    <ETag>\"${createHash("md5").update(item.key).digest("hex")}\"</ETag>`,
      `    <Size>${item.size}</Size>`,
      "    <StorageClass>STANDARD</StorageClass>",
      "  </Contents>",
    ].join("\n")),
    "</ListBucketResult>",
  ].join("\n");
}

function createMockFetch({ key, objectBody }) {
  const listXml = buildListXml(key, objectBody.length);
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/" && parsed.searchParams.get("prefix") === "daily/") {
      return new Response(listXml, { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (parsed.pathname === `/${key}`) {
      return new Response(objectBody, { status: 200, headers: { "content-type": "application/zip" } });
    }
    return new Response("not found", { status: 404 });
  };
}

async function withMockFetch(mockFetch, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`service_not_ready:${url}`);
}

async function stopServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  try {
    await Promise.race([
      once(child, "exit"),
      sleep(3000).then(() => {
        if (child.exitCode === null) child.kill("SIGKILL");
      }),
    ]);
  } catch {}
}

async function json(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  assert.equal(response.ok, true, `${url} -> ${response.status}`);
  return payload;
}

async function runZipReaderContract() {
  const billKey = "daily/cos-bill-2026-05-01.zip";
  const billZip = makeZip([{
    name: "cos-detail.csv",
    method: "deflate",
    body: [
      "resource_order_id,run_id,server_plan_id,tenant_id,workspace_id,totalCost",
      "order-zip-1,run-zip-1,plan-zip-1,tenant-zip-1,workspace-zip-1,12.34",
    ].join("\n"),
  }]);

  await withMockFetch(createMockFetch({ key: billKey, objectBody: billZip }), async () => {
    const reader = buildCosBillReader({
      bucket: "opl-1410708315",
      region: "na-siliconvalley",
      prefix: "daily/",
      endpoint: "127.0.0.1",
      secretId: "zip-reader-id",
      secretKey: "zip-reader-key",
    });
    const parsed = await reader.parseLatestFile();
    assert.equal(parsed.latest?.key, billKey);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].resource_order_id, "order-zip-1");
    assert.equal(parsed.rows[0].workspace_id, "workspace-zip-1");
  });

  await withMockFetch(async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/" && !parsed.searchParams.has("prefix")) {
      return new Response(buildListXml("root-cos-bill.zip", billZip.length), { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (parsed.pathname === "/root-cos-bill.zip") {
      return new Response(billZip, { status: 200, headers: { "content-type": "application/zip" } });
    }
    return new Response("not found", { status: 404 });
  }, async () => {
    const reader = buildCosBillReader({
      bucket: "opl-1410708315",
      region: "na-siliconvalley",
      prefix: "",
      endpoint: "127.0.0.1",
      secretId: "zip-reader-id",
      secretKey: "zip-reader-key",
    });
    assert.equal(reader.prefix, "");
    const parsed = await reader.parseLatestFile();
    assert.equal(parsed.latest?.key, "root-cos-bill.zip");
    assert.equal(parsed.rows[0].resource_order_id, "order-zip-1");
  });

  await withMockFetch(async (url) => {
    const parsed = new URL(url);
    const chineseKey = "100047070895-20260430-分账报表-明细账单.zip";
    const encodedChinesePath = `/${chineseKey.split("/").map(encodeURIComponent).join("/")}`;
    if (parsed.pathname === "/" && !parsed.searchParams.has("prefix")) {
      return new Response(buildListXml(chineseKey, billZip.length), { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (parsed.pathname === encodedChinesePath) {
      return new Response(billZip, { status: 200, headers: { "content-type": "application/zip" } });
    }
    return new Response("not found", { status: 404 });
  }, async () => {
    const reader = buildCosBillReader({
      bucket: "opl-1410708315",
      region: "na-siliconvalley",
      prefix: "",
      endpoint: "127.0.0.1",
      secretId: "zip-reader-id",
      secretKey: "zip-reader-key",
    });
    const parsed = await reader.parseLatestFile();
    assert.equal(parsed.latest?.key, "100047070895-20260430-分账报表-明细账单.zip");
    assert.equal(parsed.rows[0].resource_order_id, "order-zip-1");
  });

  const emptyZip = makeZip([]);
  await withMockFetch(createMockFetch({ key: billKey, objectBody: emptyZip }), async () => {
    const reader = buildCosBillReader({
      bucket: "opl-1410708315",
      region: "na-siliconvalley",
      prefix: "daily/",
      endpoint: "127.0.0.1",
      secretId: "zip-reader-id",
      secretKey: "zip-reader-key",
    });
    await assert.rejects(() => reader.parseLatestFile(), /cos_bill_zip_no_entries/);
  });

  const multiZip = makeZip([
    { name: "part-a.csv", method: "deflate", body: "resource_order_id,totalCost\norder-a,1.23\n" },
    { name: "part-b.csv", method: "deflate", body: "resource_order_id,totalCost\norder-b,4.56\n" },
  ]);
  await withMockFetch(createMockFetch({ key: billKey, objectBody: multiZip }), async () => {
    const reader = buildCosBillReader({
      bucket: "opl-1410708315",
      region: "na-siliconvalley",
      prefix: "daily/",
      endpoint: "127.0.0.1",
      secretId: "zip-reader-id",
      secretKey: "zip-reader-key",
    });
    await assert.rejects(() => reader.parseLatestFile(), /cos_bill_zip_multiple_entries/);
  });

  const olderKey = "daily/cos-bill-2026-05-01.zip";
  const newerKey = "daily/cos-bill-2026-05-02.zip";
  const olderZip = makeZip([{
    name: "cos-detail.csv",
    method: "deflate",
    body: [
      "resource_order_id,run_id,server_plan_id,tenant_id,workspace_id,totalCost",
      "order-older,run-older,plan-older,tenant-older,workspace-older,1.11",
    ].join("\n"),
  }]);
  const newerZip = makeZip([{
    name: "cos-detail.csv",
    method: "deflate",
    body: [
      "resource_order_id,run_id,server_plan_id,tenant_id,workspace_id,totalCost",
      "order-newer,run-newer,plan-newer,tenant-newer,workspace-newer,2.22",
    ].join("\n"),
  }]);

  await withMockFetch(async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/" && parsed.searchParams.get("prefix") === "daily/") {
      return new Response(buildListXmlFromItems([
        { key: olderKey, size: olderZip.length, lastModified: "2026-05-01T04:00:00.000Z" },
        { key: newerKey, size: newerZip.length, lastModified: "2026-05-02T04:00:00.000Z" },
      ]), { status: 200, headers: { "content-type": "application/xml" } });
    }
    if (parsed.pathname === `/${olderKey}`) {
      return new Response(olderZip, { status: 200, headers: { "content-type": "application/zip" } });
    }
    if (parsed.pathname === `/${newerKey}`) {
      return new Response(newerZip, { status: 200, headers: { "content-type": "application/zip" } });
    }
    return new Response("not found", { status: 404 });
  }, async () => {
    const reader = buildCosBillReader({
      bucket: "opl-1410708315",
      region: "na-siliconvalley",
      prefix: "daily/",
      endpoint: "127.0.0.1",
      secretId: "zip-reader-id",
      secretKey: "zip-reader-key",
    });
    const parsed = await reader.parseFile(olderKey);
    assert.equal(parsed.latest?.key, olderKey);
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].resource_order_id, "order-older");
  });
}

async function runBillingPreviewContract() {
  const cosZipKey = "100047070895-20260430-分账报表-明细账单.zip";
  const olderCosZipKey = "100047070895-20260429-分账报表-明细账单.zip";
  const olderOrderId = "order-preview-older-1";
  const olderPlanId = "plan-preview-older-1";
  const mappedCosZipKey = "100047070895-20260501-分账报表-明细账单.zip";
  const mappedOrderId = "order-preview-mapped-1";
  const mappedPlanId = "plan-preview-mapped-1";
  const mappedRunId = "run-preview-mapped-1";
  const mappedTenantId = `tenant-cos-mapped-${Date.now()}`;
  const mappedWorkspaceId = `ws-cos-mapped-${Date.now()}`;
  const csvHeaders = [
    "分账单元",
    "资源ID",
    "产品名称",
    "标签键1-N",
    "标签键:resourceorderid",
    "标签键:runid",
    "标签键:serverplanid",
    "标签键:tenantid",
    "标签键:workspaceid",
    "优惠后总价(元)",
  ];
  const billZip = makeZip([{
    name: "bill.csv",
    method: "deflate",
    body: [
      csvHeaders.join(","),
      [
        "已分配",
        "ins-preview-1",
        "COS 对象存储",
        "",
        "order-preview-1",
        "run-preview-1",
        "plan-preview-1",
        "tenant-preview-1",
        "workspace-preview-1",
        "45.67",
      ].join(","),
      [
        "未分配",
        "lhins-preview-2",
        "轻量应用服务器",
        "",
        "-",
        "-",
        "-",
        "-",
        "-",
        "12.34",
      ].join(","),
    ].join("\n"),
  }]);
  const suffix = String(Date.now());
  const tenantId = `tenant-cos-target-${suffix}`;
  const workspaceId = `ws-cos-target-${suffix}`;
  const runId = `run-cos-target-${suffix}`;
  const portalDbPath = path.join(runtimeRoot, "portal", "portal-db.json");
  const runFilePath = path.join(runtimeRoot, "med-autoscience", "runs", `${runId}.json`);
  const manifestPath = path.join(runtimeRoot, "med-autoscience", `${runId}.yaml`);
  const workspaceDir = path.join(runtimeRoot, "med-autoscience", "workspaces", tenantId, workspaceId);
  const workspaceFile = path.join(workspaceDir, "result.txt");
  const portalDbBackup = existsSync(portalDbPath) ? readFileSync(portalDbPath, "utf8") : null;
  const runFileBackup = existsSync(runFilePath) ? readFileSync(runFilePath, "utf8") : null;
  const manifestBackup = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null;
  const workspaceBackup = existsSync(workspaceFile) ? readFileSync(workspaceFile, "utf8") : null;

  const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const updatedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const olderBillZip = makeZip([{
    name: "bill.csv",
    method: "deflate",
    body: [
      csvHeaders.join(","),
      [
        "已分配",
        "ins-preview-older-1",
        "COS 对象存储",
        "",
        olderOrderId,
        runId,
        olderPlanId,
        tenantId,
        workspaceId,
        "9.99",
      ].join(","),
    ].join("\n"),
  }]);
  const mappedBillZip = makeZip([{
    name: "bill.csv",
    method: "deflate",
    body: [
      csvHeaders.join(","),
      [
        "未分配",
        "ins-preview-mapped-1",
        "云服务器 CVM",
        "",
        "-",
        "-",
        "-",
        "-",
        "-",
        "7.77",
      ].join(","),
    ].join("\n"),
  }]);
  const listXml = buildListXmlFromItems([
    { key: olderCosZipKey, size: olderBillZip.length, lastModified: "2026-04-29T04:00:00.000Z" },
    { key: cosZipKey, size: billZip.length, lastModified: "2026-04-30T04:00:00.000Z" },
    { key: mappedCosZipKey, size: mappedBillZip.length, lastModified: "2026-05-01T04:00:00.000Z" },
  ]);
  const mappingsPayload = {
    ok: true,
    items: [{
      id: "mapping-preview-mapped-1",
      tenantId: mappedTenantId,
      workspaceId: mappedWorkspaceId,
      resourceOrderId: mappedOrderId,
      runId: mappedRunId,
      serverPlanId: mappedPlanId,
      nodePoolId: "np-preview-mapped-1",
      cvmInstanceIds: ["ins-preview-mapped-1"],
      billingStartedAt: "2026-05-01T00:00:00.000Z",
      cleanupStatus: "deleted",
    }],
  };
  const cosServer = https.createServer({ key: HTTPS_KEY, cert: HTTPS_CERT }, (req, res) => {
    const url = new URL(req.url, "https://127.0.0.1");
    if (url.pathname === "/" && !url.searchParams.has("prefix")) {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(listXml);
      return;
    }
    if (url.pathname === `/${olderCosZipKey.split("/").map(encodeURIComponent).join("/")}`) {
      res.writeHead(200, { "content-type": "application/zip" });
      res.end(olderBillZip);
      return;
    }
    if (url.pathname === `/${cosZipKey.split("/").map(encodeURIComponent).join("/")}`) {
      res.writeHead(200, { "content-type": "application/zip" });
      res.end(billZip);
      return;
    }
    if (url.pathname === `/${mappedCosZipKey.split("/").map(encodeURIComponent).join("/")}`) {
      res.writeHead(200, { "content-type": "application/zip" });
      res.end(mappedBillZip);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
  const cosPort = await new Promise((resolve) => cosServer.listen(0, "127.0.0.1", () => resolve(cosServer.address().port)));
  const provisionerServer = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/resource-mappings") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(mappingsPayload));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  });
  const provisionerPort = await new Promise((resolve) => provisionerServer.listen(0, "127.0.0.1", () => resolve(provisionerServer.address().port)));
  const billingPort = 19431;
  mkdirSync(path.dirname(portalDbPath), { recursive: true });
  mkdirSync(path.dirname(runFilePath), { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });
  writeFileSync(manifestPath, [
    "apiVersion: batch/v1",
    "kind: Job",
    "spec:",
    "  template:",
    "    spec:",
    "      containers:",
    "        - name: runner",
    "          resources:",
    "            requests:",
    "              cpu: \"2\"",
  ].join("\n"), "utf8");
  writeFileSync(workspaceFile, "billing cos target smoke", "utf8");
  writeFileSync(runFilePath, JSON.stringify({
    runId,
    customerId: tenantId,
    userId: tenantId,
    workspaceId,
    manifestPath,
    createdAt,
    updatedAt,
    status: "succeeded",
    k8sStatus: {
      succeeded: true,
      conditions: [{ type: "Complete", status: "True", lastTransitionTime: updatedAt }],
    },
  }, null, 2), "utf8");
  writeFileSync(portalDbPath, JSON.stringify({
    wallets: [
      { userId: tenantId, balance: 100, updatedAt: createdAt },
      { userId: mappedTenantId, balance: 100, updatedAt: createdAt },
    ],
    ledger: [],
    resourceOrders: [{
      id: olderOrderId,
      tenantId,
      userId: tenantId,
      portalUserId: tenantId,
      workspaceId,
      runId,
      billingAccountId: tenantId,
      status: "ready",
      serverPlanId: olderPlanId,
      currency: "CNY",
      pricingSource: "tencent_cos_daily_bill",
      createdAt,
      updatedAt,
    }, {
      id: mappedOrderId,
      tenantId: mappedTenantId,
      userId: mappedTenantId,
      portalUserId: mappedTenantId,
      workspaceId: mappedWorkspaceId,
      runId: mappedRunId,
      billingAccountId: mappedTenantId,
      status: "ready",
      serverPlanId: mappedPlanId,
      currency: "CNY",
      pricingSource: "tencent_cos_daily_bill",
      createdAt,
      updatedAt,
    }],
  }, null, 2), "utf8");
  writeFileSync(path.join(runtimeRoot, "med-autoscience", "runs", `${mappedRunId}.json`), JSON.stringify({
    runId: mappedRunId,
    customerId: mappedTenantId,
    userId: mappedTenantId,
    workspaceId: mappedWorkspaceId,
    createdAt,
    updatedAt,
    status: "succeeded",
    k8sStatus: {
      succeeded: true,
      conditions: [{ type: "Complete", status: "True", lastTransitionTime: updatedAt }],
    },
  }, null, 2), "utf8");

  const billing = spawn(process.execPath, ["src/server.mjs"], {
    cwd: path.join(repoRoot, "adapters", "billing-aggregator"),
    env: {
      ...process.env,
      PORT: String(billingPort),
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
      NODE_NO_WARNINGS: "1",
      AUTO_RECONCILE_ENABLED: "0",
      PORTAL_STORAGE_MODE: "json",
      TENCENT_BILLING_ENABLED: "0",
      TENCENT_BILLING_REQUIRED: "0",
      TENCENT_PRICE_ENABLED: "0",
      TENCENT_PLAN_DISCOVERY_ENABLED: "0",
      OPENCOST_BASE_URL: "",
      SERVER_PLAN_CATALOG_JSON: "[]",
      TENCENT_COS_BILL_BUCKET: "opl-1410708315",
      TENCENT_COS_BILL_REGION: "na-siliconvalley",
      TENCENT_COS_BILL_PREFIX: "",
      TENCENT_COS_BILL_ENDPOINT: `127.0.0.1:${cosPort}`,
      TENCENT_COS_SECRET_ID: "cos-smoke-id",
      TENCENT_COS_SECRET_KEY: "cos-smoke-key",
      RESOURCE_PROVISIONER_URL: `http://127.0.0.1:${provisionerPort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let billingStdout = "";
  let billingStderr = "";
  billing.stdout.on("data", (chunk) => {
    billingStdout += String(chunk);
  });
  billing.stderr.on("data", (chunk) => {
    billingStderr += String(chunk);
  });

  try {
    await waitFor(`http://127.0.0.1:${billingPort}/healthz`);
    const files = await json(`http://127.0.0.1:${billingPort}/billing/cos/files`);
    assert.equal(files.readable, true);
    assert.equal(files.fileCount, 3);
    assert.equal(files.files?.some?.((item) => item?.key === cosZipKey), true);
    assert.equal(files.files?.some?.((item) => item?.key === olderCosZipKey), true);
    assert.equal(files.files?.some?.((item) => item?.key === mappedCosZipKey), true);

    const preview = await json(`http://127.0.0.1:${billingPort}/billing/cos/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(preview.ok, true);
    assert.equal(preview.reconciled, false);
    assert.equal(preview.preview, true);
    assert.equal(preview.hasAttributableRows, true);
    assert.equal(preview.latestFile?.key, mappedCosZipKey);
    assert.equal(preview.parsedRowCount, 1);
    assert.equal(preview.attributedCount, 1);
    assert.equal(preview.unattributedCount, 0);
    assert.equal(preview.totalCost, 7.77);
    assert.equal(preview.items?.[0]?.resourceOrderId, mappedOrderId);
    assert.equal(preview.items?.[0]?.workspaceId, mappedWorkspaceId);
    assert.equal(preview.items?.[0]?.pricingSource, "tencent_cos_daily_bill");

    const taggedPreview = await json(`http://127.0.0.1:${billingPort}/billing/cos/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectKey: cosZipKey }),
    });
    assert.equal(taggedPreview.ok, true);
    assert.equal(taggedPreview.latestFile?.key, cosZipKey);
    assert.equal(taggedPreview.parsedRowCount, 2);
    assert.equal(taggedPreview.attributedCount, 1);
    assert.equal(taggedPreview.unattributedCount, 1);
    assert.equal(taggedPreview.totalCost, 45.67);
    assert.equal(taggedPreview.items?.[0]?.resourceOrderId, "order-preview-1");
    assert.equal(taggedPreview.items?.[0]?.workspaceId, "workspace-preview-1");
    assert.equal(taggedPreview.items?.[0]?.pricingSource, "tencent_cos_daily_bill");

    const targetPreview = await json(`http://127.0.0.1:${billingPort}/billing/cos/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectKey: olderCosZipKey }),
    });
    assert.equal(targetPreview.ok, true);
    assert.equal(targetPreview.latestFile?.key, olderCosZipKey);
    assert.equal(targetPreview.parsedRowCount, 1);
    assert.equal(targetPreview.totalCost, 9.99);
    assert.equal(targetPreview.items?.[0]?.resourceOrderId, olderOrderId);

    const mappedPreview = await json(`http://127.0.0.1:${billingPort}/billing/cos/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objectKey: mappedCosZipKey }),
    });
    assert.equal(mappedPreview.ok, true);
    assert.equal(mappedPreview.latestFile?.key, mappedCosZipKey);
    assert.equal(mappedPreview.parsedRowCount, 1);
    assert.equal(mappedPreview.attributedCount, 1);
    assert.equal(mappedPreview.totalCost, 7.77);
    assert.equal(mappedPreview.items?.[0]?.resourceOrderId, mappedOrderId);
    assert.equal(mappedPreview.items?.[0]?.runId, mappedRunId);
    assert.equal(mappedPreview.items?.[0]?.attributionSource, "resource_mapping");
    assert.equal(mappedPreview.items?.[0]?.matchedResourceId, "ins-preview-mapped-1");

    const reconcile = await json(`http://127.0.0.1:${billingPort}/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: tenantId,
        workspace_id: workspaceId,
        window: "7d",
        objectKey: olderCosZipKey,
      }),
    });
    if (reconcile.exactCount !== 1) {
      throw new Error(`unexpected_reconcile_payload:${JSON.stringify(reconcile)}`);
    }
    assert.equal(reconcile.settlementMode, "exact_only");
    assert.equal(reconcile.exactCount, 1);
    assert.equal(reconcile.estimatedCount, 0);
    assert.equal(reconcile.results?.some?.((item) => item.runId === runId && item.action === "charged"), true);

    const mappedReconcile = await json(`http://127.0.0.1:${billingPort}/reconcile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customer_id: mappedTenantId,
        workspace_id: mappedWorkspaceId,
        window: "7d",
        objectKey: mappedCosZipKey,
      }),
    });
    assert.equal(mappedReconcile.settlementMode, "exact_only");
    if (mappedReconcile.exactCount !== 1) {
      throw new Error(`unexpected_mapped_reconcile_payload:${JSON.stringify(mappedReconcile)}`);
    }
    assert.equal(mappedReconcile.results?.some?.((item) => item.runId === mappedRunId && item.action === "charged"), true);
  } finally {
    await stopChild(billing);
    if (billing.exitCode && billingStdout.trim()) process.stderr.write(billingStdout);
    if (billing.exitCode && billingStderr.trim()) process.stderr.write(billingStderr);
    await stopServer(provisionerServer);
    await stopServer(cosServer);
    restoreFile(portalDbPath, portalDbBackup);
    restoreFile(runFilePath, runFileBackup);
    restoreFile(path.join(runtimeRoot, "med-autoscience", "runs", `${mappedRunId}.json`), null);
    restoreFile(manifestPath, manifestBackup);
    restoreFile(workspaceFile, workspaceBackup);
  }
}

function restoreFile(filePath, backup) {
  if (backup === null) {
    rmSync(filePath, { force: true });
    return;
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, backup, "utf8");
}

await runZipReaderContract();
await runBillingPreviewContract();

console.log("billing COS zip reader smoke passed");
