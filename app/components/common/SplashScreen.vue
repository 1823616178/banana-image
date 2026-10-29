<script setup lang="ts">
const visible = ref(true)
const leaving = ref(false)
let holdTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

function dismiss() {
  if (leaving.value || !visible.value) return
  leaving.value = true
  clearTimeout(holdTimer)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    visible.value = false
  }, 460)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
    dismiss()
  }
}

onMounted(() => {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const duration = reducedMotion ? 180 : 1850
  holdTimer = setTimeout(() => {
    dismiss()
  }, duration)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  clearTimeout(holdTimer)
  clearTimeout(hideTimer)
  if (import.meta.client) {
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <div
    v-if="visible"
    class="container_common_splash_main_overlay"
    :class="{ 'is-leaving': leaving }"
    role="dialog"
    aria-label="banana-image 开屏动画"
    @click="dismiss"
  >
    <div class="container_common_splash_main_frame" aria-hidden="true" />

    <div class="container_common_splash_center_card">
      <div class="container_common_splash_top_badge">
        <span class="container_common_splash_top_mark" aria-hidden="true" />
        <p class="container_common_splash_top_eyebrow">BANANA-IMAGE · LOCAL ATELIER</p>
      </div>

      <CommonBrushLoading
        class="container_common_splash_center_brush"
        size="lg"
        hide-text
      />

      <div class="container_common_splash_center_copy">
        <h1 class="container_common_splash_center_title">
          让灵感，落进<span class="container_common_splash_center_highlight">颜料</span>里。
        </h1>
        <p class="container_common_splash_center_subtitle">
          一方本地画布，一点 AI 魔法 · 正在铺展亚麻画布与油彩…
        </p>
      </div>

      <div class="container_common_splash_bottom_footer">
        <div class="container_common_splash_bottom_track" aria-hidden="true">
          <span class="container_common_splash_bottom_bar" />
        </div>
        <button
          class="container_common_splash_bottom_skip"
          type="button"
          @click.stop="dismiss"
        >
          进入画室 →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.container_common_splash_main_overlay {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 24px;
  background:
    radial-gradient(circle at 18% 18%, rgba($cadmium-yellow, 0.24), transparent 42%),
    radial-gradient(circle at 82% 24%, rgba($vermilion, 0.16), transparent 40%),
    radial-gradient(circle at 76% 82%, rgba($ultramarine, 0.2), transparent 44%),
    var(--color-canvas);
  cursor: pointer;
  transition:
    opacity 460ms cubic-bezier(0.33, 1, 0.68, 1),
    transform 460ms cubic-bezier(0.33, 1, 0.68, 1),
    filter 460ms cubic-bezier(0.33, 1, 0.68, 1);

  &.is-leaving {
    opacity: 0;
    filter: blur(10px);
    pointer-events: none;
    transform: scale(1.035);
  }
}

.container_common_splash_main_frame {
  position: absolute;
  inset: clamp(12px, 2.2vw, 26px);
  border: 1px solid rgba($frame-gold, 0.45);
  border-radius: 24px;
  box-shadow: inset 0 0 0 5px rgba($frame-gold, 0.12);
  pointer-events: none;
}

.container_common_splash_center_card {
  position: relative;
  display: grid;
  width: min(560px, 100%);
  justify-items: center;
  gap: 10px;
  padding: clamp(24px, 4vw, 40px) clamp(20px, 4vw, 44px);
  border: 1px solid var(--color-border);
  border-radius: 28px 22px 30px 20px;
  background: color-mix(in srgb, var(--color-paper) 86%, transparent);
  box-shadow:
    0 24px 64px rgba(59, 42, 32, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(16px);
  text-align: center;
  animation: splash-card-enter 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.container_common_splash_top_badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border: 1px solid rgba($frame-gold, 0.38);
  border-radius: 999px;
  background: var(--color-chip-active);
}

.container_common_splash_top_mark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: $paint-gradient;
  box-shadow: 0 0 8px rgba($cadmium-yellow, 0.75);
}

.container_common_splash_top_eyebrow {
  margin: 0;
  color: var(--color-primary);
  font-family: $font-accent;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.container_common_splash_center_brush {
  margin: -6px 0 -10px;
}

.container_common_splash_center_copy {
  display: grid;
  gap: 8px;
}

.container_common_splash_center_title {
  margin: 0;
  color: var(--color-ink);
  font-family: $font-display;
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.25;
}

.container_common_splash_center_highlight {
  position: relative;
  color: var(--color-primary);

  &::after {
    position: absolute;
    right: -3px;
    bottom: -3px;
    left: -3px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-accent);
    content: '';
    opacity: 0.72;
    transform: rotate(-2deg);
  }
}

.container_common_splash_center_subtitle {
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 14px;
}

.container_common_splash_bottom_footer {
  display: flex;
  width: 100%;
  max-width: 340px;
  align-items: center;
  gap: 14px;
  margin-top: 8px;
}

.container_common_splash_bottom_track {
  position: relative;
  overflow: hidden;
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.container_common_splash_bottom_bar {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: $paint-gradient;
  transform-origin: left center;
  animation: splash-progress-fill 1.75s cubic-bezier(0.37, 0, 0.63, 1) forwards;
}

.container_common_splash_bottom_skip {
  @include ink-focus;
  flex: 0 0 auto;
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 12px;
  transition: color 160ms ease, border-color 160ms ease, transform 160ms ease;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: translateY(-1px);
  }
}

@keyframes splash-card-enter {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes splash-progress-fill {
  from {
    transform: scaleX(0.08);
  }
  to {
    transform: scaleX(1);
  }
}

@media (max-width: 520px) {
  .container_common_splash_center_card {
    padding: 22px 16px;
  }
  .container_common_splash_bottom_footer {
    flex-direction: column;
    gap: 10px;
  }
  .container_common_splash_bottom_track {
    width: 100%;
  }
}
</style>
