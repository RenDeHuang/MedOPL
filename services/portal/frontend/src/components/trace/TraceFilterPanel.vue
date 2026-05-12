<template>
  <section data-route-id="trace" data-component-id="trace.filter" class="card p-5">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h2 class="panel-title">筛选</h2>
        <p class="panel-subtitle">用户侧只返回当前账号可见的运行轨迹。</p>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <input :value="filters.workspaceId" class="input" type="text" placeholder="工作空间" @input="updateFilter('workspaceId', $event)" />
        <input :value="filters.sessionId" class="input" type="text" placeholder="会话" @input="updateFilter('sessionId', $event)" />
        <select :value="filters.status" class="input" @change="updateFilter('status', $event)">
          <option value="">全部状态</option>
          <option value="active">运行中</option>
          <option value="running">运行中</option>
          <option value="completed">已完成</option>
          <option value="failed">失败</option>
          <option value="released">已释放</option>
          <option value="settled">已结算</option>
        </select>
      </div>
    </div>
    <div class="mt-3 flex gap-2">
      <button class="btn btn-primary" type="button" @click="$emit('apply')">应用筛选</button>
      <button class="btn btn-secondary" type="button" @click="$emit('reset')">重置</button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  filters: {
    workspaceId: string;
    sessionId: string;
    status: string;
  };
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
  updateFilter: [key: "workspaceId" | "sessionId" | "status", value: string];
}>();

function updateFilter(key: "workspaceId" | "sessionId" | "status", event: Event) {
  emit("updateFilter", key, (event.target as HTMLInputElement | HTMLSelectElement).value.trim());
}
</script>
