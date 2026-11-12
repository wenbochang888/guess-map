<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import AppDialog from './components/AppDialog.vue';
import BrandMark from './components/BrandMark.vue';
import Icon from './components/Icon.vue';
import RegionPicker from './components/RegionPicker.vue';
import { homePreviewFor } from './data/home-previews';
import GameScreen from './screens/GameScreen.vue';
import HomeScreen from './screens/HomeScreen.vue';
import RanksScreen from './screens/RanksScreen.vue';
import ResultScreen from './screens/ResultScreen.vue';
import { config } from './config';
import bankData from './data/questions.json';
import { advance, answer, newSession, type Session } from './game/session';
import { countryScopeNotes, questionForId, type QuestionBank } from './game/questions';
import { bestKey, boardFor, defaultOptions, boardNames, type GameOptions, type BoardKey } from './game/options';
import { createLeaderboard } from './platform/leaderboard';
import { createFollowService } from './platform/follow';
import { readBests, saveBest } from './platform/storage';
import { canShare, shareCard, updateWindowInsets, vibrate } from './platform/xhs';
import type { Mode, MyRank, Period, RankEntry } from './platform/types';
const bank = bankData as QuestionBank;
const mode = ref<Mode>('cities');
const regionId = ref('all');
const options = computed<GameOptions>(() => mode.value === 'countries' ? defaultOptions('countries') : { mode: 'cities', regionId: regionId.value });
const screen = ref<'home' | 'game' | 'result' | 'ranks'>('home');
const session = ref<Session | null>(null);
const bests = reactive<Record<string, number>>({});
const previousBest = ref(0);
const saveFailed = ref(false);
const modal = ref<'exit' | 'info' | 'regions' | 'follow' | null>(null);
const streak = ref(0), missed = ref<string[]>([]);
const advancing = ref(false), advanceEpoch = ref(0);
const shareAvailable = ref(false), shareBusy = ref(false), toast = ref('');
const modalTrigger = ref<HTMLElement | null>(null);
const leaderboard = createLeaderboard(config.leaderboardEnabled);
const availability = ref(leaderboard.availability);
const rankBoard = ref<BoardKey>('china-provinces');
const period = ref<Period>('all');
const rankEntries = ref<RankEntry[]>([]);
const myRank = ref<MyRank | null>(null), resultRank = ref<MyRank | null>(null);
const rankLoading = ref(false), rankError = ref('');
const homeRankEntries = ref<RankEntry[]>([]);
const homeRankLoading = ref(true), homeRankError = ref('');
const homeBoard = computed(() => boardFor(defaultOptions(mode.value)));
const homeTopTen = computed(() => homeRankEntries.value.slice(0, 10));
const submitState = ref<'idle' | 'pending' | 'success' | 'error'>('idle');
const rankOrigin = ref<'home' | 'result'>('home');
const followService = createFollowService();
const followBusy = ref(false), followNote = ref(''), followAvailable = ref(false);
const finished = new Set<string>();
let advanceTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let waitTimer: ReturnType<typeof setTimeout> | undefined;
let rankRequest = 0, homeRankRequest = 0, followRequest = 0;
let mounted = true;
const activeOptions = computed(() => screen.value === 'home' ? options.value : session.value?.options || options.value);
const current = computed(() => session.value?.deck[session.value.index]);
const currentRegion = computed(() => bank.regions.find(r => r.id === current.value?.regionId));
const preview = computed(() => homePreviewFor(bank, mode.value));
const selectedBest = computed(() => bests[bestKey(screen.value === 'home' ? options.value : session.value?.options || options.value)] || 0);
const regionalStart = computed(() => activeOptions.value.mode === 'cities' && activeOptions.value.regionId !== 'all');
const noun = computed(() => activeOptions.value.mode === 'countries' ? '国家' : current.value?.adminType === 'province-level' ? '省级行政区' : current.value?.adminType === 'district' || current.value?.adminType === 'county' ? '区县' : current.value?.adminType === 'prefecture' ? '地级行政区' : '城市');
const unit = computed(() => activeOptions.value.mode === 'countries' ? '个国家' : '个地区');
const willFinish = computed(() => !!session.value && (session.value.mistakes >= config.maxMistakes || session.value.index + 1 >= session.value.deck.length));
const completedAll = computed(() => !!session.value && session.value.mistakes < config.maxMistakes);
const newBest = computed(() => (session.value?.score || 0) > previousBest.value);
const selectedRegion = computed(() => bank.regions.find(r => r.id === regionId.value));
const regionName = computed(() => selectedRegion.value?.name || '全部地区');
const contextLine = computed(() => {
  const game = session.value, q = current.value;
  if (!game || !q) return '';
  if (game.options.mode === 'countries') return countryScopeNotes[q.id] ? `${q.region} · 国家 · ${countryScopeNotes[q.id]}` : `${q.region} · 国家`;
  if (q.adminType === 'province-level') return '中国大陆 · 省级地区';
  return `${currentRegion.value?.name || q.region} · ${currentRegion.value?.kind === 'municipality' ? '区县' : '地级行政区'}`;
});
const insetLabel = computed(() => currentRegion.value?.kind === 'municipality' ? '市内位置' : currentRegion.value?.kind === 'autonomous' ? '自治区内位置' : '省内位置');
// 题量很大，称号按绝对分数分档；得分环填充到当前档位的上限。
const titleTiers = computed(() => session.value?.mode === 'countries' ? [10, 30, 60] : [10, 31, 100]);
const rankTitle = computed(() => {
  const game = session.value;
  if (!game) return '';
  const [low, mid, high] = titleTiers.value;
  return completedAll.value || game.score >= high ? '活地图' : game.score >= mid ? '认路达人' : game.score >= low ? '渐入佳境' : '初见轮廓';
});
const ringTotal = computed(() => {
  const game = session.value;
  if (!game) return 1;
  if (completedAll.value) return game.deck.length;
  return titleTiers.value.find(tier => game.score < tier) || Math.max(1, game.score);
});
const missedNames = computed(() => missed.value.map(id => questionForId(bank, id)?.name || '').filter(Boolean));
const rankCaption = computed(() => `${boardNames[rankBoard.value]} · 答对一题一分，猜错 3 次结束`);
function choiceName(id: string): string {
  const question = questionForId(bank, id);
  if (!question) return '未知选项';
  const sameName = session.value?.deck[session.value.index]?.choices.filter(other => questionForId(bank, other)?.name === question.name) || [];
  return sameName.length > 1 ? `${question.name}（${question.region}）` : question.name;
}
function label(value: GameOptions) { return value.mode === 'countries' ? '国家' : value.regionId === 'all' ? '中国大陆' : `中国大陆 · ${bank.regions.find(r => r.id === value.regionId)?.name || '所选地区'}起步`; }
const myRankText = computed(() => !myRank.value ? '' : myRank.value.status === 'EXACT' ? `第 ${myRank.value.rank} 名` : myRank.value.status === 'OVER_LIMIT' ? '500+' : myRank.value.status === 'NO_SCORE' ? '本期暂无成绩' : '完成一局后上榜');
function notify(message: string) { toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = ''; }, 3000); }
async function focusHeading() { await nextTick(); window.scrollTo(0, 0); document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }); }
function cancelAdvance() { clearTimeout(advanceTimer); advancing.value = false; }
function invalidateFollow() { if (modal.value === 'follow') modal.value = null; }
function changeMode(value: Mode) {
  if (mode.value === value) return;
  mode.value = value;
  void loadHomeRanks();
}
function openRegions(event: Event) { openModal('regions', event); }
function pickRegion(id: string) { regionId.value = id; modal.value = null; }
function start(value?: GameOptions) {
  const requested = value || options.value;
  const chosen = requested.mode === 'countries' ? defaultOptions('countries') : requested;
  let game: Session;
  try { game = newSession(bank, chosen); } catch (error) { notify(error instanceof Error ? error.message : '题库暂不可用'); return; }
  invalidateFollow(); cancelAdvance(); rankRequest++; homeRankRequest++;
  mode.value = chosen.mode;
  if (chosen.mode === 'cities') regionId.value = chosen.regionId;
  streak.value = 0; missed.value = [];
  previousBest.value = bests[game.bestKey] || 0; saveFailed.value = false; submitState.value = 'idle'; resultRank.value = null;
  followRequest++; followAvailable.value = false; followNote.value = ''; modal.value = null;
  session.value = game; screen.value = 'game'; void focusHeading();
}
function choose(choice: string) { const game = session.value, q = current.value; if (!game || !q || !answer(game, q.id, choice)) return;
  if (game.correct) streak.value++; else { streak.value = 0; missed.value.push(q.id); }
  vibrate(); scheduleAdvance(game.id); }
