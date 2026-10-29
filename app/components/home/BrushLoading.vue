<script setup lang="ts">
withDefaults(defineProps<{
  label?: string
  sublabel?: string
  size?: 'sm' | 'md' | 'lg'
  hideText?: boolean
}>(), {
  label: '颜料正在晕开，请稍候…',
  sublabel: '画笔正沿着亚麻纹理层层铺陈色彩与光影',
  size: 'md',
  hideText: false,
})
</script>

<template>
  <CommonBrushLoading :label="label" :sublabel="sublabel" :size="size" :hide-text="hideText" />
</template>
