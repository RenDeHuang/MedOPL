import http from "node:http";
import { fileURLToPath } from "node:url";
import { createCloudProvisionerService } from "./cloud-provisioner-domain.mjs";
import { createCloudProvisionerHttpHandler } from "./cloud-provisioner-http.mjs";
import { createConfiguredProvider } from "./cloud-provisioner-provider.mjs";

export function createCloudProvisionerServer({ env = process.env, provider } = {}) {
  const service = createCloudProvisionerService({
    provider: provider || createConfiguredProvider({ env }),
  });
  return http.createServer(createCloudProvisionerHttpHandler({ service }));
}

function isMainModule() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMainModule()) {
  const port = Number(process.env.PORT || 8096);
  const server = createCloudProvisionerServer();
  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`cloud-provisioner listening on ${port}\n`);
  });
}
