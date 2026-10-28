<template>
  <div class="container_layout_page_main_canvas">
    <LayoutNavBar />
    <main class="container_layout_page_main_wrap">
      <slot />
    </main>
    <CommonToast />
  </div>
</template>

<style scoped lang="scss">
.container_layout_page_main_canvas {
  min-height: 100vh;
}

.container_layout_page_main_wrap {
  width: min(1520px, 100%);
  margin: 0 auto;
  padding: clamp(22px, 3vw, 44px) clamp(16px, 4vw, 58px) 60px;
  animation: page-enter 360ms ease both;
}
</style>
