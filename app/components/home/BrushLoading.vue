<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: '颜料正在晕开，请稍候…' })
</script>

<template>
  <div class="container_home_result_center_loading" role="status">
    <div class="container_home_result_center_brush" aria-hidden="true">
      <svg viewBox="0 0 240 110" fill="none">
        <path class="container_home_result_center_stroke" d="M25 76C72 38 137 97 211 48" stroke="url(#paint-loading)" stroke-width="22" stroke-linecap="round" />
        <path d="M37 27L183 82" stroke="currentColor" stroke-width="8" stroke-linecap="round" />
        <path d="M176 75L209 87L198 99L168 83Z" fill="currentColor" />
        <defs><linearGradient id="paint-loading" x1="25" y1="50" x2="211" y2="50"><stop stop-color="#F2B629" /><stop offset=".48" stop-color="#D9482B" /><stop stop-color="#2E4A9E" offset="1" /></linearGradient></defs>
      </svg>
    </div>
    <p class="container_home_result_center_text">{{ label }}</p>
  </div>
</template>

<style scoped lang="scss">
.container_home_result_center_loading {
  display: grid;
  min-height: 300px;
  place-content: center;
  color: var(--color-ink-soft);
  text-align: center;
}

.container_home_result_center_brush {
  width: min(260px, 70vw);
  animation: brush-stroke 2.4s ease-in-out infinite;
}

.container_home_result_center_stroke {
  stroke-dasharray: 240;
  stroke-dashoffset: 240;
  animation: paint-reveal 2s ease-in-out infinite alternate;
}

.container_home_result_center_text {
  margin: 10px 0 0;
  letter-spacing: 0.06em;
}
</style>
