<template>
  <AppLayout title="套餐" subtitle="按套餐管理算力与套餐存储容量">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-950 dark:text-white">套餐状态</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-slate-300">按小白化流程选择套餐并完成扩容。</p>
          </div>
          <a class="btn btn-primary" href="/portal/opl">进入 OPL</a>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">余额</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(subscription?.balance) }}</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">运行中预扣</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ money(subscription?.frozenAmount) }}</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">已用容量</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ usedStorageGb }} GB</div>
          </div>
          <div class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">宽限期</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ currentGracePeriod }} 天</div>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <h3 class="text-base font-semibold text-gray-950 dark:text-white">套餐目录</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-slate-300">入门、进阶与自定义能力并列展示，按业务阶段选择。</p>
        <div v-if="catalogLoading" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">套餐目录加载中...</div>
        <div v-if="catalogError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{{ catalogError }}</div>
        <div v-if="subscriptionLoading" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">订阅状态加载中...</div>
        <div v-if="subscriptionError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{{ subscriptionError }}</div>
        <div v-if="entitlementLoading" class="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">套餐权益加载中...</div>
        <div v-if="entitlementError" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{{ entitlementError }}</div>

        <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">入门套餐</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ starterPackage?.name || "入门套餐" }}</div>
            <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ starterPackage?.planSummary || "--" }}</div>
            <div class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ starterPackage?.headline || "" }}</div>
            <div class="mt-3 text-xs text-gray-500 dark:text-slate-400">费用：{{ money(starterPackage?.dailyDebit, starterPackage?.currency) }}/天</div>
            <button class="btn btn-primary mt-3 w-full" :disabled="starterDisabled" @click="activateStarterPackage">
              {{ actionText("activate_starter", "开通入门套餐") }}
            </button>
            <div v-if="starterDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ starterDisabledReason }}</div>
          </article>

          <article class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">进阶套餐</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">{{ proPackage?.name || "进阶套餐" }}</div>
            <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ proPackage?.planSummary || "--" }}</div>
            <div class="mt-2 text-sm text-gray-600 dark:text-slate-300">{{ proPackage?.headline || "" }}</div>
            <div class="mt-3 text-xs text-gray-500 dark:text-slate-400">费用：{{ money(proPackage?.dailyDebit, proPackage?.currency) }}/天</div>
            <button class="btn btn-secondary mt-3 w-full" :disabled="proDisabled" @click="upgradeAdvancedPackage">
              {{ actionText("upgrade_pro", "升级到进阶套餐") }}
            </button>
            <div v-if="proDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ proDisabledReason }}</div>
          </article>

          <article class="rounded-xl border border-gray-100 p-4 dark:border-slate-700">
            <div class="text-xs text-gray-500 dark:text-slate-400">自定义</div>
            <div class="mt-2 text-lg font-semibold text-gray-950 dark:text-white">自定义套餐</div>
            <div class="mt-1 text-sm text-gray-600 dark:text-slate-300">{{ customSummaryText }}</div>
            <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">{{ customNotesText }}</div>
            <div class="mt-4 space-y-3">
              <label class="block text-xs font-medium text-gray-600 dark:text-slate-300">
                CPU
                <select v-model.number="selectedCustomCpuCores" class="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option v-for="cores in customCpuOptions" :key="cores" :value="cores">{{ cores }} 核</option>
                </select>
              </label>
              <label class="block text-xs font-medium text-gray-600 dark:text-slate-300">
                内存
                <select v-model.number="selectedCustomMemoryGb" class="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option v-for="memory in customMemoryOptions" :key="memory" :value="memory">{{ memory }}GB</option>
                </select>
              </label>
              <label class="block text-xs font-medium text-gray-600 dark:text-slate-300">
                套餐存储
                <select v-model.number="selectedCustomStorageGb" class="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <option v-for="size in customStorageOptions" :key="size" :value="size">{{ size }}GB</option>
                </select>
              </label>
            </div>
            <button class="btn btn-secondary mt-3 w-full" :disabled="customPackageDisabled" @click="submitCustomPackage">
              {{ actionText("custom_package", "提交自定义套餐") }}
            </button>
            <div class="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">已开通套餐后还可以单独扩容：{{ addonOptionsText }}</div>
            <button class="btn btn-ghost mt-2 w-full" :disabled="customDisabled" @click="expandSelected">
              {{ actionText("expand_custom", `扩容 ${selectedAddonGb}GB`) }}
            </button>
            <div class="mt-2 flex flex-wrap gap-2">
              <button
                v-for="size in addonOptions"
                :key="size"
                class="btn btn-ghost"
                :class="{ 'ring-1 ring-blue-500': selectedAddonGb === size }"
                :disabled="loadingAction"
                @click="selectedAddonGb = size"
              >
                {{ size }}GB
              </button>
            </div>
            <div v-if="customPackageDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ customPackageDisabledReason }}</div>
            <div v-if="customDisabledReason" class="mt-2 text-xs text-amber-600 dark:text-amber-400">{{ customDisabledReason }}</div>
          </article>
        </div>

        <div
          v-if="actionFeedback"
          class="mt-4 rounded-lg border p-3 text-sm"
          :class="feedbackClass"
        >
          {{ actionFeedback }}
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import AppLayout from "@/layouts/AppLayout.vue";
import { usePackageSurface } from "@/composables/usePackageSurface";

const {
  actionFeedback,
  actionText,
  activateStarterPackage,
  addonOptions,
  addonOptionsText,
  catalogError,
  catalogLoading,
  customCpuOptions,
  customDisabled,
  customDisabledReason,
  customMemoryOptions,
  customNotesText,
  customPackageDisabled,
  customPackageDisabledReason,
  customStorageOptions,
  customSummaryText,
  currentGracePeriod,
  entitlementError,
  entitlementLoading,
  expandSelected,
  feedbackClass,
  loadPackageSurface,
  loadingAction,
  money,
  proDisabled,
  proDisabledReason,
  proPackage,
  selectedAddonGb,
  selectedCustomCpuCores,
  selectedCustomMemoryGb,
  selectedCustomStorageGb,
  starterDisabled,
  starterDisabledReason,
  starterPackage,
  submitCustomPackage,
  subscription,
  subscriptionError,
  subscriptionLoading,
  upgradeAdvancedPackage,
  usedStorageGb,
} = usePackageSurface();

onMounted(async () => {
  loadPackageSurface();
});
</script>
