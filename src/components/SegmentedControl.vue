<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';
type Item = { value: string; label: string; icon?: string };
const props = defineProps<{ items: Item[]; modelValue: string; label: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();
const index = computed(() => Math.max(0, props.items.findIndex(item => item.value === props.modelValue)));
const thumb = computed(() => ({ width: `calc((100% - 8px) / ${props.items.length})`, transform: `translateX(${index.value * 100}%)` }));
</script>
<template>
  <div class="seg" role="group" :aria-label="label">
    <i class="seg-thumb" :style="thumb" aria-hidden="true"></i>
    <button v-for="item in items" :key="item.value" :class="{ active: item.value === modelValue }" :aria-pressed="item.value === modelValue" @click="emit('update:modelValue', item.value)"><Icon v-if="item.icon" :name="item.icon" :size="18" />{{ item.label }}</button>
  </div>
</template>
