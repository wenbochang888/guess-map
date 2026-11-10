<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import Icon from './Icon.vue';
const props = defineProps<{ title: string; wide?: boolean; sheet?: boolean; closeLabel?: string; returnFocus?: HTMLElement | null }>();
const emit = defineEmits<{ (e: 'close'): void }>();
const scope = ref<HTMLElement | null>(null);
let previous: HTMLElement | null = null;
let overflow = '';
function focusable() {
  return Array.from(scope.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); }
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const nodes = focusable();
  if (!nodes.length) { scope.value?.focus(); return; }
  const index = nodes.indexOf(document.activeElement as HTMLElement);
  const next = index < 0 ? (event.shiftKey ? nodes.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
  nodes[next].focus();
}
async function focusContent() { await nextTick(); if (scope.value) scope.value.scrollTop = 0; (scope.value?.querySelector<HTMLElement>('[data-autofocus]') || focusable()[0] || scope.value)?.focus(); }
watch(() => props.title, () => { void focusContent(); });
onMounted(async () => {
  previous = props.returnFocus || document.activeElement as HTMLElement;
  overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', keyboard);
  await focusContent();
});
onUnmounted(() => {
  document.removeEventListener('keydown', keyboard); document.body.style.overflow = overflow;
  if (previous?.isConnected) previous.focus();
  else document.querySelector<HTMLElement>('main h1')?.focus();
});
</script>
<template>
  <div class="modal-backdrop" :class="{ 'modal-backdrop--sheet': sheet }" @click.self="emit('close')">
    <section ref="scope" class="modal" :class="{ 'modal--wide': wide, 'modal--sheet': sheet }" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
      <button class="modal-close icon-button" :aria-label="closeLabel || '关闭弹窗'" @click="emit('close')"><Icon name="close" /></button>
      <slot />
    </section>
  </div>
</template>
