<script setup lang="ts">
import { ASPECT_RATIOS } from '#shared/config/models'
import type { ImageDto, ModelDto, PageDto } from '#shared/types/api'

useHead({ title: '作品画廊 · banana-image' })

const api = useApi()
const toast = useToast()
const q = ref('')
const model = ref('')
const ratio = ref('')
const favoriteOnly = ref(false)
const sort = ref<'newest' | 'oldest'>('newest')
const items = ref<ImageDto[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadError = ref('')
const pageSize = 24
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | undefined
let searchTimer: ReturnType<typeof setTimeout> | undefined
let requestSerial = 0

const { data: models } = await useAsyncData('gallery-models', () => api<ModelDto[]>('/api/models').catch(() => [] as ModelDto[]))
const hasMore = computed(() => items.value.length < total.value)

async function load(reset: boolean) {
  if (loading.value && !reset) return
  const serial = ++requestSerial
  loading.value = true
  loadError.value = ''
  const nextPage = reset ? 1 : page.value + 1
  try {
    const result = await api<PageDto<ImageDto>>('/api/images', {
      query: {
        q: q.value.trim() || undefined,
        model: model.value || undefined,
        ratio: ratio.value || undefined,
        favorite: favoriteOnly.value ? 'true' : undefined,
        sort: sort.value,
        page: nextPage,
        size: pageSize,
      },
    })
    if (serial !== requestSerial) return
    items.value = reset ? result.items : [...items.value, ...result.items.filter(item => !items.value.some(existing => existing.id === item.id))]
    total.value = result.total
    page.value = nextPage
  } catch (error) {
    if (serial === requestSerial) loadError.value = apiErrorMessage(error)
  } finally {
    if (serial === requestSerial) loading.value = false
  }
}

async function toggleFavorite(image: ImageDto) {
  const next = !image.isFavorite
  image.isFavorite = next
  try {
    await api(`/api/images/${image.id}/favorite`, { method: 'PATCH', body: { favorite: next } })
    if (favoriteOnly.value && !next) {
      items.value = items.value.filter(item => item.id !== image.id)
      total.value = Math.max(0, total.value - 1)
    }
  } catch (error) {
    image.isFavorite = !next
    toast.show(apiErrorMessage(error), 'error')
  }
}

watch([model, ratio, favoriteOnly, sort], () => void load(true))
watch(q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(true), 350)
})

onMounted(() => {
  void load(true)
  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting) && hasMore.value && !loading.value) void load(false)
  }, { rootMargin: '600px 0px' })
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
  clearTimeout(searchTimer)
})
</script>

