<script setup lang="ts">
import Icon from '../components/Icon.vue';
import ScoreRing from '../components/ScoreRing.vue';
import type { Session } from '../game/session';
import type { MyRank } from '../platform/types';
defineProps<{
  session: Session; completedAll: boolean; unit: string; configLabel: string; title: string; ringTotal: number; newBest: boolean; regionalStart: boolean; best: number;
  saveFailed: boolean; available: boolean; submitState: 'idle' | 'pending' | 'success' | 'error'; resultRank: MyRank | null; missed: string[];
  coverageComplete: boolean; followAvailable: boolean; shareAvailable: boolean; shareBusy: boolean;
}>();
const emit = defineEmits<{ (e: 'replay'): void; (e: 'follow', event: Event): void; (e: 'ranks'): void; (e: 'share'): void }>();
const MAX_MISSED = 12;
</script>
<template>
  <main class="result-layout">
    <span class="eyebrow">{{ completedAll ? '这一组，全部认完了' : '又认识了世界的一角' }}</span>
    <div><span class="result-title">{{ title }}</span></div>
    <p class="result-config">{{ configLabel }}</p><h1 tabindex="-1" class="display">这次认出了</h1>
    <ScoreRing :score="session.score" :total="ringTotal"><div class="result-number">{{ session.score }}<span>{{ unit }}</span></div></ScoreRing>
    <p class="result-note">{{ completedAll ? '每一个轮廓，都有了名字。' : '没认出的，下次就熟悉了。' }}</p>
    <section v-if="missed.length" class="missed" aria-label="没认出的地方"><p class="missed-title">没认出的 · 下次留意</p><ul class="missed-list"><li v-for="(name, i) in missed.slice(0, MAX_MISSED)" :key="i" :style="{ '--i': i }">{{ name }}</li><li v-if="missed.length > MAX_MISSED">等 {{ missed.length }} 个</li></ul></section>
    <div class="best-record"><span>{{ newBest ? '✦ 刷新个人最佳' : regionalStart ? '本地区开局最佳' : '个人最佳' }}</span><strong>{{ best }}<small> 分</small></strong></div>
    <p v-if="saveFailed" class="status-note" role="status">本次记录暂未保存，退出后可能丢失。</p>
    <p v-if="available && submitState === 'pending'" class="status-note" role="status">正在记录本局成绩…</p>
    <p v-if="available && submitState === 'error'" class="status-note" role="status">本局未确认上榜，不影响个人记录。</p>
    <p v-if="available && resultRank?.status === 'EXACT'" class="result-rank">总榜排名 <strong>第 {{ resultRank.rank }} 名</strong></p><p v-else-if="available && resultRank?.status === 'OVER_LIMIT'" class="result-rank">总榜排名 <strong>500+</strong></p>
    <button class="primary-button" @click="emit('replay')">再猜一次<Icon name="refresh" :size="19" /></button>
    <p v-if="session.mode === 'cities' && !coverageComplete" class="local-only-note">当前为精选题预览，成绩暂不提交全域榜。</p>
    <div class="result-actions"><button v-if="followAvailable" class="text-button" @click="emit('follow', $event)">关注作者</button><button v-if="available" class="text-button" @click="emit('ranks')"><Icon name="rank" :size="17" />排行榜</button><button v-if="shareAvailable" class="text-button" :disabled="shareBusy" @click="emit('share')"><Icon name="share" :size="17" />分享游戏</button></div>
  </main>
</template>
