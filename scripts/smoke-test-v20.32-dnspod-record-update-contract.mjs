import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseRecordSpec,
  planRecordUpdate,
} from "./update-dnspod-records.mjs";

const source = await readFile("scripts/update-dnspod-records.mjs", "utf8");

const target = parseRecordSpec("portal=A:43.173.116.127");
assert.deepEqual(target, {
  subDomain: "portal",
  recordType: "A",
  value: "43.173.116.127",
});

assert.throws(() => parseRecordSpec("www=A:43.173.116.127"), /subdomain_not_allowed:www/);
assert.throws(() => parseRecordSpec("portal=TXT:abc"), /record_type_not_allowed:TXT/);
assert.throws(() => parseRecordSpec("portal=A:999.173.116.127"), /invalid_ipv4_record_value/);

const record = {
  RecordId: 12345,
  Name: "portal",
  Type: "A",
  Value: "43.173.117.203",
  Line: "Default",
  LineId: "0",
  TTL: 600,
  Status: "ENABLE",
  MX: 0,
};

const plan = planRecordUpdate({
  domain: "medopl.cn",
  target,
  records: [record],
});
assert.equal(plan.action, "modify", "different_value_must_plan_modify");
assert.deepEqual(plan.modifyPayload, {
  Domain: "medopl.cn",
  RecordId: 12345,
  SubDomain: "portal",
  RecordType: "A",
  RecordLine: "Default",
  RecordLineId: "0",
  Value: "43.173.116.127",
  TTL: 600,
  MX: 0,
  Status: "ENABLE",
});

const noop = planRecordUpdate({
  domain: "medopl.cn",
  target,
  records: [{ ...record, Value: "43.173.116.127" }],
});
assert.equal(noop.action, "noop", "same_value_must_plan_noop");

assert.throws(
  () => planRecordUpdate({ domain: "medopl.cn", target, records: [] }),
  /record_missing:portal/,
);
assert.throws(
  () => planRecordUpdate({ domain: "medopl.cn", target, records: [record, { ...record, RecordId: 67890 }] }),
  /record_not_unique:portal:2/,
);
assert.throws(
  () => planRecordUpdate({ domain: "medopl.cn", target, records: [{ ...record, Type: "CNAME" }] }),
  /record_type_mismatch:portal:CNAME:A/,
);
assert.throws(
  () => planRecordUpdate({ domain: "medopl.cn", target, records: [{ ...record, Status: "DISABLE" }] }),
  /record_not_enabled:portal:DISABLE/,
);

assert.doesNotMatch(source, /\bCreateRecord\b/, "dnspod_update_script_must_not_create_records");
assert.doesNotMatch(source, /\bDeleteRecord\b/, "dnspod_update_script_must_not_delete_records");
assert.match(source, /\bDescribeRecordList\b/, "dnspod_update_script_must_describe_records_first");
assert.match(source, /\bModifyRecord\b/, "dnspod_update_script_must_modify_existing_records_only");
assert.match(source, /dryRun:\s*true/, "dnspod_update_script_must_default_to_dry_run");

console.log(JSON.stringify({
  ok: true,
  contract: "v20.32_dnspod_record_update_contract",
}, null, 2));
