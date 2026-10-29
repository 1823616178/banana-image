<script setup lang="ts">
const route = useRoute()
const { label, cycleTheme } = useTheme()
const { user, logout } = useAuth()

const links = [
  { to: '/', label: '创作' },
  { to: '/gallery', label: '画廊' },
  { to: '/tasks', label: '任务' },
  { to: '/settings', label: '设置' },
]
</script>

<template>
  <header class="container_layout_nav_top_bar">
    <NuxtLink class="container_layout_nav_left_logo" to="/" aria-label="banana-image 创作首页">
      <svg class="container_layout_nav_left_mark" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <path d="M12 9C13 26 22 33 35 26C30 39 12 39 8 24C6 18 7 12 12 9Z" fill="#F2B629" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M12 9L13 5M35 26L38 25" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
        <path d="M12 25C18 31 26 31 32 27" stroke="#D9482B" stroke-width="2" stroke-linecap="round" opacity=".8" />
      </svg>
      <span class="container_layout_nav_left_wordmark">banana<span>-image</span></span>
    </NuxtLink>

    <nav class="container_layout_nav_center_menu" aria-label="主导航">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        class="container_layout_nav_center_link"
        :class="{ 'is-active': route.path === link.to }"
        :to="link.to"
      >{{ link.label }}</NuxtLink>
    </nav>

    <div class="container_layout_nav_right_tools">
      <span v-if="user" class="container_layout_nav_right_user" :title="`当前用户：${user.username}`">{{ user.username }}</span>
      <button v-if="user" class="container_layout_nav_right_logout" type="button" @click="logout">退出</button>
    <button class="container_layout_nav_right_theme" type="button" :title="`主题：${label}`" :aria-label="`当前${label}，点击切换`" @click="cycleTheme">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.64 5.64L7.05 7.05M16.95 16.95L18.36 18.36M18.36 5.64L16.95 7.05M7.05 16.95L5.64 18.36" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7" /></svg>
      <span class="container_layout_nav_right_label">{{ label }}</span>
    </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.container_layout_nav_top_bar {
  position: sticky;
  z-index: 30;
  top: 0;
  display: grid;
  min-height: $nav-height;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 clamp(18px, 4vw, 58px);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-canvas) 88%, transparent);
  backdrop-filter: blur(16px);
}

.container_layout_nav_left_logo {
  @include ink-focus;
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
}

.container_layout_nav_left_mark { width: 38px; color: var(--color-ink); }

.container_layout_nav_left_wordmark {
  font-family: $font-accent;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.04em;

  span { color: var(--color-primary); }
}

.container_layout_nav_center_menu {
  display: flex;
  align-items: center;
  gap: 6px;
}

.container_layout_nav_center_link {
  @include ink-focus;
  position: relative;
  padding: 9px 17px;
  border-radius: 10px;
  color: var(--color-ink-soft);
  font-size: 15px;
  transition: color 160ms ease, background-color 160ms ease;

  &:hover { background: var(--color-chip-active); color: var(--color-ink); }
  &.is-active { color: var(--color-ink); font-weight: 700; }
  &.is-active::after {
    position: absolute;
    right: 18px;
    bottom: 3px;
    left: 18px;
    height: 3px;
    border-radius: 50%;
    background: $paint-gradient;
    content: '';
  }
}

.container_layout_nav_right_tools {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 8px;
}

.container_layout_nav_right_user {
  max-width: 120px;
  overflow: hidden;
  color: var(--color-ink-soft);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.container_layout_nav_right_logout {
  @include ink-focus;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 12px;

  &:hover { color: var(--color-danger); }
}

.container_layout_nav_right_theme {
  @include ink-focus;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 12px;

  svg { width: 18px; }
}

@media (max-width: 760px) {
  .container_layout_nav_top_bar {
    min-height: 66px;
    grid-template-columns: auto 1fr auto;
    padding: 0 14px;
  }
  .container_layout_nav_left_wordmark { display: none; }
  .container_layout_nav_left_mark { width: 34px; }
  .container_layout_nav_center_menu { justify-content: center; gap: 0; }
  .container_layout_nav_center_link { padding: 8px 11px; font-size: 14px; }
  .container_layout_nav_right_theme { padding: 7px; }
  .container_layout_nav_right_label { display: none; }
  .container_layout_nav_right_user { display: none; }
}

@media (max-width: 390px) {
  .container_layout_nav_center_link { padding: 8px; }
}
</style>