function scheduleAdvance(id: string) {
  cancelAdvance();
  const game = session.value;
  if (!mounted || document.hidden || modal.value || screen.value !== 'game' || game?.id !== id || game.phase !== 'feedback') return;
  const questionId = game.deck[game.index].id;
  advancing.value = true; advanceEpoch.value++;
  advanceTimer = setTimeout(() => {
    advancing.value = false;
    if (mounted && !document.hidden && !modal.value && screen.value === 'game' && session.value?.id === id && current.value?.id === questionId && session.value.phase === 'feedback') next();
  }, game.correct ? config.correctDelayMs : config.wrongDelayMs);
}
function next() { cancelAdvance(); const game = session.value; if (!game || !advance(game)) return; if (game.phase === 'finished') finish(game); else void focusHeading(); }
function stillResult(id: string) { return mounted && screen.value === 'result' && session.value?.id === id; }
function finish(game: Session) {
  if (finished.has(game.id)) return; finished.add(game.id);
  screen.value = 'result'; bests[game.bestKey] = Math.max(bests[game.bestKey] || 0, game.score);
  void saveBest(game.bestKey, game.score).then(saved => { if (stillResult(game.id)) saveFailed.value = !saved; });
  // Snapshot-bound work survives navigation after a completed game; only UI updates are guarded.
  void submit(game); void focusHeading(); void checkResultFollow(game.id);
}
async function submit(game: Session) {
  // A preview with an incomplete China bank must never contaminate the future full-China board.
  if (!config.leaderboardEnabled || !game.boardKey || (game.mode === 'cities' && !bank.coverage.complete)) return;
  const board = game.boardKey;
  if (leaderboard.availability === 'unknown') await leaderboard.probe();
  if (mounted) availability.value = leaderboard.availability;
  if (leaderboard.availability !== 'available') return;
  if (stillResult(game.id)) submitState.value = 'pending';
  try {
    await leaderboard.submit(board, game.score, game.id);
    if (mounted && screen.value === 'home' && homeBoard.value === board) void loadHomeRanks();
    if (stillResult(game.id)) submitState.value = 'success';
    if (stillResult(game.id)) { try { const data = await leaderboard.load(board, 'all'); if (stillResult(game.id)) resultRank.value = data.mine; } catch { /* query failure is not an empty rank */ } }
  } catch { if (stillResult(game.id)) submitState.value = 'error'; }
  if (mounted) availability.value = leaderboard.availability;
}
async function checkResultFollow(id: string) {
  const token = ++followRequest;
  const status = await followService.refresh();
  if (token !== followRequest || !mounted || session.value?.id !== id) return;
  followAvailable.value = status === 0;
}
function openFollow(event: Event) {
  if (!followAvailable.value) return;
  followBusy.value = followService.busy;
  followNote.value = followBusy.value ? '请先完成小红书的关注确认；若无法恢复，可以重新打开小工具。' : '';
  openModal('follow', event);
}
async function follow() {
  if (followBusy.value || followService.busy) return;
  const id = session.value?.id; followBusy.value = true; followNote.value = '';
  waitTimer = setTimeout(() => { if (stillResult(id || '') && modal.value === 'follow') followNote.value = '仍在等待小红书确认，可以关闭此提示继续玩。'; }, 5000);
  const outcome = await followService.follow(); clearTimeout(waitTimer);
  followBusy.value = followService.busy;
  if (outcome === 'followed' || outcome === 'self') followAvailable.value = false;
  if (!id || !stillResult(id) || modal.value !== 'follow') return;
  if (outcome === 'followed' || outcome === 'self') { closeModal(); notify(outcome === 'self' ? '这是你自己的小工具。' : '已关注，感谢你的喜欢。'); }
  else followNote.value = outcome === 'cancelled' ? '已取消，随时可以继续猜。' : outcome === 'limited' ? '今日关注提醒已达上限，可以通过作者主页关注。' : outcome === 'pending' ? '请先完成小红书的关注确认；若无法恢复，可以重新打开小工具。' : '暂时无法完成关注，可以通过小工具作者入口进入主页。';
}
function home() { followRequest++; followAvailable.value = false; invalidateFollow(); cancelAdvance(); rankRequest++; homeRankRequest++; screen.value = 'home'; regionId.value = 'all'; session.value = null; modal.value = null; void focusHeading(); void loadHomeRanks(); }
function askExit(event?: Event) { cancelAdvance(); openModal('exit', event); }
function openModal(kind: 'exit' | 'info' | 'regions' | 'follow', event?: Event) { modalTrigger.value = event?.currentTarget instanceof HTMLElement ? event.currentTarget : document.activeElement as HTMLElement; modal.value = kind; }
function closeModal() { modal.value = null; if (screen.value === 'game' && session.value?.phase === 'feedback') scheduleAdvance(session.value.id); }
async function loadHomeRanks(force = false) {
  const request = ++homeRankRequest;
  const board = homeBoard.value;
  homeRankLoading.value = true; homeRankError.value = ''; homeRankEntries.value = [];
  try {
    const data = await leaderboard.load(board, 'all', force);
    if (!mounted || screen.value !== 'home' || request !== homeRankRequest || board !== homeBoard.value) return;
    homeRankEntries.value = data.entries;
  } catch {
    if (mounted && request === homeRankRequest) homeRankError.value = '榜单暂时没连上，请稍后重试。';
  } finally {
    if (mounted) {
      availability.value = leaderboard.availability;
      if (request === homeRankRequest) homeRankLoading.value = false;
    }
  }
}
async function probeRanks() { await leaderboard.probe(); if (mounted) availability.value = leaderboard.availability; }
async function openRanks() {
  homeRankRequest++; invalidateFollow(); rankOrigin.value = screen.value === 'result' ? 'result' : 'home';
  rankBoard.value = boardFor(activeOptions.value); screen.value = 'ranks'; period.value = 'all'; void focusHeading(); await loadRanks();
}
async function loadRanks(force = false) {
  const request = ++rankRequest; rankLoading.value = true; rankError.value = ''; rankEntries.value = []; myRank.value = null;
  try { const data = await leaderboard.load(rankBoard.value, period.value, force); if (request !== rankRequest || !mounted) return; rankEntries.value = data.entries; myRank.value = data.mine; }
  catch { if (request === rankRequest && mounted) rankError.value = leaderboard.availability === 'unavailable' ? '排行榜暂未开放，先轻松猜一局吧。' : '榜单暂时没连上，请稍后重试。'; }
  finally { if (request === rankRequest && mounted) { rankLoading.value = false; availability.value = leaderboard.availability; } }
}
function changeBoard(value: BoardKey) { rankBoard.value = value; period.value = 'all'; void loadRanks(); }
function changePeriod(value: Period) { period.value = value; void loadRanks(); }
function backFromRanks() { rankRequest++; screen.value = rankOrigin.value === 'result' && session.value ? 'result' : 'home'; void focusHeading(); if (screen.value === 'home') void loadHomeRanks(); }
async function share() { if (shareBusy.value) return; shareBusy.value = true; try { await shareCard(); } catch { notify('暂时无法发起分享，可以继续猜地图。'); } finally { shareBusy.value = false; } }
function onVisibility() {
  if (document.hidden) { cancelAdvance(); invalidateFollow(); }
  else { void updateWindowInsets(); if (screen.value === 'home') void loadHomeRanks(); else if (leaderboard.availability === 'unknown') void probeRanks(); if (!modal.value && screen.value === 'game' && session.value?.phase === 'feedback') scheduleAdvance(session.value.id); }
}
function onResize() { void updateWindowInsets(); }
onMounted(() => {
  void readBests().then(saved => { if (!mounted) return; for (const key of Object.keys(saved)) bests[key] = Math.max(bests[key] || 0, saved[key]); if (session.value) previousBest.value = Math.max(previousBest.value, saved[session.value.bestKey] || 0); });
  void loadHomeRanks(); void canShare().then(value => { if (mounted) shareAvailable.value = value; }); void updateWindowInsets();
  window.addEventListener('resize', onResize); document.addEventListener('visibilitychange', onVisibility);
});
onUnmounted(() => { mounted = false; rankRequest++; homeRankRequest++; invalidateFollow(); cancelAdvance(); clearTimeout(toastTimer); clearTimeout(waitTimer); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVisibility); });
</script>

