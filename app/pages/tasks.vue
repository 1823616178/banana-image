<template>
  <section class="container_tasks_page_main_wrap">
    <header class="container_tasks_header_top_bar"><p class="container_tasks_header_top_eyebrow">THE PROCESS</p><h1 class="container_tasks_header_top_title">作画任务</h1><p class="container_tasks_header_top_subtitle">每一笔进展都有迹可循。</p></header>
    <div class="container_tasks_list_main_table"><CommonEmpty title="还没有作画任务" description="提交生成后，可在这里查看排队、进度与失败原因。" /></div>
  </section>
</template>

<style scoped lang="scss">
.container_tasks_page_main_wrap { max-width: 1400px; margin: 0 auto; }
.container_tasks_header_top_bar { margin-bottom: 26px; }
.container_tasks_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_tasks_header_top_title { margin: 3px 0; font-family: $font-display; font-size: 40px; font-weight: 500; }
.container_tasks_header_top_subtitle { margin: 0; color: var(--color-ink-soft); }
.container_tasks_list_main_table { @include paper-panel; min-height: 480px; }
</style>
