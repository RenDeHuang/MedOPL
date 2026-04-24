import { spawn, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const repo = process.cwd();
const runtime = path.join(repo, ".runtime");
fs.mkdirSync(runtime, { recursive: true });

function killPort(port) {
  try {
    const output = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`, { encoding: "utf8" });
    const pids = output.split(/\s+/).filter(Boolean).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
    for (const procId of pids) {
      try {
        process.kill(procId, "SIGTERM");
      } catch {}
    }
  } catch {}
}

killPort(19003);
killPort(3311);

const pfLog = fs.openSync(path.join(runtime, "opencost-portforward.log"), "a");
const billingLog = fs.openSync(path.join(runtime, "billing-live.log"), "a");

const pf = spawn("kubectl", ["port-forward", "-n", "opencost-system", "svc/opencost", "19003:9003"], {
  detached: true,
  stdio: ["ignore", pfLog, pfLog]
});
pf.unref();

const billing = spawn("node", ["src/server.mjs"], {
  cwd: path.join(repo, "adapters", "billing-aggregator"),
  env: { ...process.env, PORT: "3311", OPENCOST_BASE_URL: "http://127.0.0.1:19003" },
  detached: true,
  stdio: ["ignore", billingLog, billingLog]
});
billing.unref();

console.log(JSON.stringify({ ok: true, portForwardPid: pf.pid, billingPid: billing.pid }, null, 2));
