<template>
  <section data-route-id="resources" data-component-id="resources.release_audit" class="card p-5">
    <div>
      <h2 class="panel-title">释放审计</h2>
      <p class="panel-subtitle">停止计费和审计由平台自动核对。</p>
    </div>
    <div class="mt-4 space-y-3">
      <div class="muted-kv">
        <span class="muted-kv-label">释放策略</span>
        <span class="muted-kv-value">{{ releasePolicyText }}</span>
      </div>
      <div class="muted-kv">
        <span class="muted-kv-label">审计状态</span>
        <span class="muted-kv-value">{{ auditStatusText(currentProtection?.tPlus1AuditStatus) }}</span>
      </div>
      <div class="muted-kv">
        <span class="muted-kv-label">停止计费</span>
        <span class="muted-kv-value">{{ stopBillingText }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { WeeklyProtectionFreeze } from "@/api/portal/resources";

defineProps<{
  auditStatusText: (status?: string) => string;
  currentProtection: WeeklyProtectionFreeze | null;
  releasePolicyText: string;
  stopBillingText: string;
}>();
</script>
