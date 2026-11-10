<script setup lang="ts">
// 应用图标小尺寸版：墨绿底 + 倾斜牛皮纸地图卡 + 问号；小尺寸去掉网格与内框，与 资料/最终 图标同一几何。
defineProps<{ size?: number }>();
</script>
<template>
  <svg :width="size || 26" :height="size || 26" viewBox="0 0 1024 1024" aria-hidden="true">
    <rect width="1024" height="1024" rx="225" fill="#1f3d32"/>
    <g transform="rotate(-6 512 512)">
      <rect x="166" y="174" width="720" height="720" rx="47.5" fill="#152c24"/>
      <rect x="152" y="152" width="720" height="720" rx="47.5" fill="#efe5d0"/>
      <g transform="translate(512,504.8) scale(.8)">
        <path fill="none" stroke="#1f3d32" stroke-width="132" stroke-linecap="round" stroke-linejoin="round" d="M-118,-150 C-118,-232 -58,-282 6,-282 C78,-282 128,-236 128,-170 C128,-108 84,-80 44,-56 C10,-35 0,-14 0,20 L0,34"/>
        <circle cx="0" cy="214" r="76.6" fill="#c4502a"/>
      </g>
    </g>
  </svg>
</template>
