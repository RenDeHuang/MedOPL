<template>
  <span data-primitive-id="primitive.status_badge" class="badge" :class="badgeClass">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  label: string;
  tone?: "success" | "warning" | "danger" | "primary";
}>(), {
  tone: "primary",
});

const badgeClass = computed(() => ({
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  primary: "badge-primary",
}[props.tone]));
</script>
