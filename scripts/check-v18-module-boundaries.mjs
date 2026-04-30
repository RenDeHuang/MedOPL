import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const checks = [
  {
    label: "Portal must not import Tencent Cloud clients",
    command: "git",
    args: ["grep", "-nE", "from ['\\\"].*(tencent-cloud|qcloud|tencentcloud)|require\\(['\\\"].*(tencent-cloud|qcloud|tencentcloud)", "--", "services/portal/src"],
    expectNoMatches: true,
  },
  {
    label: "Gateway must not import Portal state or app internals",
    command: "git",
    args: ["grep", "-nE", "services/portal/src/(state|app)|\\.\\./\\.\\./portal/src/(state|app)", "--", "services/opl-web-gateway/src"],
    expectNoMatches: true,
  },
  {
    label: "Billing must not import Portal internals",
    command: "git",
    args: ["grep", "-nE", "services/portal/src", "--", "adapters/billing-aggregator/src"],
    expectNoMatches: true,
  },
  {
    label: "Runner must not import wallet ledger",
    command: "git",
    args: ["grep", "-nE", "wallet-ledger|appendLedgerEntry|preauth|resource_charge|makeup_charge", "--", "adapters/med-autoscience-runner/src"],
    expectNoMatches: true,
  },
];

const failures = [];
for (const check of checks) {
  const result = run(check.command, check.args);
  if (check.expectNoMatches && result.status === 0 && result.stdout.trim()) {
    failures.push(`${check.label}\n${result.stdout.trim()}`);
  } else if (result.status > 1) {
    failures.push(`${check.label}\n${result.stderr || result.stdout}`);
  }
}

if (failures.length) {
  fail(`v18 module boundary checks failed:\n\n${failures.join("\n\n")}`);
}

console.log("v18 module boundary checks passed");
