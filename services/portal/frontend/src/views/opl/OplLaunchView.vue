<template>
  <AppLayout title="OPL 科研工作台" subtitle="正在准备工作空间和 OPL 会话">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <span class="badge" :class="statusBadge">{{ statusLabel }}</span>
            <h2 class="mt-3 text-xl font-semibold text-gray-950 dark:text-white">{{ status?.userVisibleState || "正在准备工作空间" }}</h2>
            <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">
              保持此页面打开，准备完成后会自动进入 opl.medopl.cn 的 OPL 科研工作台。
            </p>
          </div>
          <RouterLink class="btn btn-secondary" to="/workspace">返回工作空间</RouterLink>
        </div>
      </section>

      <section class="card p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="panel-title">gflabtoken 模型调用密钥状态</h2>
            <p class="panel-subtitle">
              MedOPL 账号密码与 OPL Web 账号密码统一。Portal 只展示 gflabtoken 模型调用密钥已绑定/未绑定状态，不在 Portal 普通登录表单提供输入入口。
            </p>
          </div>
          <span class="badge badge-primary">进入 OPL 工作台</span>
        </div>
      </section>

      <section class="card p-5">
        <div class="space-y-3">
          <div
            v-for="stage in orderedStages"
            :key="stage.stage"
            class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-slate-700"
          >
            <div>
              <div class="font-medium text-gray-950 dark:text-white">{{ stageLabel(stage.stage) }}</div>
              <div class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ stage.userVisibleState }}</div>
            </div>
            <span class="badge" :class="stageBadge(stage)">{{ stage.ok ? "进行中" : "需处理" }}</span>
          </div>
        </div>
      </section>

      <section v-if="errorMessage" class="card p-4">
        <div class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import { fetchOplLaunchStatus, type OplLaunchStatusPayload } from "@/api/portal/resources";

const route = useRoute();
const status = ref<OplLaunchStatusPayload | null>(null);
const errorMessage = ref("");
let stopped = false;

const stageOrder = ["workspace_ready", "provider_key_bound", "session_created", "gateway_ready", "opl_opening"];
const orderedStages = computed(() => {
  const stages = status.value?.stages || [];
  return stageOrder.map((stage) =>
    stages.find((item) => item.stage === stage) || {
      stage,
      ok: true,
      blockingUser: false,
      userVisibleState: stageLabel(stage),
      startedAt: "",
      endedAt: "",
      latencyMs: 0,
    },
  );
});

const statusLabel = computed(() => {
  if (status.value?.status === "ready") return "准备完成";
  if (status.value?.status === "failed") return "准备失败";
  return "准备中";
});
const statusBadge = computed(() => {
  if (status.value?.status === "ready") return "badge-success";
  if (status.value?.status === "failed") return "badge-danger";
  return "badge-primary";
});

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    workspace_ready: "准备工作空间",
    provider_key_bound: "确认 gflabtoken 模型调用密钥已绑定",
    session_created: "创建 OPL 会话",
    gateway_ready: "确认 OPL 网关",
    opl_opening: "打开 OPL",
  };
  return labels[stage] || stage;
}

function stageBadge(stage: { stage: string; ok: boolean }) {
  if (!stage.ok) return "badge-danger";
  if (status.value?.currentStage === stage.stage) return "badge-primary";
  return "badge-success";
}

async function loadStatus() {
  const launchId = String(route.query.launchId || "");
  if (!launchId) {
    errorMessage.value = "未找到 OPL 启动信息，请从工作空间重新进入。";
    return;
  }
  try {
    const next = await fetchOplLaunchStatus(launchId);
    status.value = next;
    if (next.status === "ready" && next.oplWebUrl) {
      window.location.assign(status.value.oplWebUrl);
      return;
    }
    if (next.status === "failed") {
      errorMessage.value = next.message || "OPL 准备失败，请稍后重试。";
      return;
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "OPL 状态读取失败";
    return;
  }
  if (!stopped) {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => void loadStatus(), 800);
    });
  }
}

onMounted(() => {
  void loadStatus();
});

onUnmounted(() => {
  stopped = true;
});
</script>
