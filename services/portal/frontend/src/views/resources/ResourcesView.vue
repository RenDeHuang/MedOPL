<template>
  <AppLayout title="托管运行环境" subtitle="管理套餐、文件空间、预扣费与停止计费状态">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-gray-950 dark:text-white">资源总览</h2>
            <p class="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              OPL Lite 可直接通过工作台使用；托管运行环境会由平台代开运行能力、文件空间和后台服务，并按 freeze / preauth 管理计费。
            </p>
          </div>
          <button class="btn btn-secondary" :disabled="resourcesLoading || busy" @click="reload">刷新</button>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="当前套餐" :value="resourceSummary.bindingCount" hint="已开通的托管运行环境" />
          <MetricCard label="托管运行环境" :value="resourceSummary.computeInstanceCount" hint="平台代开的运行能力" />
          <MetricCard label="文件空间" :value="resourceSummary.storageBucketCount" hint="平台代开的结果与数据空间" />
          <MetricCard label="预扣费 / freeze / preauth" :value="money(resourceSummary.frozenAmount)" hint="已冻结" />
          <MetricCard label="消费" :value="money(resourceSummary.consumedAmount)" hint="已核算" />
          <MetricCard label="剩余可释放" :value="money(resourceSummary.remainingAmount)" hint="待释放" />
        </div>
      </section>

      <section v-if="noticeMessage" class="card p-4">
        <div class="text-sm text-emerald-700 dark:text-emerald-300">{{ noticeMessage }}</div>
      </section>

      <section v-if="errorMessage" class="card p-4">
        <div class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</div>
      </section>

      <section v-if="resourcesLoading" class="card p-5">
        <div class="text-sm text-gray-600 dark:text-slate-300">正在加载你的资源信息...</div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div class="card p-5">
          <div>
            <h2 class="text-base font-semibold text-gray-950 dark:text-white">开通运行环境</h2>
            <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">
              面向 AI 小白科研用户，只需选择套餐和运行能力。平台会代开托管运行环境并接入后台服务。
            </p>
          </div>
          <form class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" @submit.prevent="submitCreateCompute">
            <label class="space-y-2">
              <span class="text-sm text-gray-700 dark:text-slate-200">运行套餐</span>
              <input v-model.trim="computeForm.serverPlanId" class="input" placeholder="例如 opl-full-standard" />
            </label>
            <label class="space-y-2">
              <span class="text-sm text-gray-700 dark:text-slate-200">运行能力</span>
              <input v-model.trim="computeForm.instanceType" class="input" placeholder="例如 8 核 / 32 GB / GPU 1 卡" />
            </label>
            <div class="md:col-span-2 flex justify-end">
              <button class="btn btn-primary" :disabled="createComputeBusy || busy" type="submit">
                {{ createComputeBusy ? "正在开通..." : "开通运行环境" }}
              </button>
            </div>
          </form>
        </div>

        <div class="card p-5">
          <div>
            <h2 class="text-base font-semibold text-gray-950 dark:text-white">开通文件空间</h2>
            <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">
              选择存储容量即可。平台会代开隔离文件空间，供上传、运行和下载结果使用；后续扩容也从这里发起。
            </p>
          </div>
          <form class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" @submit.prevent="submitCreateStorage">
            <label class="space-y-2">
              <span class="text-sm text-gray-700 dark:text-slate-200">存储容量</span>
              <input v-model.number="storageForm.storageCapacityGb" class="input" min="1" placeholder="例如 200" type="number" />
            </label>
            <div class="md:col-span-2 flex justify-end">
              <button class="btn btn-primary" :disabled="createStorageBusy || busy" type="submit">
                {{ createStorageBusy ? "正在开通..." : "开通文件空间" }}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section class="card p-5">
        <div>
          <h2 class="text-base font-semibold text-gray-950 dark:text-white">开通运行环境</h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">
            选择工作空间、套餐与文件空间后，平台会开通托管运行环境。OPL Lite 仍可单独使用，不依赖托管运行环境。
          </p>
        </div>
        <form class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4" @submit.prevent="submitBindWorkspace">
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">工作空间</span>
            <input v-model.trim="bindForm.workspaceId" class="input" placeholder="例如 ws-demo" />
          </label>
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">运行环境</span>
            <select v-model="bindForm.computeInstanceId" class="input">
              <option value="">请选择</option>
              <option v-for="row in availableComputeOptions" :key="row.id" :value="row.id">
                {{ displayComputeLabel(row) }}
              </option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">文件空间</span>
            <select v-model="bindForm.storageBucketId" class="input">
              <option value="">请选择</option>
              <option v-for="row in availableStorageOptions" :key="row.id" :value="row.id">
                {{ displayStorageLabel(row) }}
              </option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">workspace 文件夹</span>
            <input v-model.trim="bindForm.rootPrefix" class="input" placeholder="可选，默认按工作空间自动生成" />
          </label>
          <div class="xl:col-span-4 flex justify-end">
            <button class="btn btn-primary" :disabled="bindBusy || busy" type="submit">
              {{ bindBusy ? "正在开通..." : "开通运行环境" }}
            </button>
          </div>
        </form>
      </section>

      <section class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="text-base font-semibold text-gray-950 dark:text-white">我的运行环境</div>
          <div class="text-sm text-gray-500 dark:text-slate-400">平台代开的托管运行环境，仅在运维面查看后台标识</div>
        </div>
        <div v-if="computeRows.length === 0" class="mt-3 text-sm text-gray-600 dark:text-slate-300">还没有开通运行环境。</div>
        <div v-else class="mt-3 space-y-3">
          <div
            v-for="row in computeRows"
            :key="row.id"
            class="rounded-lg border border-gray-200 p-4 dark:border-slate-700"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-sm font-medium text-gray-950 dark:text-white">{{ displayComputeLabel(row) }}</span>
                  <span class="text-sm text-gray-600 dark:text-slate-300">{{ statusText(row.status) }}</span>
                </div>
                <div class="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2">
                  <div>已开通工作空间：{{ row.workspaceRefs || "暂未开通" }}</div>
                  <div>开始计费：{{ timeText(row.billingStartedAt) }}</div>
                  <div>停止计费：{{ timeText(row.billingStoppedAt) }}</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-secondary" :disabled="deleteComputeBusyId === row.id || busy" @click="submitDeleteCompute(row.id)">
                  {{ deleteComputeBusyId === row.id ? "正在关闭..." : "关闭运行环境" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="text-base font-semibold text-gray-950 dark:text-white">我的文件空间</div>
          <div class="text-sm text-gray-500 dark:text-slate-400">上传、运行和下载结果共用的平台代开文件空间</div>
        </div>
        <div v-if="storageRows.length === 0" class="mt-3 text-sm text-gray-600 dark:text-slate-300">还没有开通文件空间。</div>
        <div v-else class="mt-3 space-y-3">
          <div
            v-for="row in storageRows"
            :key="row.id"
            class="rounded-lg border border-gray-200 p-4 dark:border-slate-700"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-sm font-medium text-gray-950 dark:text-white">{{ displayStorageLabel(row) }}</span>
                  <span class="text-sm text-gray-600 dark:text-slate-300">{{ statusText(row.status) }}</span>
                </div>
                <div class="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2">
                  <div>已开通工作空间：{{ row.workspaceRefs || "暂未开通" }}</div>
                  <div>容量：{{ storageCapacityText(row) }}</div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-secondary" :disabled="deleteStorageBusyId === row.id || busy" @click="submitDeleteStorage(row.id)">
                  {{ deleteStorageBusyId === row.id ? "正在关闭..." : "关闭文件空间" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="text-base font-semibold text-gray-950 dark:text-white">运行环境</div>
          <div class="text-sm text-gray-500 dark:text-slate-400">OPL Full Runtime 会使用这里指定的运行环境、文件空间和保护金</div>
        </div>
        <div v-if="items.length === 0" class="mt-3 text-sm text-gray-600 dark:text-slate-300">还没有开通记录，OPL Lite 仍可直接使用。</div>
        <div v-else class="mt-3 space-y-3">
          <div
            v-for="item in items"
            :key="item.resourceBindingId"
            class="rounded-lg border border-gray-200 p-4 dark:border-slate-700"
          >
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-sm font-medium text-gray-950 dark:text-white">{{ shortId(item.workspaceId) }}</span>
                  <span class="text-sm text-gray-600 dark:text-slate-300">{{ statusText(item.status) }}</span>
                </div>
                <div class="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2">
                  <div>运行环境：{{ displayComputeLabel(item.computeInstance || item.computeInstances[0]) || shortId(item.computeInstanceId) }}</div>
                  <div>文件空间：{{ displayStorageLabel(item.storageBucket || item.storageBuckets[0]) || shortId(item.storageBucketId) }}</div>
                  <div class="md:col-span-2">workspace 文件夹：{{ item.rootPrefix || "-" }}</div>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-300 lg:grid-cols-5">
                  <div class="rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800">OPL Lite：{{ allowText(item.bindingAccess.oplLite.allowed) }}</div>
                  <div class="rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800">托管运行环境：{{ allowText(item.bindingAccess.fullRuntime.allowed) }}</div>
                  <div class="rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800">上传文件：{{ allowText(item.bindingAccess.workspaceFiles.allowed) }}</div>
                  <div class="rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800">运行任务：{{ allowText(item.bindingAccess.workspaceTasks.allowed) }}</div>
                  <div class="rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800">下载结果：{{ allowText(item.bindingAccess.workspaceOutputs.allowed) }}</div>
                </div>
                <div v-if="item.protection" class="mt-3 rounded-lg bg-gray-50 p-4 dark:bg-slate-800/80">
                  <div class="grid grid-cols-1 gap-2 text-sm text-gray-700 dark:text-slate-200 md:grid-cols-2 xl:grid-cols-5">
                    <div>已冻结：{{ money(item.protection.frozenAmount) }}</div>
                    <div>已消耗：{{ money(item.protection.consumedAmount) }}</div>
                    <div>剩余：{{ money(item.protection.remainingAmount) }}</div>
                    <div>两小时核对：{{ auditStatusText(item.protection.reconcile120MinStatus) }}</div>
                    <div>次日审计：{{ auditStatusText(item.protection.tPlus1AuditStatus) }}</div>
                  </div>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-secondary" :disabled="ensureFreezeBusyId === item.id || busy" @click="seedFreezeForm(item)">
                  填入本周保护金
                </button>
                <button
                  class="btn btn-secondary"
                  :disabled="unbindBusyId === item.id || busy || item.status !== 'active'"
                  @click="submitUnbind(item.id)"
                >
                  {{ unbindBusyId === item.id ? "正在关闭..." : "关闭运行环境" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="text-base font-semibold text-gray-950 dark:text-white">设置本周保护金</div>
            <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">
              托管运行环境启动前，需要先设置 freeze / preauth。系统会在两小时核对和次日审计后按实际用量结算。
            </p>
          </div>
          <div class="text-sm text-gray-500 dark:text-slate-400">停止计费已确认 {{ money(resourceSummary.releasedProtectionAmount) }}</div>
        </div>
        <form class="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-5" @submit.prevent="submitEnsureProtectionFreeze">
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">运行环境</span>
            <select v-model="freezeForm.bindingId" class="input">
              <option value="">请选择</option>
              <option v-for="item in activeBindings" :key="item.id" :value="item.id">
                {{ item.workspaceId }} / {{ displayComputeLabel(item.computeInstance || item.computeInstances[0]) || shortId(item.computeInstanceId) }}
              </option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">本周预计金额</span>
            <input v-model.number="freezeForm.weeklyAmount" class="input" min="0" placeholder="例如 70" type="number" />
          </label>
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">窗口开始</span>
            <input v-model="freezeForm.windowStartAt" class="input" type="datetime-local" />
          </label>
          <label class="space-y-2">
            <span class="text-sm text-gray-700 dark:text-slate-200">窗口结束</span>
            <input v-model="freezeForm.windowEndAt" class="input" type="datetime-local" />
          </label>
          <div class="flex items-end justify-end">
            <button class="btn btn-primary" :disabled="ensureFreezeBusy || busy" type="submit">
              {{ ensureFreezeBusy ? "正在设置..." : "设置本周保护金" }}
            </button>
          </div>
        </form>

        <div v-if="protectionRows.length === 0" class="mt-4 text-sm text-gray-600 dark:text-slate-300">还没有本周保护金记录。</div>
        <div v-else class="mt-4 space-y-3">
          <div
            v-for="row in protectionRows"
            :key="row.id"
            class="rounded-lg border border-gray-200 p-4 dark:border-slate-700"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span class="text-sm font-medium text-gray-950 dark:text-white">{{ shortId(row.workspaceId) }}</span>
              <span class="text-sm text-gray-600 dark:text-slate-300">{{ statusText(row.status) }}</span>
            </div>
            <div class="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2 xl:grid-cols-4">
              <div>已冻结：{{ money(row.frozenAmount) }}</div>
              <div>已消耗：{{ money(row.consumedAmount) }}</div>
              <div>剩余：{{ money(row.remainingAmount) }}</div>
              <div>已释放：{{ money(row.releasedAmount) }}</div>
              <div>两小时核对：{{ auditStatusText(row.reconcile120MinStatus) }}</div>
              <div>次日审计：{{ auditStatusText(row.tPlus1AuditStatus) }}</div>
              <div>窗口开始：{{ timeText(row.windowStartAt) }}</div>
              <div>窗口结束：{{ timeText(row.windowEndAt) }}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import MetricCard from "@/components/common/MetricCard.vue";
import {
  bindWorkspaceResource,
  createComputeInstance,
  createStorageBucket,
  deleteComputeInstance,
  deleteStorageBucket,
  ensureProtectionFreeze,
  fetchMyResources,
  unbindWorkspaceResource,
  type CustomerComputeResource,
  type PlatformProvisionedResourcesPayload,
  type CustomerStorageResource,
  type WeeklyProtectionFreeze,
  type WorkspaceResourceBinding,
} from "@/api/portal";

type ComputeFormState = {
  serverPlanId: string;
  instanceType: string;
};

type StorageFormState = {
  storageCapacityGb: number | null;
};

type BindFormState = {
  workspaceId: string;
  computeInstanceId: string;
  storageBucketId: string;
  rootPrefix: string;
};

type FreezeFormState = {
  bindingId: string;
  weeklyAmount: number | null;
  windowStartAt: string;
  windowEndAt: string;
};

const resourcesLoading = ref(false);
const errorMessage = ref("");
const noticeMessage = ref("");
const payload = ref<PlatformProvisionedResourcesPayload | null>(null);

const createComputeBusy = ref(false);
const createStorageBusy = ref(false);
const bindBusy = ref(false);
const ensureFreezeBusy = ref(false);
const ensureFreezeBusyId = ref("");
const unbindBusyId = ref("");
const deleteComputeBusyId = ref("");
const deleteStorageBusyId = ref("");

const computeForm = reactive<ComputeFormState>({
  serverPlanId: "",
  instanceType: "",
});

const storageForm = reactive<StorageFormState>({
  storageCapacityGb: null,
});

const bindForm = reactive<BindFormState>({
  workspaceId: "",
  computeInstanceId: "",
  storageBucketId: "",
  rootPrefix: "",
});

const freezeForm = reactive<FreezeFormState>({
  bindingId: "",
  weeklyAmount: null,
  windowStartAt: "",
  windowEndAt: "",
});

const items = computed<WorkspaceResourceBinding[]>(() => payload.value?.items || []);
const activeBindings = computed<WorkspaceResourceBinding[]>(() => items.value.filter((item) => item.status === "active"));
const protectionRows = computed<WeeklyProtectionFreeze[]>(() => payload.value?.protectionFreezes || []);
const resourceSummary = computed(() => payload.value?.summary || {
  computeInstances: 0,
  storageBuckets: 0,
  activeBindings: 0,
  inactiveBindings: 0,
  activeProtectionFreezes: 0,
  frozenAmount: 0,
  consumedAmount: 0,
  remainingAmount: 0,
  releasedProtectionAmount: 0,
  computeInstanceCount: 0,
  storageBucketCount: 0,
  bindingCount: 0,
  protectionFreezeCount: 0,
});

const workspaceRefsByComputeId = computed(() => {
  const refs = new Map<string, string[]>();
  for (const item of items.value) {
    const key = String(item.computeInstanceId || "").trim();
    if (!key) continue;
    const list = refs.get(key) || [];
    list.push(shortId(item.workspaceId));
    refs.set(key, list);
  }
  return refs;
});

const workspaceRefsByStorageId = computed(() => {
  const refs = new Map<string, string[]>();
  for (const item of items.value) {
    const key = String(item.storageBucketId || "").trim();
    if (!key) continue;
    const list = refs.get(key) || [];
    list.push(shortId(item.workspaceId));
    refs.set(key, list);
  }
  return refs;
});

const computeRows = computed(() =>
  (payload.value?.computeInstances || []).map((instance) => ({
    ...instance,
    workspaceRefs: (workspaceRefsByComputeId.value.get(instance.id) || []).join(" / "),
  })),
);

const storageRows = computed(() =>
  (payload.value?.storageBuckets || []).map((bucket) => ({
    ...bucket,
    workspaceRefs: (workspaceRefsByStorageId.value.get(bucket.id) || []).join(" / "),
  })),
);

const availableComputeOptions = computed(() =>
  computeRows.value.filter((item) => item.status !== "deleted"),
);

const availableStorageOptions = computed(() =>
  storageRows.value.filter((item) => item.status !== "deleted"),
);

const busy = computed(() =>
  createComputeBusy.value
  || createStorageBusy.value
  || bindBusy.value
  || ensureFreezeBusy.value
  || Boolean(ensureFreezeBusyId.value)
  || Boolean(unbindBusyId.value)
  || Boolean(deleteComputeBusyId.value)
  || Boolean(deleteStorageBusyId.value),
);

function money(value: number | undefined) {
  return `CNY ${Number(value || 0).toFixed(2)}`;
}

function shortId(value?: string) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > 16 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function timeText(value?: string) {
  return String(value || "").trim() || "-";
}

function allowText(value: boolean) {
  return value ? "可用" : "不可用";
}

function statusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    active: "已启用",
    inactive: "已解绑",
    deleted: "已删除",
    released: "已释放",
    pending: "待处理",
    done: "已完成",
    matched: "已核对",
    skipped: "已跳过",
  };
  return labels[normalized] || status || "-";
}

function auditStatusText(status?: string) {
  const normalized = String(status || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    pending: "待处理",
    done: "已完成",
    matched: "已核对",
    released: "已释放",
    skipped: "已跳过",
  };
  return labels[normalized] || status || "-";
}

function displayComputeLabel(row?: Partial<CustomerComputeResource> | null) {
  if (!row) return "";
  const parts = [String(row.serverPlanId || "").trim(), String(row.instanceType || "").trim()].filter(Boolean);
  return parts.join(" / ");
}

function displayStorageLabel(row?: Partial<CustomerStorageResource> | null) {
  if (!row) return "";
  const capacity = storageCapacityText(row);
  const parts = [String(row.storagePlanId || "").trim(), capacity].filter(Boolean);
  return parts.join(" / ");
}

function storageCapacityText(row?: Partial<CustomerStorageResource> | null) {
  const value = Number(row?.storageCapacityGb || 0);
  return value > 0 ? `${value} GB` : "容量待确认";
}

function resetFeedback() {
  errorMessage.value = "";
  noticeMessage.value = "";
}

function reportError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  errorMessage.value = message;
}

function resetComputeForm() {
  computeForm.serverPlanId = "";
  computeForm.instanceType = "";
}

function resetStorageForm() {
  storageForm.storageCapacityGb = null;
}

function resetBindForm() {
  bindForm.workspaceId = "";
  bindForm.computeInstanceId = "";
  bindForm.storageBucketId = "";
  bindForm.rootPrefix = "";
}

function defaultWeeklyWindowStart() {
  const now = new Date();
  now.setSeconds(0, 0);
  return toLocalInputValue(now);
}

function defaultWeeklyWindowEnd() {
  const end = new Date();
  end.setDate(end.getDate() + 7);
  end.setSeconds(0, 0);
  return toLocalInputValue(end);
}

function resetFreezeForm() {
  freezeForm.bindingId = "";
  freezeForm.weeklyAmount = null;
  freezeForm.windowStartAt = defaultWeeklyWindowStart();
  freezeForm.windowEndAt = defaultWeeklyWindowEnd();
}

function toLocalInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoString(value: string) {
  const text = String(value || "").trim();
  return text ? new Date(text).toISOString() : "";
}

function seedFreezeForm(item: WorkspaceResourceBinding) {
  freezeForm.bindingId = item.id;
  if (typeof item.protection?.weeklyAmount === "number" && item.protection.weeklyAmount > 0) {
    freezeForm.weeklyAmount = item.protection.weeklyAmount;
  }
  if (item.protection?.windowStartAt) {
    freezeForm.windowStartAt = toLocalInputValue(new Date(item.protection.windowStartAt));
  }
  if (item.protection?.windowEndAt) {
    freezeForm.windowEndAt = toLocalInputValue(new Date(item.protection.windowEndAt));
  }
}

function requireField(value: string, message: string) {
  if (!String(value || "").trim()) {
    throw new Error(message);
  }
}

function requirePositiveNumber(value: number | null, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(message);
  }
  return value;
}

async function reload() {
  resourcesLoading.value = true;
  try {
    payload.value = await fetchMyResources();
  } catch (error) {
    reportError(error, "加载资源失败");
  } finally {
    resourcesLoading.value = false;
  }
}

async function submitCreateCompute() {
  resetFeedback();
  try {
    requireField(computeForm.serverPlanId, "请填写运行套餐");
    requireField(computeForm.instanceType, "请填写计算能力");
    createComputeBusy.value = true;
    const result = await createComputeInstance({
      serverPlanId: computeForm.serverPlanId,
      instanceType: computeForm.instanceType,
    });
    await reload();
    resetComputeForm();
    noticeMessage.value = `已开通运行环境 ${displayComputeLabel(result.item) || computeForm.serverPlanId}`;
  } catch (error) {
    reportError(error, "开通运行环境失败");
  } finally {
    createComputeBusy.value = false;
  }
}

async function submitCreateStorage() {
  resetFeedback();
  try {
    const storageCapacityGb = requirePositiveNumber(storageForm.storageCapacityGb, "请填写大于 0 的存储容量");
    createStorageBusy.value = true;
    const result = await createStorageBucket({
      storageCapacityGb,
    });
    await reload();
    resetStorageForm();
    noticeMessage.value = `已开通文件空间 ${result.item?.storageCapacityGb || storageCapacityGb} GB`;
  } catch (error) {
    reportError(error, "开通文件空间失败");
  } finally {
    createStorageBusy.value = false;
  }
}

async function submitBindWorkspace() {
  resetFeedback();
  try {
    requireField(bindForm.workspaceId, "请填写工作空间");
    requireField(bindForm.computeInstanceId, "请选择运行环境");
    requireField(bindForm.storageBucketId, "请选择文件空间");
    bindBusy.value = true;
    await bindWorkspaceResource({
      workspaceId: bindForm.workspaceId,
      computeInstanceId: bindForm.computeInstanceId,
      storageBucketId: bindForm.storageBucketId,
      rootPrefix: bindForm.rootPrefix,
    });
    await reload();
    noticeMessage.value = `工作空间 ${bindForm.workspaceId} 已开通运行环境`;
    resetBindForm();
  } catch (error) {
    reportError(error, "开通运行环境失败");
  } finally {
    bindBusy.value = false;
  }
}

async function submitUnbind(bindingId: string) {
  resetFeedback();
  unbindBusyId.value = bindingId;
  try {
    await unbindWorkspaceResource(bindingId);
    await reload();
    noticeMessage.value = "运行环境已关闭";
  } catch (error) {
    reportError(error, "关闭运行环境失败");
  } finally {
    unbindBusyId.value = "";
  }
}

async function submitDeleteCompute(computeInstanceId: string) {
  resetFeedback();
  deleteComputeBusyId.value = computeInstanceId;
  try {
    await deleteComputeInstance(computeInstanceId);
    await reload();
    noticeMessage.value = "运行环境已关闭，相关运行环境已同步停用";
  } catch (error) {
    reportError(error, "关闭运行环境失败");
  } finally {
    deleteComputeBusyId.value = "";
  }
}

async function submitDeleteStorage(storageBucketId: string) {
  resetFeedback();
  deleteStorageBusyId.value = storageBucketId;
  try {
    await deleteStorageBucket(storageBucketId);
    await reload();
    noticeMessage.value = "文件空间已关闭，相关运行环境已同步停用";
  } catch (error) {
    reportError(error, "关闭文件空间失败");
  } finally {
    deleteStorageBusyId.value = "";
  }
}

async function submitEnsureProtectionFreeze() {
  resetFeedback();
  try {
    requireField(freezeForm.bindingId, "请选择运行环境");
    const weeklyAmount = requirePositiveNumber(freezeForm.weeklyAmount, "请填写大于 0 的本周预计金额");
    requireField(freezeForm.windowStartAt, "请填写窗口开始时间");
    requireField(freezeForm.windowEndAt, "请填写窗口结束时间");
    ensureFreezeBusy.value = true;
    ensureFreezeBusyId.value = freezeForm.bindingId;
    const result = await ensureProtectionFreeze({
      bindingId: freezeForm.bindingId,
      weeklyAmount,
      windowStartAt: toIsoString(freezeForm.windowStartAt),
      windowEndAt: toIsoString(freezeForm.windowEndAt),
      usageMode: "full_runtime",
    });
    await reload();
    noticeMessage.value = result.created ? "本周保护金已设置" : "本周保护金已更新";
  } catch (error) {
    reportError(error, "设置本周保护金失败");
  } finally {
    ensureFreezeBusy.value = false;
    ensureFreezeBusyId.value = "";
  }
}

onMounted(async () => {
  resetFreezeForm();
  await reload();
});
</script>
