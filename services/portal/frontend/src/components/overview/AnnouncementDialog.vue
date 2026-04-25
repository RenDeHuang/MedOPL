<template>
  <BaseDialog
    :model-value="modelValue"
    title="MAS 使用公告"
    description="首次使用前，请先确认入口、上传建议、结果查看方式与计费口径。"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-6">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(page, index) in pages"
          :key="page.title"
          type="button"
          class="rounded-full px-3 py-1.5 text-sm font-medium transition"
          :class="index === currentPage ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'"
          @click="currentPage = index"
        >
          {{ index + 1 }}. {{ page.nav }}
        </button>
      </div>

      <section class="space-y-4">
        <div>
          <h3 class="text-xl font-semibold text-gray-950 dark:text-white">{{ activePage.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{{ activePage.description }}</p>
        </div>

        <div v-if="currentPage === 0" class="grid gap-4 md:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div class="text-sm font-semibold text-gray-950 dark:text-white">MAS 普通对话</div>
            <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">适合直接提问，不绑定任务空间，不生成 workspace 文件结果。</p>
          </div>
          <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div class="text-sm font-semibold text-gray-950 dark:text-white">MAS 任务空间</div>
            <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">适合上传文件、持续处理同一主题，并生成可下载的结果文件。</p>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300 md:col-span-2">
            <div class="font-semibold text-gray-950 dark:text-white">MAS 是什么</div>
            <p class="mt-2">MAS 是统一入口，用于启动普通对话与任务空间工作流。产品名必须保留为 MAS，不替换为其他主名称。</p>
          </div>
        </div>

        <div v-else-if="currentPage === 1" class="space-y-4">
          <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div class="text-sm font-semibold text-gray-950 dark:text-white">推荐上传</div>
            <ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-500 dark:text-slate-400">
              <li>任务说明文档：TXT、Markdown、Word 导出文本。</li>
              <li>数据表：CSV、TSV、表格导出文本。</li>
              <li>已有结果：分析结果表、汇总表、指标导出。</li>
              <li>日志与说明：运行日志、研究笔记、会议纪要。</li>
            </ul>
          </div>
          <div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <div class="text-sm font-semibold text-amber-900 dark:text-amber-200">暂不推荐首批上传</div>
            <ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-800 dark:text-amber-100/85">
              <li>纯图片。</li>
              <li>无说明的压缩包。</li>
              <li>大量二进制原始文件。</li>
            </ul>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <div class="text-sm font-semibold text-gray-950 dark:text-white">第一句话模板</div>
            <div class="mt-3 space-y-3">
              <div
                v-for="template in templates"
                :key="template"
                class="rounded-2xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {{ template }}
              </div>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div class="text-sm font-semibold text-gray-950 dark:text-white">聊天结果</div>
              <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">聊天区显示助手回复，用于给出结论、建议与下一步动作。</p>
            </div>
            <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div class="text-sm font-semibold text-gray-950 dark:text-white">文件结果</div>
              <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">任务空间或 OPL Web 的输出结果区显示可下载文件。</p>
            </div>
          </div>
          <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div class="text-sm font-semibold text-gray-950 dark:text-white">计费口径</div>
            <ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-500 dark:text-slate-400">
              <li>普通对话不计资源费。</li>
              <li>MAS 任务空间按运行资源收费。</li>
              <li>自带模型 API 不单独计 token 费用。</li>
            </ul>
          </div>
          <div class="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            开始前请先确认：结果分为会话结论与文件结果两类；文件结果可在任务空间或 OPL Web 的输出结果入口查看和下载。
          </div>
        </div>
      </section>

      <div class="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <button type="button" class="btn btn-secondary" :disabled="currentPage === 0" @click="currentPage -= 1">上一页</button>
        <div class="text-xs text-slate-500 dark:text-slate-400">第 {{ currentPage + 1 }} / {{ pages.length }} 页</div>
        <button
          v-if="currentPage < pages.length - 1"
          type="button"
          class="btn btn-primary"
          @click="currentPage += 1"
        >
          下一页
        </button>
        <button v-else type="button" class="btn btn-primary" @click="emit('update:modelValue', false)">我已了解</button>
      </div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseDialog from "@/components/common/BaseDialog.vue";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const currentPage = ref(0);

const pages = [
  {
    nav: "入口说明",
    title: "MAS 入口与使用边界",
    description: "先区分普通对话与任务空间，再选择合适入口开始工作。",
  },
  {
    nav: "上传与提问",
    title: "上传建议与起手模板",
    description: "优先上传可解释的文本、表格和已有结果；使用模板可以显著提高首次成功率。",
  },
  {
    nav: "结果与费用",
    title: "结果查看方式与计费口径",
    description: "开始前先确认结果会出现在哪里，以及不同入口的计费逻辑。",
  },
] as const;

const templates = [
  "我上传了一份结直肠癌数据，请帮我找到一个值得继续研究的问题，并告诉我下一步应该补什么证据。",
  "我已经有初步分析结果，请帮我整理成一条清晰的研究结论，并告诉我接下来还需要做哪些验证。",
  "我上传了日志、表格和说明文档，请先帮我整理这些材料，再告诉我下一步应该怎么推进。",
];

const activePage = computed(() => pages[currentPage.value]);

watch(
  () => props.modelValue,
  (value) => {
    if (value) currentPage.value = 0;
  },
);
</script>
