<script setup lang="ts">
defineProps<{ name: string; size?: number }>();
</script>
<template>
  <svg :width="size || 20" :height="size || 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'globe'"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5c4 2 10 2 14 0M5 17.5c4-2 10-2 14 0"/></template>
    <template v-else-if="name === 'arrow'"><path d="M4 12h15m-6-6 6 6-6 6"/></template>
    <template v-else-if="name === 'back'"><path d="m14 5-7 7 7 7"/></template>
    <template v-else-if="name === 'close'"><path d="m6 6 12 12M6 18 18 6"/></template>
    <template v-else-if="name === 'check'"><path d="m5 12 4 4L19 6"/></template>
    <template v-else-if="name === 'heart'"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></template>
    <template v-else-if="name === 'rank'"><path d="M3 20h18M5 20V11h4v9m2 0V4h4v16m2 0v-6h4v6"/></template>
    <template v-else-if="name === 'pin'"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></template>
    <template v-else-if="name === 'compass'"><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/></template>
    <template v-else-if="name === 'share'"><path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/></template>
    <template v-else-if="name === 'refresh'"><path d="M20 8a9 9 0 1 0 .4 7M20 3v6h-6"/></template>
    <template v-else-if="name === 'flame'"><path d="M12 3c.9 3.4 5 5.4 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2 0 2 1 3 2 3 0-3-1-5 1-8.8Z"/></template>
    <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></template>
  </svg>
</template>
