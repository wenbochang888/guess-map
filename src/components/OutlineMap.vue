<script setup lang="ts">
import type { Question } from '../game/questions';
withDefaults(defineProps<{ question: Pick<Question, 'name' | 'path'>; approvalLabel: string; preview?: boolean }>(), { preview: false });
</script>
<template>
  <div class="map-scene" :class="{ 'map-scene--preview': preview }">
    <span class="map-approval">{{ approvalLabel }}</span>
    <svg class="outline-map" viewBox="0 0 400 300" role="img" :aria-label="preview ? `${question.name}轮廓示例` : '待辨认的行政区轮廓'">
      <path :d="question.path" fill-rule="nonzero" vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>
