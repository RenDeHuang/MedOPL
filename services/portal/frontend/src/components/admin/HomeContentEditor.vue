<template>
  <label class="block text-sm text-gray-700 dark:text-slate-200">
    <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">首页内容</span>
    <textarea
      :value="modelValue"
      class="input font-mono"
      rows="12"
      placeholder="留空显示默认 OPL 介绍页；填写 URL 显示 iframe；填写 HTML 显示自定义页面。"
      @input="emitInput"
    ></textarea>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function emitInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
</script>
