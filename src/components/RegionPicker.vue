<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Region } from '../game/questions';
import Icon from './Icon.vue';
const props = defineProps<{ regions: Region[]; selected: string; counts: Record<string, number> }>();
const emit = defineEmits<{ (e: 'select', id: string): void }>();
const search = ref('');
const complete = computed(() => props.regions.every(r => r.coverageComplete));
const groups = computed(() => [
  { title: '全部地区', regions: [] as Region[] },
  { title: '直辖市 · 猜区县', regions: props.regions.filter(r => r.kind === 'municipality' && r.name.includes(search.value.trim())) },
  { title: '省与自治区 · 猜地级行政区', regions: props.regions.filter(r => r.kind !== 'municipality' && r.name.includes(search.value.trim())).slice().sort((a,b) => a.name.localeCompare(b.name, 'zh-CN')) },
]);
</script>
<template>
  <span class="eyebrow">从熟悉的地方开始</span><h2>选择地区</h2>
  <p class="picker-note">默认猜省级地区，选择具体地区后猜其下一级行政区。{{ complete ? '省与自治区猜地级行政区，直辖市猜区县。' : '当前为数据核验预览，未就绪地区不会混入其他地方的题目。' }}</p>
  <label class="region-search"><Icon name="pin" :size="17" /><input v-model="search" type="search" placeholder="查找省、自治区、直辖市" aria-label="查找地区" /></label>
  <div class="region-list">
    <button class="region-option region-option--all" :aria-pressed="selected === 'all'" @click="emit('select','all')"><span>全部地区<small>{{ complete ? '猜省级行政区 · 31 道题' : '当前可用题目 · 非全国完整库' }}</small></span><Icon v-if="selected === 'all'" name="check" :size="18" /></button>
    <template v-for="group in groups.slice(1)" :key="group.title">
      <h3 v-if="group.regions.length">{{ group.title }}</h3>
      <div class="region-grid"><button v-for="region in group.regions" :key="region.id" class="region-option" :aria-pressed="selected === region.id" @click="emit('select', region.id)"><span>{{ region.name }}<small>{{ region.coverageComplete ? `${counts[region.id] || 0} 道题` : counts[region.id] ? `${counts[region.id]} 道精选 · 待补齐` : '边界数据待核验' }}</small></span><Icon v-if="selected === region.id" name="check" :size="16" /></button></div>
    </template>
    <p v-if="!groups[1].regions.length && !groups[2].regions.length" class="region-empty">没有找到这个地区，试试完整名称。</p>
  </div>
</template>
