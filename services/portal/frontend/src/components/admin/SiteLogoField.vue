<template>
  <div class="grid gap-3 md:grid-cols-[72px_1fr_auto] md:items-end">
    <div class="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <img v-if="modelValue" :src="modelValue" alt="站点 logo" class="max-h-14 max-w-14 object-contain" />
      <span v-else class="text-sm font-semibold text-gray-500 dark:text-slate-400">Logo</span>
    </div>
    <label class="text-sm text-gray-700 dark:text-slate-200">
      <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">站点 logo</span>
      <input :value="modelValue" class="input" type="url" placeholder="https://example.com/logo.png" @input="emitInput" />
    </label>
    <button class="btn btn-secondary" type="button" @click="$emit('clear')">清除</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  clear: [];
}>();

function emitInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>
