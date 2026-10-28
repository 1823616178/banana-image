<template>
  <section class="container_gallery_page_main_wrap">
    <header class="container_gallery_header_top_bar"><p class="container_gallery_header_top_eyebrow">THE COLLECTION</p><h1 class="container_gallery_header_top_title">作品画廊</h1><p class="container_gallery_header_top_subtitle">把每一次灵感，装裱成可以重访的风景。</p></header>
    <div class="container_gallery_grid_main_masonry"><CommonEmpty title="画廊正在布置中" description="生成接口接通后，你的作品会在这里按时间陈列。"><CommonPaintButton variant="secondary" @click="navigateTo('/')">去创作第一幅</CommonPaintButton></CommonEmpty></div>
  </section>
</template>

<style scoped lang="scss">
.container_gallery_page_main_wrap { max-width: 1400px; margin: 0 auto; }
.container_gallery_header_top_bar { margin-bottom: 26px; }
.container_gallery_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_gallery_header_top_title { margin: 3px 0; font-family: $font-display; font-size: 40px; font-weight: 500; }
.container_gallery_header_top_subtitle { margin: 0; color: var(--color-ink-soft); }
.container_gallery_grid_main_masonry { @include paper-panel; min-height: 480px; }
</style>
