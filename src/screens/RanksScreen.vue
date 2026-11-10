<script setup lang="ts">
import { computed } from 'vue';
import Icon from '../components/Icon.vue';
import RankTable from '../components/RankTable.vue';
import SegmentedControl from '../components/SegmentedControl.vue';
import type { BoardKey } from '../game/options';
import type { MyRank, Period, RankEntry } from '../platform/types';
const props = defineProps<{
  board: BoardKey; period: Period; loading: boolean; error: string; unavailable: boolean; entries: readonly RankEntry[];
  myRank: MyRank | null; myRankText: string; caption: string; coverageNote: boolean;
}>();
const emit = defineEmits<{ (e: 'board', value: BoardKey): void; (e: 'period', value: Period): void; (e: 'retry'): void; (e: 'back'): void; (e: 'play'): void }>();
const boards = [{ value: 'china-provinces', label: '省级地区榜' }, { value: 'country-medium', label: '国家榜' }];
const periods = [['day', '今日'], ['week', '本周'], ['all', '总榜']] as const;
const indicator = computed(() => ({ transform: `translateX(${Math.max(0, periods.findIndex(item => item[0] === props.period)) * 100}%)` }));
</script>
<template>
  <main class="rank-layout">
    <span class="eyebrow">一点好奇心，一起看世界</span><h1 tabindex="-1" class="display">轮廓排行榜<span class="title-dot">.</span></h1>
    <SegmentedControl :items="boards" :model-value="board" label="榜单题库" @update:model-value="emit('board', $event as BoardKey)" />
    <p class="board-caption">{{ caption }}</p>
    <p v-if="coverageNote" class="coverage-note">完整题库尚未就绪，当前预览不向此榜提交成绩。</p>
    <div class="period-tabs" role="group" aria-label="榜单周期"><i class="tab-indicator" :style="indicator" aria-hidden="true"></i><button v-for="item in periods" :key="item[0]" :class="{ active: period === item[0] }" :aria-pressed="period === item[0]" @click="emit('period', item[0])">{{ item[1] }}</button></div>
    <div v-if="loading" class="rank-state" role="status"><div class="loading-dots"><i></i><i></i><i></i></div><p>正在展开榜单…</p></div>
    <div v-else-if="error" class="rank-state" role="status"><Icon name="compass" :size="32" /><p>{{ error }}</p><button v-if="!unavailable" class="text-button" @click="emit('retry')">重试一次<Icon name="refresh" :size="16" /></button><button v-else class="text-button" @click="emit('back')">返回继续玩</button></div>
    <template v-else>
      <div class="my-rank"><span>我的本期排名</span><strong>{{ myRankText }}</strong><small v-if="myRank?.status === 'EXACT'">{{ myRank.score }} 分</small></div>
      <div v-if="!entries.length" class="rank-state"><Icon name="globe" :size="34" /><p>这一期，还没有人留下成绩。</p><button class="text-button" @click="emit('play')">去认几个地方<Icon name="arrow" :size="16" /></button></div>
      <RankTable v-else :entries="entries" />
      <p class="rank-footnote">每期保留最好成绩 · 同分先提交者在前<br>今日与本周按北京时间更新</p>
    </template>
  </main>
</template>
