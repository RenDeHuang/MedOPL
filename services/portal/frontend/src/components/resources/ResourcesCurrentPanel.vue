<template>
  <section data-route-id="resources" data-component-id="resources.current" class="card p-5">
    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 class="panel-title">当前工作台资源</h2>
        <p class="panel-subtitle">普通用户只查看可用状态和费用估算。</p>
      </div>
      <span class="badge" :class="statusBadge(currentStatus)">{{ statusText(currentStatus) }}</span>
    </div>
    <div v-if="!items.length" class="empty-state mt-4">当前还没有工作台资源。</div>
    <div v-else class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="rounded-2xl border border-gray-100 p-4 dark:border-slate-700"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-gray-950 dark:text-white">{{ workspaceDisplayName(item.workspaceId) }}</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">{{ planLabel(item.computeInstance?.serverPlanId) }}</p>
          </div>
          <span class="badge" :class="statusBadge(item.status)">{{ statusText(item.status) }}</span>
        </div>
        <dl class="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div class="muted-kv">
            <dt class="muted-kv-label">计算规格</dt>
            <dd class="muted-kv-value">{{ computeSpecText(item.computeInstance) }}</dd>
          </div>
          <div class="muted-kv">
            <dt class="muted-kv-label">文件空间</dt>
            <dd class="muted-kv-value">{{ storageCapacityText(item.storageBucket) }}</dd>
          </div>
          <div class="muted-kv">
            <dt class="muted-kv-label">并发数</dt>
            <dd class="muted-kv-value">{{ concurrencyText(item.computeInstance?.serverPlanId) }}</dd>
          </div>
          <div class="muted-kv">
            <dt class="muted-kv-label">预计费用</dt>
            <dd class="muted-kv-value">{{ protectionEstimateText(item.protection) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CustomerComputeResource, CustomerStorageResource, WeeklyProtectionFreeze, WorkspaceResourceBinding } from "@/api/portal/resources";

defineProps<{
  computeSpecText: (row?: Partial<CustomerComputeResource> | null) => string;
  concurrencyText: (planId?: string) => string;
  currentStatus: string;
  items: WorkspaceResourceBinding[];
  planLabel: (planId?: string) => string;
  protectionEstimateText: (protection?: WeeklyProtectionFreeze | null) => string;
  statusBadge: (status?: string) => string;
  statusText: (status?: string) => string;
  storageCapacityText: (row?: Partial<CustomerStorageResource> | null) => string;
  workspaceDisplayName: (value?: string) => string;
}>();
</script>
