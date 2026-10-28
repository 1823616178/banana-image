<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  disabled?: boolean
}>(), {
  type: 'button',
  variant: 'primary',
  loading: false,
  disabled: false,
})
</script>

<template>
  <button
    class="container_common_actions_center_paint"
    :class="{ 'is-loading': loading }"
    :data-variant="variant"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
  >
    <span v-if="loading" class="container_common_actions_center_spinner" aria-hidden="true" />
    <span class="container_common_actions_center_label"><slot /></span>
  </button>
</template>

<style scoped lang="scss">
.container_common_actions_center_paint {
  @include ink-focus;
  position: relative;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  overflow: hidden;
  padding: 10px 22px;
  border: 1px solid rgba(59, 42, 32, 0.16);
  border-radius: 12px 10px 14px 9px;
  background: var(--color-accent);
  box-shadow: 0 4px 0 rgba(59, 42, 32, 0.17);
  color: #3b2a20;
  cursor: pointer;
  font-weight: 700;
  transition: transform 160ms ease, box-shadow 160ms ease;

  &::before {
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 10%, rgba(255, 255, 255, 0.35) 48%, transparent 80%);
    content: '';
    transform: translateX(-110%);
    transition: transform 380ms ease;
  }

  &:hover:not(:disabled) {
    box-shadow: 0 6px 0 rgba(59, 42, 32, 0.17);
    transform: translateY(-2px);

    &::before { transform: translateX(110%); }
  }

  &:active:not(:disabled) {
    box-shadow: 0 2px 0 rgba(59, 42, 32, 0.17);
    transform: translateY(1px);
  }

  &:disabled { cursor: not-allowed; opacity: 0.55; }
  &[data-variant='secondary'] { background: var(--color-paper); color: var(--color-ink); }
  &[data-variant='danger'] { background: var(--color-danger); color: #fff8ed; }
  &[data-variant='ghost'] { border-color: transparent; background: transparent; box-shadow: none; color: var(--color-ink); }
}

.container_common_actions_center_spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: brush-stroke 800ms linear infinite;
}

.container_common_actions_center_label {
  position: relative;
}
</style>
