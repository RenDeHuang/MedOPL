import { createBillingClient } from "../integrations/billing-client.mjs";
import { createHarborRegistryClient } from "../integrations/harbor-registry-client.mjs";
import { createLangfuseTraceClient } from "../integrations/langfuse-trace-client.mjs";
import { createMinioStorageClient } from "../integrations/minio-storage-client.mjs";
import { createOplAdapterClient } from "../integrations/opl-adapter-client.mjs";

export function createPortalRuntimeClients({
  billingServiceUrl,
  billingTimeoutMs,
  formatDateTime,
  harborApiUrl,
  harborPassword,
  harborUsername,
  langfuseProjectId,
  langfusePublicKey,
  langfuseSecretKey,
  langfuseUrl,
  mcBinary,
  minioApiUrl,
  oplRuntimeTimeoutMs,
  oplWebUrl,
  portalOplRuntimeAgentConfig,
  portalOplAdapterUrl,
  portalWorkdir,
  repoRoot,
  syncWorkspaceToMinioScriptRelative,
}) {
  return {
    billingClient: createBillingClient({
      billingServiceUrl,
      timeoutMs: billingTimeoutMs,
    }),
    minioStorageClient: createMinioStorageClient({
      repoRoot,
      portalWorkdir,
      mcBinary,
      minioApiUrl,
      syncWorkspaceToMinioScriptRelative,
      formatDateTime,
    }),
    harborRegistryClient: createHarborRegistryClient({
      harborApiUrl,
      username: harborUsername,
      password: harborPassword,
      formatDateTime,
    }),
    langfuseTraceClient: createLangfuseTraceClient({
      repoRoot,
      langfuseUrl,
      publicKey: langfusePublicKey,
      secretKey: langfuseSecretKey,
      projectId: langfuseProjectId,
      formatDateTime,
    }),
    oplAdapterClient: createOplAdapterClient({
      adapterUrl: portalOplAdapterUrl,
      oplWebUrl,
      runtimeAgentConfig: portalOplRuntimeAgentConfig,
      timeoutMs: oplRuntimeTimeoutMs,
      formatDateTime,
    }),
  };
}