<template>
  <section class="container_gallery_page_main_wrap">
    <header class="container_gallery_header_top_bar"><p class="container_gallery_header_top_eyebrow">THE COLLECTION</p><h1 class="container_gallery_header_top_title">作品画廊</h1><p class="container_gallery_header_top_subtitle">把每一次灵感，装裱成可以重访的风景。</p></header>

    <div class="container_gallery_filter_top_bar">
      <input v-model="q" class="container_gallery_filter_top_search" type="search" maxlength="200" placeholder="搜索提示词…" aria-label="搜索提示词">
      <select v-model="model" class="container_gallery_filter_top_select" aria-label="按模型筛选">
        <option value="">全部模型</option>
        <option v-for="item in models ?? []" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <select v-model="ratio" class="container_gallery_filter_top_select" aria-label="按比例筛选">
        <option value="">全部比例</option>
        <option v-for="item in ASPECT_RATIOS" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="sort" class="container_gallery_filter_top_select" aria-label="排序">
        <option value="newest">最新优先</option>
        <option value="oldest">最早优先</option>
      </select>
      <label class="container_gallery_filter_top_favorite"><input v-model="favoriteOnly" type="checkbox"> 只看收藏</label>
      <span class="container_gallery_filter_top_count">共 {{ total }} 幅</span>
    </div>

    <div v-if="items.length" class="container_gallery_grid_main_masonry">
      <article v-for="image in items" :key="image.id" class="container_gallery_card_item_wrap">
        <NuxtLink class="container_gallery_card_item_image" :to="`/image/${image.id}`">
          <img :src="image.thumbUrl" :alt="image.prompt ?? 'AI 画作'" :width="image.width" :height="image.height" loading="lazy">
        </NuxtLink>
        <footer class="container_gallery_card_item_footer">
          <p class="container_gallery_card_item_prompt" :title="image.prompt ?? ''">{{ image.prompt ?? '（无提示词）' }}</p>
          <button class="container_gallery_card_item_favorite" :class="{ 'is-active': image.isFavorite }" type="button" :aria-pressed="image.isFavorite" :aria-label="image.isFavorite ? '取消收藏' : '收藏'" @click="toggleFavorite(image)">{{ image.isFavorite ? '★' : '☆' }}</button>
        </footer>
      </article>
    </div>
    <div v-else-if="!loading" class="container_gallery_grid_main_empty">
      <CommonEmpty v-if="loadError" title="画廊暂时打不开" :description="loadError"><CommonPaintButton variant="secondary" @click="load(true)">重试</CommonPaintButton></CommonEmpty>
      <CommonEmpty v-else-if="q || model || ratio || favoriteOnly" title="没有符合条件的作品" description="换个关键词或筛选条件试试。" />
      <CommonEmpty v-else title="画廊还空着" description="完成第一幅作品后，它会按时间陈列在这里。"><CommonPaintButton variant="secondary" @click="navigateTo('/')">去创作第一幅</CommonPaintButton></CommonEmpty>
    </div>

    <div ref="sentinel" class="container_gallery_grid_bottom_more">
      <span v-if="loading">正在取画…</span>
      <CommonPaintButton v-else-if="hasMore" variant="ghost" @click="load(false)">加载更多</CommonPaintButton>
      <span v-else-if="items.length">已经到底了</span>
    </div>
  </section>
</template>

<style scoped lang="scss">
.container_gallery_page_main_wrap { max-width: 1400px; margin: 0 auto; }
.container_gallery_header_top_bar { margin-bottom: 22px; }
.container_gallery_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_gallery_header_top_title { margin: 3px 0; font-family: $font-display; font-size: 40px; font-weight: 500; }
.container_gallery_header_top_subtitle { margin: 0; color: var(--color-ink-soft); }

.container_gallery_filter_top_bar {
  @include paper-panel;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  padding: 14px 16px;
}

.container_gallery_filter_top_search,
.container_gallery_filter_top_select {
  @include ink-focus;
  min-height: 38px;
  padding: 7px 11px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-paper);
  color: var(--color-ink);
}

.container_gallery_filter_top_search { flex: 1 1 220px; }
.container_gallery_filter_top_favorite { display: inline-flex; align-items: center; gap: 6px; color: var(--color-ink-soft); cursor: pointer; font-size: 14px; }
.container_gallery_filter_top_count { margin-left: auto; color: var(--color-ink-soft); font-size: 13px; }

.container_gallery_grid_main_masonry {
  columns: 4 260px;
  column-gap: 18px;
}

.container_gallery_card_item_wrap {
  overflow: hidden;
  margin-bottom: 18px;
  break-inside: avoid;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-paper);
  box-shadow: $soft-shadow;
  transition: transform 160ms ease;

  &:hover { transform: translateY(-2px); }
}

.container_gallery_card_item_image { display: block; background: var(--color-chip-active); }
.container_gallery_card_item_image img { display: block; width: 100%; height: auto; }
.container_gallery_card_item_footer { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
.container_gallery_card_item_prompt { overflow: hidden; flex: 1; margin: 0; color: var(--color-ink-soft); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }

.container_gallery_card_item_favorite {
  @include ink-focus;
  padding: 2px 6px;
  border: 0;
  background: none;
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;

  &.is-active { color: var(--color-gold); }
}

.container_gallery_grid_main_empty { @include paper-panel; min-height: 420px; }
.container_gallery_grid_bottom_more { display: flex; min-height: 60px; align-items: center; justify-content: center; color: var(--color-ink-soft); font-size: 13px; }

@media (max-width: 760px) {
  .container_gallery_header_top_title { font-size: 32px; }
  .container_gallery_grid_main_masonry { columns: 2 150px; column-gap: 12px; }
  .container_gallery_filter_top_count { width: 100%; margin-left: 0; }
}
</style>
