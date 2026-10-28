<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: '画布还是空的',
  description: '写下第一句灵感，让颜料在这里落脚。',
})
</script>

<template>
  <div class="container_common_empty_center_tip">
    <svg class="container_common_empty_center_icon" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M25 71C40 60 57 38 70 17" stroke="currentColor" stroke-width="7" stroke-linecap="round" />
      <path d="M19 78C28 68 38 68 42 76C35 86 25 89 19 78Z" fill="currentColor" opacity=".75" />
      <path d="M63 22L72 12L82 22L74 32Z" fill="currentColor" />
      <path d="M17 26C28 17 38 20 41 30C32 37 22 37 17 26Z" fill="currentColor" opacity=".22" />
    </svg>
    <h2 class="container_common_empty_center_title">{{ title }}</h2>
    <p class="container_common_empty_center_description">{{ description }}</p>
    <div v-if="$slots.default" class="container_common_empty_center_actions"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
.container_common_empty_center_tip {
  display: flex;
  min-height: 300px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 36px 20px;
  text-align: center;
}

.container_common_empty_center_icon {
  width: 90px;
  margin-bottom: 12px;
  color: var(--color-gold);
}

.container_common_empty_center_title {
  margin: 0;
  font-family: $font-display;
  font-size: 26px;
  font-weight: 500;
}

.container_common_empty_center_description {
  max-width: 360px;
  margin: 8px 0 0;
  color: var(--color-ink-soft);
}

.container_common_empty_center_actions {
  margin-top: 20px;
}
</style>
