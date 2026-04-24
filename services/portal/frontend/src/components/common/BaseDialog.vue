<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div class="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 dark:border-slate-800">
          <div>
            <h2 class="text-lg font-semibold tracking-tight text-gray-950 dark:text-white">{{ title }}</h2>
            <p v-if="description" class="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">{{ description }}</p>
          </div>
          <button type="button" class="btn btn-secondary !px-3 !py-2" @click="close">关闭</button>
        </div>
        <div class="px-6 py-5">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  description?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

function close() {
  emit("update:modelValue", false);
}

watch(
  () => props.modelValue,
  (value) => {
    document.body.style.overflow = value ? "hidden" : "";
  },
  { immediate: true },
);
</script>
