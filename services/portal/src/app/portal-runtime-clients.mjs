import { createHarborRegistryClient } from "../integrations/harbor-registry-client.mjs";
import { createLangfuseTraceClient } from "../integrations/langfuse-trace-client.mjs";
import { createMinioStorageClient } from "../integrations/minio-storage-client.mjs";
import { createRuntimeBridgeClient } from "../integrations/runtime-bridge-client.mjs";

export function createPortalRuntimeClients({
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
  portalRuntimeBridgeUrl,
  portalWorkdir,
  repoRoot,
}) {
  return {
    minioStorageClient: createMinioStorageClient({
      repoRoot,
      portalWorkdir,
      mcBinary,
      minioApiUrl,
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
    runtimeBridgeClient: createRuntimeBridgeClient({
      runtimeBridgeUrl: portalRuntimeBridgeUrl,
      oplWebUrl,
      runtimeAgentConfig: portalOplRuntimeAgentConfig,
      timeoutMs: oplRuntimeTimeoutMs,
      formatDateTime,
    }),
  };
}
