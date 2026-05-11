<template>
  <div class="desktop-table-shell">
    <table class="min-w-full text-sm">
      <thead>
        <tr class="table-head">
          <slot name="head"></slot>
        </tr>
      </thead>
      <tbody>
        <slot></slot>
        <tr v-if="empty">
          <td :colspan="columns" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400">
            {{ emptyText }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  empty?: boolean;
  emptyText?: string;
  columns?: number;
}>(), {
  empty: false,
  emptyText: "暂无数据",
  columns: 1,
});
</script>
