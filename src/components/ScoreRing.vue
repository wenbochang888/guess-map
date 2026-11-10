<script setup lang="ts">
import { computed } from 'vue';
// 结算得分环：纯 CSS 描边动画，数字本身始终是最终得分（不依赖 JS 计时）。
const props = defineProps<{ score: number; total: number }>();
const LENGTH = 2 * Math.PI * 104;
const style = computed(() => {
  const ratio = props.total > 0 ? Math.max(0, Math.min(1, props.score / props.total)) : 0;
  return { '--ring-len': String(LENGTH), strokeDasharray: String(LENGTH), strokeDashoffset: String(LENGTH * (1 - ratio)) };
});
</script>
<template>
  <div class="score-ring">
    <svg viewBox="0 0 224 224" aria-hidden="true">
      <circle class="ring-track" cx="112" cy="112" r="104" />
      <circle class="ring-fill" cx="112" cy="112" r="104" :style="style" />
    </svg>
    <slot />
  </div>
</template>
