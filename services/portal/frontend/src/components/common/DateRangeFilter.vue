<template>
  <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
    <label class="text-sm text-gray-600 dark:text-slate-300">
      <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">开始日期</span>
      <input :value="from" class="input" type="date" @input="emitInput('update:from', $event)" />
    </label>
    <label class="text-sm text-gray-600 dark:text-slate-300">
      <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">结束日期</span>
      <input :value="to" class="input" type="date" @input="emitInput('update:to', $event)" />
    </label>
    <button class="btn btn-primary self-end" type="button" @click="$emit('apply')">应用</button>
    <button class="btn btn-secondary self-end" type="button" @click="$emit('reset')">重置</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  from: string;
  to: string;
}>();

const emit = defineEmits<{
  "update:from": [value: string];
  "update:to": [value: string];
  apply: [];
  reset: [];
}>();

function emitInput(eventName: "update:from" | "update:to", event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (eventName === "update:from") emit("update:from", value);
  else emit("update:to", value);
}
</script>
