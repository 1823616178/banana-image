<script setup lang="ts">
const { messages, dismiss } = useToast()
</script>

<template>
  <div class="container_common_toast_top_stack" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="item in messages"
        :key="item.id"
        class="container_common_toast_top_item"
        :data-kind="item.kind"
        role="status"
      >
        <span class="container_common_toast_top_message">{{ item.message }}</span>
        <button class="container_common_toast_top_close" type="button" aria-label="关闭提示" @click="dismiss(item.id)">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped lang="scss">
.container_common_toast_top_stack {
  position: fixed;
  z-index: 100;
  top: 92px;
  right: 24px;
  display: grid;
  width: min(380px, calc(100vw - 32px));
  gap: 10px;
  pointer-events: none;
}

.container_common_toast_top_item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px 13px 18px;
  border: 1px solid var(--color-border);
  border-left: 5px solid var(--color-primary);
  border-radius: 12px 18px 13px 16px;
  background: var(--color-paper);
  box-shadow: $warm-shadow;
  pointer-events: auto;

  &[data-kind='success'] { border-left-color: var(--color-success); }
  &[data-kind='error'] { border-left-color: var(--color-danger); }
}

.container_common_toast_top_message { flex: 1; }

.container_common_toast_top_close {
  @include ink-focus;
  width: 30px;
  height: 30px;
  padding: 6px;
  border: 0;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateX(14px); }

@media (max-width: 600px) {
  .container_common_toast_top_stack { top: 80px; right: 16px; }
}
</style>
