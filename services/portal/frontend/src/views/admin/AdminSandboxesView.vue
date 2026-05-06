<template>
  <AppLayout title="旧运维入口已退役" subtitle="v21 不再以内建基础设施控制面作为 Portal readiness 的组成部分">
    <div class="space-y-6">
      <section class="card p-6">
        <div class="text-sm text-gray-700 dark:text-slate-300">
          当前页面对应的旧运维入口已退役。请使用新的运维总览查看 Portal、Gateway、Adapter、Billing、Runtime Agent、账单核对和 T+1 审计。
        </div>
        <div class="mt-4">
          <RouterLink class="btn btn-secondary" to="/admin/ops">打开运维总览</RouterLink>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from "@/layouts/AppLayout.vue";
</script>
