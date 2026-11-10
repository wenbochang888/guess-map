<script setup lang="ts">
import Icon from '../components/Icon.vue';
import MapCard from '../components/MapCard.vue';
import OutlineMap from '../components/OutlineMap.vue';
import RankTable from '../components/RankTable.vue';
import SegmentedControl from '../components/SegmentedControl.vue';
import type { HomePreview } from '../data/home-previews';
import type { Mode, RankEntry } from '../platform/types';
defineProps<{
  mode: Mode; regionName: string; regionMeta: string; local: boolean;
  preview: HomePreview; poolCount: number; configLabel: string; best: number;
  showRanks: boolean; canOpenRanks: boolean; rankLoading: boolean; rankError: string; rankEntries: readonly RankEntry[];
}>();
const emit = defineEmits<{ (e: 'mode', value: Mode): void; (e: 'start'): void; (e: 'regions', event: Event): void; (e: 'ranks'): void; (e: 'retry'): void }>();
const modes = [{ value: 'cities', label: '猜中国大陆地区', icon: 'pin' }, { value: 'countries', label: '猜国家', icon: 'globe' }];
</script>
<template>
  <main class="home-layout">
    <section class="home-copy">
      <div class="eyebrow"><span class="tiny-dot"></span>不用走远，也能发现世界</div>
      <h1 tabindex="-1" class="display">
        <template v-if="mode === 'cities'">家乡在地图上，<br><span class="accent-phrase">认得出吗？</span></template>
        <template v-else>世界很大，<br>你认得<span class="accent-phrase">几个？</span></template>
      </h1>
      <p class="intro">看轮廓，四选一。<br>不赶时间，慢慢猜。</p>
      <SegmentedControl :items="modes" :model-value="mode" label="选择题库" @update:model-value="emit('mode', $event as Mode)" />
      <button v-if="mode === 'cities'" class="region-trigger" aria-haspopup="dialog" @click="emit('regions', $event)">
        <span><small>{{ regionMeta }}</small><strong>{{ regionName }}</strong></span>
        <span class="chip-action"><span>更换</span><Icon name="arrow" :size="16" /></span>
      </button>
      <p v-if="local" class="local-note">本地区游玩只记个人最佳，不计入省级地区榜。</p>
      <p class="simple-rule">答对 +1 分<span>·</span>猜错 3 次结束</p>
      <button class="primary-button start-button" @click="emit('start')">开始猜<Icon name="arrow" :size="21" /></button>
      <div class="home-secondary"><span>{{ configLabel }} · 最佳 <strong>{{ best }}</strong> 分</span></div>
    </section>
    <section class="home-art" aria-label="轮廓示例">
      <MapCard class="atlas-card" tilt :mark="preview.kind === 'outline'">
        <OutlineMap v-if="preview.kind === 'outline'" :question="preview.shape" :approval-label="preview.approvalLabel" preview />
        <div v-else class="map-scene map-scene--preview map-scene--standard">
          <img class="standard-map-image" :src="preview.imageSrc" :alt="`${preview.name}地图示例`" width="1279" height="904">
          <span class="map-approval">{{ preview.approvalLabel }}</span>
        </div>
        <div class="atlas-caption"><div><span class="eyebrow">轮廓示例 / {{ preview.region }}</span><p>{{ preview.name }}<span>{{ mode === 'countries' ? 'COUNTRY' : 'PROVINCE' }}</span></p></div><span class="atlas-count"><strong>{{ poolCount }}</strong><span>道轮廓题</span></span></div>
      </MapCard>
      <span class="art-note">每一条边界，都藏着一个熟悉的名字。</span>
    </section>
    <section v-if="showRanks" class="home-ranks" aria-labelledby="home-ranks-heading">
      <div class="home-ranks-heading"><div><span class="eyebrow">今日探索者</span><h2 id="home-ranks-heading">{{ mode === 'cities' ? '中国大陆地区' : '国家' }} · 今日排行榜</h2></div><span class="home-ranks-limit">前 10 名</span></div>
      <div v-if="rankLoading" class="rank-state" role="status"><div class="loading-dots"><i></i><i></i><i></i></div><p>正在展开榜单…</p></div>
      <div v-else-if="rankError" class="rank-state" role="status"><p>{{ rankError }}</p><button class="text-button" @click="emit('retry')">重试一次<Icon name="refresh" :size="16" /></button></div>
      <template v-else><RankTable v-if="rankEntries.length" :entries="rankEntries" /><div v-else class="rank-state"><Icon name="globe" :size="30" /><p>这一期，还没有人留下成绩。</p><span>先猜一局，留下今天的收获。</span></div></template>
      <button v-if="canOpenRanks" class="text-button home-ranks-more" @click="emit('ranks')">查看完整排行榜<Icon name="arrow" :size="16" /></button>
    </section>
  </main>
</template>
