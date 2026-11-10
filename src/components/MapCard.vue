<script setup lang="ts">
// 牛皮纸地图卡：三折明暗与网格由样式提供；tilt 为首页微倾斜，mark 为问号徽记，flash 为答对时的描边闪光。
withDefaults(defineProps<{ tilt?: boolean; mark?: boolean; flash?: boolean }>(), { tilt: false, mark: false, flash: false });
</script>
<template>
  <div class="map-card" :class="{ 'map-card--tilt': tilt, 'map-card--flash': flash }">
    <slot />
    <svg v-if="mark" class="map-mark" width="26" height="36" viewBox="0 0 40 56" aria-hidden="true">
      <path d="M9 18c0-7.5 5-12 11.5-12S32 10 32 16.5c0 5-3 7.2-7 10.2-3 2.3-4 4-4 8" fill="none" stroke="#c4502a" stroke-width="7" stroke-linecap="round"/>
      <circle cx="21" cy="49" r="4.6" fill="#c4502a"/>
    </svg>
  </div>
</template>
