<script setup lang="ts">
import { computed } from 'vue';
import Icon from '../components/Icon.vue';
import MapCard from '../components/MapCard.vue';
import OutlineMap from '../components/OutlineMap.vue';
import { config } from '../config';
import type { Question, Region } from '../game/questions';
import type { Session } from '../game/session';
const props = defineProps<{
  session: Session; current: Question; currentRegion?: Region; noun: string; unit: string; contextLine: string; insetLabel: string;
  willFinish: boolean; streak: number; advancing: boolean; advanceEpoch: number; choiceName: (id: string) => string;
}>();
const emit = defineEmits<{ (e: 'choose', id: string): void; (e: 'next'): void }>();
const lives = computed(() => config.maxMistakes - props.session.mistakes);
const answered = computed(() => props.session.phase !== 'question');
const right = computed(() => answered.value && !!props.session.correct);
const wrong = computed(() => answered.value && !props.session.correct);
</script>
<template>
  <main class="game-layout">
    <div class="game-topline">
      <div class="score"><span>已认出</span><span class="score-num"><strong :key="session.score">{{ session.score }}</strong><span v-if="right" :key="session.score" class="plus-one" aria-hidden="true">+1</span></span><span>{{ unit }}</span><span v-if="streak >= 3" class="streak-badge" role="img" :aria-label="`连对${streak}题`"><Icon name="flame" :size="13" /><span class="streak-text">连对 </span>×{{ streak }}</span></div>
      <div class="lives" role="img" :aria-label="`剩余${lives}次机会`"><Icon v-for="n in config.maxMistakes" :key="n" name="heart" :size="22" :class="{ spent: n > lives, 'just-spent': wrong && n === lives + 1 }" /></div>
    </div>
    <section class="question-area">
      <div class="question-heading"><span class="eyebrow question-context">{{ contextLine }}</span><h1 tabindex="-1" class="display">这是哪个{{ noun }}？</h1></div>
      <MapCard :key="current.id" class="question-map" :flash="right">
        <OutlineMap :question="current" :approval-label="config.mapApprovalLabel" />
        <div v-if="session.mode === 'cities' && current.context && currentRegion" class="location-inset"><span><Icon name="pin" :size="12" />{{ insetLabel }}</span><svg viewBox="0 0 400 300" role="img" :aria-label="`待辨认地区在${currentRegion.name}的位置`"><path :d="currentRegion.path" class="context-region" fill-rule="nonzero"/><path :d="current.context.highlight" class="context-highlight" fill-rule="nonzero"/></svg></div>
        <div v-if="wrong" class="map-reveal" aria-hidden="true"><span>{{ current.name }}</span></div>
      </MapCard>
    </section>
    <div class="answer-area">
      <div class="feedback-line" :class="{ 'feedback-line--wrong': wrong }" aria-live="polite" aria-atomic="true">
        <template v-if="session.phase === 'question'"><span class="muted">不用着急，选一个你觉得对的。</span></template>
        <span v-else-if="session.correct" class="correct-message"><Icon name="check" :size="18" />认出来了！<strong>+1</strong></span>
        <template v-else>
          <span class="wrong-message"><Icon name="info" :size="17" />这是{{ current.name }}，下次就认识啦。</span>
          <span class="auto-advance-note">{{ config.wrongDelayMs / 1000 }} 秒后自动{{ willFinish ? '结算' : '继续' }}</span>
        </template>
      </div>
      <div :key="current.id" class="answers" role="group" aria-label="四个答案选项">
        <button v-for="(choice, index) in current.choices" :key="choice" class="answer-button" :class="{ 'is-right': answered && choice === current.id, 'is-wrong': answered && choice === session.selected && !session.correct, 'is-dim': answered && choice !== current.id && choice !== session.selected }" :disabled="session.phase !== 'question'" @click="emit('choose', choice)"><span class="choice-letter">{{ ['A', 'B', 'C', 'D'][index] }}</span><span>{{ choiceName(choice) }}</span><Icon v-if="answered && choice === current.id" name="check" :size="18" /><Icon v-else-if="answered && choice === session.selected" name="close" :size="17" /></button>
      </div>
      <button v-if="wrong" class="primary-button next-button" @click="emit('next')">{{ willFinish ? '看看这次的收获' : '下一题' }}<Icon name="arrow" :size="19" /><i v-if="advancing" :key="advanceEpoch" class="next-fill" aria-hidden="true" :style="{ animationDuration: `${config.wrongDelayMs}ms` }"></i></button>
      <p v-else class="game-footnote">没有倒计时，只有一点点好奇心。</p>
    </div>
  </main>
</template>
