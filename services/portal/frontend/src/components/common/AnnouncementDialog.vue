<template>
  <BaseDialog :model-value="modelValue" :title="title" :description="description" @update:model-value="close">
    <div class="space-y-5">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="(item, index) in pages"
          :key="item.title"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm transition"
          :class="index === currentPageIndex
            ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-900/20 dark:text-primary-300'
            : 'border-gray-200 text-gray-500 hover:border-primary-200 hover:text-primary-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-primary-500/40 dark:hover:text-primary-300'"
          @click="goTo(index)"
        >
          {{ index + 1 }}. {{ item.title }}
        </button>
      </div>

      <section v-if="currentPage" class="rounded-3xl bg-slate-50 p-5 dark:bg-slate-950/60">
        <div class="text-sm font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
          第 {{ currentPageIndex + 1 }} 页
        </div>
        <h3 class="mt-3 text-lg font-semibold text-gray-950 dark:text-white">{{ currentPage.title }}</h3>
        <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">{{ currentPage.summary }}</p>
      </section>

      <div v-if="currentPage" class="grid gap-4 md:grid-cols-2">
        <article
          v-for="section in currentPage.sections"
          :key="section.title"
          class="rounded-3xl border border-gray-100 p-5 dark:border-slate-800"
        >
          <h4 class="text-sm font-semibold text-gray-950 dark:text-white">{{ section.title }}</h4>
          <ul class="mt-3 space-y-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
            <li v-for="item in section.items" :key="item" class="flex gap-2">
              <span class="mt-1 h-1.5 w-1.5 rounded-full bg-primary-500"></span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </article>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-slate-800">
        <p class="text-sm text-gray-500 dark:text-slate-400">
          首次进入会自动显示。后续可从首页再次打开。
        </p>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn btn-secondary" :disabled="currentPageIndex === 0" @click="goTo(currentPageIndex - 1)">
            上一页
          </button>
          <button
            v-if="currentPageIndex < pages.length - 1"
            type="button"
            class="btn btn-primary"
            @click="goTo(currentPageIndex + 1)"
          >
            下一页
          </button>
          <button v-else type="button" class="btn btn-primary" @click="close(false)">
            我知道了
          </button>
        </div>
      </div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseDialog from "@/components/common/BaseDialog.vue";

interface AnnouncementSection {
  title: string;
  items: string[];
}

interface AnnouncementPage {
  title: string;
  summary: string;
  sections: AnnouncementSection[];
}

const props = defineProps<{
  modelValue: boolean;
  title: string;
  description?: string;
  page: number;
  pages: AnnouncementPage[];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "update:page", value: number): void;
}>();

const currentPageIndex = computed(() => {
  if (!props.pages.length) return 0;
  return Math.min(Math.max(props.page, 0), props.pages.length - 1);
});

const currentPage = computed(() => props.pages[currentPageIndex.value]);

function goTo(index: number) {
  emit("update:page", index);
}

function close(value = false) {
  emit("update:modelValue", value);
}
</script>
