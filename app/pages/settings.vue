<template>
  <section class="container_settings_page_main_wrap">
    <header class="container_settings_header_top_bar"><p class="container_settings_header_top_eyebrow">THE STUDIO</p><h1 class="container_settings_header_top_title">画室设置</h1><p class="container_settings_header_top_subtitle">管理默认参数、预算与本地服务连接。</p></header>
    <div class="container_settings_form_main_wrap"><CommonEmpty title="设置面板正在准备中" description="数据库、Redis 与 Vertex 健康检查会首先在这里接通。" /></div>
  </section>
</template>

<style scoped lang="scss">
.container_settings_page_main_wrap { max-width: 1200px; margin: 0 auto; }
.container_settings_header_top_bar { margin-bottom: 26px; }
.container_settings_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_settings_header_top_title { margin: 3px 0; font-family: $font-display; font-size: 40px; font-weight: 500; }
.container_settings_header_top_subtitle { margin: 0; color: var(--color-ink-soft); }
.container_settings_form_main_wrap { @include paper-panel; min-height: 480px; }
</style>
