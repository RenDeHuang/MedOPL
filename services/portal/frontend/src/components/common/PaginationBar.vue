<template>
  <nav data-primitive-id="primitive.pagination" class="pager-bar" aria-label="分页">
    <span>{{ label }}</span>
    <div class="flex gap-2">
      <slot>
        <button class="btn btn-secondary" type="button" :disabled="previousDisabled" @click="$emit('previous')">上一页</button>
        <button class="btn btn-secondary" type="button" :disabled="nextDisabled" @click="$emit('next')">下一页</button>
      </slot>
    </div>
  </nav>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
}>(), {
  previousDisabled: false,
  nextDisabled: false,
});

defineEmits<{
  previous: [];
  next: [];
}>();
</script>
