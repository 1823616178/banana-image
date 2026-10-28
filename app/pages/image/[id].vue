<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <section class="container_detail_page_main_wrap">
    <div class="container_detail_viewer_main_frame"><CommonEmpty title="画作详情" :description="`正在等待作品 ${route.params.id} 的详情接口。`" /></div>
  </section>
</template>

<style scoped lang="scss">
.container_detail_page_main_wrap { max-width: 1200px; margin: 0 auto; }
.container_detail_viewer_main_frame { @include paper-panel; min-height: 560px; }
</style>
