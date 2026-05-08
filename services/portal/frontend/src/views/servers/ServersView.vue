<template>
  <AppLayout title="资源入口已收敛" subtitle="旧服务器目录已退役，工作台资源请从托管运行环境页面查看">
    <div class="space-y-4">
      <section class="card p-5">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="panel-title">旧服务器目录已退役</h2>
            <p class="panel-subtitle">v22 普通用户资源入口已收敛为工作台资源和 dry-run 调整计划。</p>
          </div>
          <RouterLink class="btn btn-primary" to="/resources">查看工作台资源</RouterLink>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div class="card p-5">
          <div class="text-sm font-semibold text-gray-950 dark:text-white">工作台资源</div>
          <p class="panel-subtitle">查看当前套餐、计算规格和文件空间。</p>
        </div>
        <div class="card p-5">
          <div class="text-sm font-semibold text-gray-950 dark:text-white">费用估算</div>
          <p class="panel-subtitle">余额和冻结金额状态由系统自动计算。</p>
        </div>
        <div class="card p-5">
          <div class="text-sm font-semibold text-gray-950 dark:text-white">释放策略</div>
          <p class="panel-subtitle">停止计费和审计状态在工作台资源页查看。</p>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
</script>
