import { classifyKubectlError } from "./runner-k8s-errors.mjs";

export function buildKubectlDryRunArgs({ namespace, manifestPath }) {
  return ["apply", "-n", String(namespace || ""), "--dry-run=server", "-f", String(manifestPath || "")];
}

export async function runK8sPreflight({ kubectl, namespace, manifestPath, jobName, correlationId = "" }) {
  try {
    await kubectl(["get", "namespace", String(namespace || "")]);
  } catch (error) {
    const classified = classifyKubectlError(error, { namespace, manifestPath, jobName, correlationId });
    throw {
      ...classified,
      correlationId,
      message: "任务服务器启动失败，命名空间不可用。",
    };
  }

  try {
    const auth = await kubectl(["auth", "can-i", "create", "jobs", "-n", String(namespace || "")]);
    if (!/^yes$/i.test(String(auth?.stdout || "").trim())) {
      throw Object.assign(new Error(`rbac_denied:${String(auth?.stdout || "").trim() || "no"}`), {
        stdout: auth?.stdout || "",
        stderr: auth?.stderr || "",
      });
    }
  } catch (error) {
    const classified = classifyKubectlError(error, { namespace, manifestPath, jobName, correlationId });
    throw {
      ...classified,
      correlationId,
      message: "任务服务器启动失败，运行权限不足。",
    };
  }

  try {
    await kubectl(buildKubectlDryRunArgs({ namespace, manifestPath }));
  } catch (error) {
    const classified = classifyKubectlError(error, { namespace, manifestPath, jobName, correlationId });
    throw {
      ...classified,
      correlationId,
      message: "任务服务器启动失败，任务清单校验未通过。",
    };
  }
}
