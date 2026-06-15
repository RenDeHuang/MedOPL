#!/usr/bin/env node

import net from "node:net";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const allowedCommands = new Set(["preflight"]);
const command = process.argv[2] || "preflight";

function text(value = "") {
  return String(value ?? "").trim();
}

function endpointParts(endpoint = "") {
  const [host, rawPort] = text(endpoint).split(":");
  const port = Number(rawPort || "5432");
  if (!host || !Number.isInteger(port) || port <= 0) throw new Error("package_d_runner_postgres_endpoint_invalid");
  return { host, port };
}

function redact(value = "") {
  return text(value) ? "present_redacted" : "missing";
}

async function tcpProbe({ host, port, timeoutMs = 2500 }) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok, code = "") => {
      socket.destroy();
      resolve({ ok, code });
    };
    socket.setTimeout(timeoutMs, () => done(false, "timeout"));
    socket.once("connect", () => done(true, "connected"));
    socket.once("error", (error) => done(false, error?.code || "connection_error"));
  });
}

function serviceAccountNamespace() {
  return text(process.env.EXPECTED_NAMESPACE) || text(process.env.POD_NAMESPACE) || "medopl-platform";
}

async function maybeWriteEvidence(payload) {
  const sink = text(process.env.EVIDENCE_SINK);
  if (!sink || sink !== ".runtime") return "";
  const target = path.join(sink, "package-d-platform-runner", text(process.env.RUN_SCOPED_JOB_ID) || "unknown", "preflight-redacted.json");
  await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`).catch(() => {});
  return target;
}

async function main() {
  if (!allowedCommands.has(command)) throw new Error(`package_d_runner_command_forbidden:${command}`);
  const expectedNamespace = serviceAccountNamespace();
  if (expectedNamespace !== "medopl-platform") throw new Error("package_d_runner_namespace_mismatch");
  if (text(process.env.EXPECTED_SERVICE_ACCOUNT) !== "medopl-platform-runner") {
    throw new Error("package_d_runner_service_account_mismatch");
  }
  if (text(process.env.TARGET_PLATFORM_NODE_POOL_ID) !== "np-6l4nkdto") {
    throw new Error("package_d_runner_platform_pool_mismatch");
  }

  const postgresEndpoint = text(process.env.POSTGRES_ENDPOINT);
  const postgres = await tcpProbe(endpointParts(postgresEndpoint));
  const payload = {
    ok: postgres.ok,
    contract: "package_d_platform_runner_preflight",
    command,
    namespace: expectedNamespace,
    serviceAccount: "medopl-platform-runner",
    platformNodePoolId: "np-6l4nkdto",
    postgresEndpoint: postgresEndpoint === "10.66.0.21:5432" ? "10.66.0.21:5432" : "mismatch_redacted",
    postgresTcp: postgres,
    secretRefs: {
      deployEnv: redact(process.env.TENCENT_DEPLOY_CLUSTER_ID),
      portalRuntime: redact(process.env.PORTAL_ADMIN_EMAIL),
      portalPostgresPassword: redact(process.env.PORTAL_POSTGRES_PASSWORD),
      tcrSecret: "not_required_inside_running_job",
    },
    redactionAudit: {
      dbPasswordExposed: false,
      tcrSecretExposed: false,
      portalAdminPasswordExposed: false,
      clusterCredentialExposed: false,
    },
  };
  payload.evidencePath = await maybeWriteEvidence(payload);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!payload.ok) process.exit(2);
}

main().catch((error) => {
  process.stderr.write(`${String(error?.message || error)}\n`);
  process.exit(1);
});
