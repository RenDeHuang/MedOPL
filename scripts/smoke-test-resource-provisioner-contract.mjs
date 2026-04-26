import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 18993;
const baseUrl = `http://127.0.0.1:${port}`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return response.json();
    } catch {
      // Wait for the child process to bind the port.
    }
    await delay(100);
  }
  throw new Error("resource_provisioner_health_timeout");
}

async function postEnsureCapacity(body) {
  const response = await fetch(`${baseUrl}/resource-orders/ensure-capacity`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const child = spawn(process.execPath, ["adapters/resource-provisioner/src/server.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    RESOURCE_PROVISIONING_ENABLED: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

try {
  const health = await waitForHealth();
  assert(health.ok === true, "healthz should report ok");
  assert(health.tencent.provisioningEnabled === false, "provisioning should be disabled in this contract test");

  const schedule = await postEnsureCapacity({
    tenantId: "tenant-smoke",
    workspaceId: "workspace-smoke",
    runId: `run-${Date.now()}`,
    serverPlanId: "cpu-small",
    provisioningMode: "schedule_to_node_pool",
    serverPlan: {
      id: "cpu-small",
      provisioningMode: "schedule_to_node_pool",
      nodeSelector: { "gaofenglab/server-plan-id": "cpu-small" },
    },
  });
  assert(schedule.response.ok, `schedule_to_node_pool should not call Tencent Cloud: ${JSON.stringify(schedule.payload)}`);
  assert(schedule.payload.order?.status === "ready", "schedule order should be ready");
  assert(schedule.payload.order?.action === "schedule_to_node_pool", "schedule action should be explicit");

  const cloud = await postEnsureCapacity({
    tenantId: "tenant-smoke",
    workspaceId: "workspace-smoke",
    runId: `run-cloud-${Date.now()}`,
    serverPlanId: "gpu-nodepool",
    provisioningMode: "tke_node_pool",
    serverPlan: {
      id: "gpu-nodepool",
      provisioningMode: "tke_node_pool",
      nodePoolCreatePayload: {
        ClusterId: "cls-smoke",
        AutoScalingGroupPara: "{}",
        LaunchConfigurePara: "{}",
        InstanceAdvancedSettings: "{}",
        EnableAutoscale: true,
      },
    },
  });
  assert(cloud.response.status === 503, "cloud provisioning must stay blocked when disabled");
  assert(cloud.payload.error === "resource_provisioning_disabled", "disabled cloud provisioning should be explicit");

  console.log("resource provisioner contract smoke passed");
} finally {
  child.kill();
  await delay(100);
  if (child.exitCode && child.exitCode !== 0) {
    console.error(stdout);
    console.error(stderr);
  }
}
