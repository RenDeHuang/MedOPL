<template>
  <ActionPanel
    data-route-id="admin.system"
    data-component-id="admin.system.site_settings"
    title="站点设置"
    subtitle="配置首页展示、站点 logo 和注册入口。"
  >
    <form class="grid gap-4 xl:grid-cols-2" @submit.prevent="$emit('submit')">
      <div v-if="message" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 xl:col-span-2">
        {{ message }}
      </div>
      <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 xl:col-span-2">
        {{ error }}
      </div>

      <label class="text-sm text-gray-700 dark:text-slate-200">
        <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">站点名称</span>
        <input v-model.trim="model.siteName" class="input" type="text" required />
      </label>
      <label class="text-sm text-gray-700 dark:text-slate-200">
        <span class="mb-1.5 block text-xs text-gray-500 dark:text-slate-400">站点副标题</span>
        <input v-model.trim="model.siteSubtitle" class="input" type="text" required />
      </label>
      <div class="xl:col-span-2">
        <SiteLogoField v-model="model.siteLogo" @clear="model.siteLogo = ''" />
      </div>
      <div class="xl:col-span-2">
        <HomeContentEditor v-model="model.homeContent" />
      </div>
      <label class="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-slate-700 dark:text-slate-200">
        <input v-model="model.allowRegistration" type="checkbox" />
        开放注册
      </label>
      <div class="flex justify-end gap-2 xl:col-span-2">
        <a class="btn btn-secondary" href="/home" target="_blank" rel="noreferrer">预览首页</a>
        <button class="btn btn-primary" type="submit" :disabled="saving">
          {{ saving ? "保存中..." : "保存设置" }}
        </button>
      </div>
    </form>
  </ActionPanel>
</template>

<script setup lang="ts">
import ActionPanel from "@/components/common/ActionPanel.vue";
import HomeContentEditor from "@/components/admin/HomeContentEditor.vue";
import SiteLogoField from "@/components/admin/SiteLogoField.vue";

defineProps<{
  error: string;
  message: string;
  model: {
    siteName: string;
    siteLogo: string;
    siteSubtitle: string;
    homeContent: string;
    allowRegistration: boolean;
  };
  saving: boolean;
}>();

defineEmits<{
  submit: [];
}>();
</script>
