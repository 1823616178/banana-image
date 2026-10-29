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
    <CommonBrushLoading class="container_common_empty_center_brush" size="sm" hide-text />
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
  padding: 28px 20px 36px;
  text-align: center;
}

.container_common_empty_center_brush {
  margin-bottom: 6px;
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
