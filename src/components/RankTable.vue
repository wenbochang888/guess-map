<script setup lang="ts">
import type { RankEntry } from '../platform/types';
defineProps<{ entries: readonly RankEntry[] }>();
</script>
<template>
  <table class="rank-table">
    <thead><tr><th scope="col">名次</th><th scope="col">玩家</th><th scope="col">得分</th></tr></thead>
    <tbody><tr v-for="(entry, i) in entries" :key="entry.rank" :class="{ 'is-top': entry.rank <= 3 }" :style="{ '--i': Math.min(i, 12) }"><td><span :class="{ 'top-rank': entry.rank <= 3 }">{{ String(entry.rank).padStart(2, '0') }}</span></td><td>{{ entry.nickname || '地图同好' }}</td><td>{{ entry.score }}<small> 分</small></td></tr></tbody>
  </table>
</template>