<template>
  <div class="app-shell" :class="`view-${screen}`">
    <header class="site-header">
      <button v-if="screen === 'game'" class="icon-button" aria-label="退出本局" @click="askExit"><Icon name="back" /></button>
      <button v-else-if="screen === 'result'" class="back-home text-button" aria-label="返回首页" @click="home"><Icon name="back" :size="18" />返回首页</button>
      <button v-else-if="screen === 'ranks'" class="icon-button" aria-label="返回" @click="backFromRanks"><Icon name="back" /></button>
      <div v-else class="wordmark"><BrandMark :size="26" /><span>猜地图</span></div>
      <span v-if="screen === 'game' && session" class="header-caption">猜{{ noun }}<span class="caption-progress">第 {{ session.index + 1 }} 题</span></span>
      <span v-else-if="screen === 'ranks'" class="header-caption">一起认识世界</span>
      <button v-if="screen === 'home'" class="icon-button info-button" aria-label="玩法与地图说明" @click="openModal('info', $event)"><Icon name="info" :size="19" /></button>
      <span v-else class="header-dot" aria-hidden="true"></span>
    </header>

      <HomeScreen v-if="screen === 'home'" :mode="mode" :region-name="regionName" :preview="preview" :config-label="label(options)" :best="selectedBest" :show-ranks="availability !== 'unavailable'" :can-open-ranks="availability === 'available'" :rank-loading="homeRankLoading" :rank-error="homeRankError" :rank-entries="homeTopTen" @mode="changeMode" @start="start()" @regions="openRegions" @ranks="openRanks" @retry="loadHomeRanks(true)" />
      <GameScreen v-else-if="screen === 'game' && session && current" :session="session" :current="current" :current-region="currentRegion" :noun="noun" :unit="unit" :context-line="contextLine" :inset-label="insetLabel" :will-finish="willFinish" :streak="streak" :advancing="advancing" :advance-epoch="advanceEpoch" :choice-name="choiceName" @choose="choose" @next="next" />
      <ResultScreen v-else-if="screen === 'result' && session" :session="session" :completed-all="completedAll" :unit="unit" :config-label="label(session.options)" :title="rankTitle" :ring-total="ringTotal" :new-best="newBest" :regional-start="regionalStart" :best="selectedBest" :save-failed="saveFailed" :available="availability === 'available'" :submit-state="submitState" :result-rank="resultRank" :missed="missedNames" :coverage-complete="bank.coverage.complete" :follow-available="followAvailable" :share-available="shareAvailable" :share-busy="shareBusy" @replay="start(session.options)" @follow="openFollow" @ranks="openRanks" @share="share" />
      <RanksScreen v-else-if="screen === 'ranks'" :board="rankBoard" :period="period" :loading="rankLoading" :error="rankError" :unavailable="availability === 'unavailable'" :entries="rankEntries" :my-rank="myRank" :my-rank-text="myRankText" :caption="rankCaption" :coverage-note="rankBoard === 'china-provinces' && !bank.coverage.complete" @board="changeBoard" @period="changePeriod" @retry="loadRanks(true)" @back="backFromRanks" @play="start(defaultOptions(rankBoard === 'china-provinces' ? 'cities' : 'countries'))" />

    <footer v-if="screen === 'home'" class="site-footer"><span>保持好奇，慢慢认识。</span></footer>
    <AppDialog v-if="modal" :title="modal === 'exit' ? '退出本局' : modal === 'regions' ? '选择地区' : modal === 'follow' ? '关注作者' : '玩法与地图说明'" :sheet="modal === 'regions'" :wide="modal === 'regions'" :return-focus="modalTrigger" @close="closeModal">
      <template v-if="modal === 'exit'"><span class="eyebrow">这张地图，还没看完</span><h2>先休息一下？</h2><p>返回首页会结束本局，未完成的成绩不上榜。</p><button class="primary-button" @click="closeModal">接着猜</button><button class="quiet-button" @click="home">返回首页</button></template>
      <RegionPicker v-else-if="modal === 'regions'" :regions="bank.regions" :selected="regionId" @select="pickRegion" />
      <template v-else-if="modal === 'follow'"><div class="follow-emblem"><Icon name="heart" :size="30" /></div><span class="eyebrow">把好奇心留在这里</span><h2>关注作者</h2><p>喜欢这样的地理小游戏，可以关注作者。<br>下一次，再一起认识一个地方。</p><button class="primary-button" :disabled="followBusy" @click="follow">{{ followBusy ? '等待小红书确认…' : '关注作者' }}<Icon name="arrow" :size="18" /></button><p v-if="followNote" class="follow-status" role="status">{{ followNote }}</p><button class="quiet-button" @click="closeModal">暂时不用</button></template>
      <template v-else>
        <span class="eyebrow">关于猜地图</span><h2>一点点好奇，就够了。</h2>
        <h3>玩法</h3>
        <p>看轮廓，四选一。答对得一分，猜错三次结束。不计时，不扣分。</p>
        <p>国家点击开始即可游玩，先易后难。一局题目不重复，全部答完也会结算。</p>
        <p>中国大陆从省级地区猜起，接着是各省的地级行政区和直辖市的区县；选择具体地区，就从那里开始，再走遍全国。{{ bank.coverage.complete ? '按2026年初来源快照收录大陆31个省级地区，省和自治区收录地级行政区，直辖市收录区县，并非全国所有县市。' : '当前仍为十省40道精选题的预览，并非全国完整题库；完整地级行政区与直辖市区县边界待核验。预览的中国成绩不提交全域榜。' }}不同开局都计入中国大陆榜，个人最佳按开局地区分别记录。</p>
        <h3>地图与数据来源</h3>
        <p class="source-note">法国仅展示欧洲本土与科西嘉岛，荷兰仅展示欧洲本土，厄瓜多尔不含加拉帕戈斯群岛，新西兰仅展示本土主要岛屿，题面另有标注。游戏轮廓地图{{ config.mapApprovalLabel }}。轮廓仅用于地理识别，不用于导航、测绘或界线认定。完整来源、版本及范围随包提供。</p>
        <p v-for="source in bank.notices" :key="source.name" class="source-note">{{ source.name }} · {{ source.license }}<br>{{ source.attribution }}<br>许可：{{ source.licenseUrl }}</p>
        <h3>记录与排行榜</h3>
        <p class="source-note">个人最佳保存在当前设备，按玩法和开局地区分别记录，清除缓存可能丢失。排行榜仅在小红书支持且开放时显示。关注需你在平台确认，不影响游戏成绩。</p>
        <button class="primary-button" @click="closeModal">知道了</button>
      </template>
    </AppDialog>
    <div v-if="toast" class="toast" role="status">{{ toast }}</div>
  </div>
</template>
