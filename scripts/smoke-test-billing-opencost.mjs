import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = "C:/Users/Administrator/Desktop/平台搭建";
const offset = Math.floor(Math.random() * 1000);
const opencostPort = String(19000 + offset);
const billingPort = String(3300 + offset);

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
}

const portForward = startProcess("kubectl", [
  "port-forward",
  "-n",
  "opencost-system",
  "svc/opencost",
  `${opencostPort}:9003`
]);

const billing = startProcess("node", ["src/server.mjs"], {
  cwd: `${repoRoot}/adapters/billing-aggregator`,
  env: {
    ...process.env,
    PORT: billingPort,
    OPENCOST_BASE_URL: `http://127.0.0.1:${opencostPort}`
  }
});

try {
  await sleep(4000);

  const response = await fetch(`http://127.0.0.1:${billingPort}/billing?window=1h`, {
    headers: { accept: "application/json" }
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`billing request failed: ${response.status} ${JSON.stringify(body)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    itemCount: body.itemCount,
    totals: body.totals
  }, null, 2));
} finally {
  billing.kill("SIGTERM");
  portForward.kill("SIGTERM");
}
