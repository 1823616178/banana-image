<script setup lang="ts">
import type { ImageDto } from '#shared/types/api'

interface ImageDetail extends ImageDto {
  finalPrompt: string | null
  count: number | null
  mode: 'text2img' | 'edit' | null
  costUsd: string | null
  durationMs: number | null
  references: ImageDto[]
}

const route = useRoute()
const api = useApi()
const toast = useToast()
const id = computed(() => String(route.params.id ?? ''))
const busy = ref<'' | 'favorite' | 'regenerate' | 'delete'>('')

const { data: image, error, refresh } = await useAsyncData(`image-${id.value}`, () => api<ImageDetail>(`/api/images/${id.value}`), { watch: [id] })
useHead({ title: () => image.value ? `作品 #${image.value.id} · banana-image` : '作品详情 · banana-image' })

const params = computed(() => {
  const item = image.value
  if (!item) return []
  return [
    ['模型', item.model ?? '—'],
    ['比例', item.aspectRatio ?? '—'],
    ['分辨率', item.imageSize ?? '—'],
    ['尺寸', `${item.width} × ${item.height}`],
    ['大小', `${(item.bytes / 1024 / 1024).toFixed(2)} MB`],
    ['模式', item.source === 'upload' ? '上传' : item.mode === 'edit' ? '参考图编辑' : '文生图'],
    ['费用', item.costUsd ? `$${Number(item.costUsd).toFixed(4)}` : '—'],
    ['耗时', item.durationMs ? `${(item.durationMs / 1000).toFixed(1)} 秒` : '—'],
    ['创建时间', new Date(item.createdAt).toLocaleString('zh-CN')],
  ]
})

async function toggleFavorite() {
  if (!image.value || busy.value) return
  busy.value = 'favorite'
  try {
    const next = !image.value.isFavorite
    await api(`/api/images/${image.value.id}/favorite`, { method: 'PATCH', body: { favorite: next } })
    image.value.isFavorite = next
  } catch (failure) {
    toast.show(apiErrorMessage(failure), 'error')
  } finally {
    busy.value = ''
  }
}

async function regenerate() {
  if (!image.value || busy.value) return
  busy.value = 'regenerate'
  try {
    const result = await api<{ id: string }>(`/api/images/${image.value.id}/regenerate`, { method: 'POST' })
    localStorage.setItem('banana-active-generation', result.id)
    toast.show('已用相同参数重新入队。', 'success')
    await navigateTo('/')
  } catch (failure) {
    toast.show(apiErrorMessage(failure), 'error')
  } finally {
    busy.value = ''
  }
}

async function remove() {
  if (!image.value || busy.value) return
  if (!window.confirm('确定删除这幅作品吗？原图与缩略图会从磁盘移除，无法恢复。')) return
  busy.value = 'delete'
  try {
    await api(`/api/images/${image.value.id}`, { method: 'DELETE' })
    toast.show('作品已删除。', 'success')
    await navigateTo('/gallery')
  } catch (failure) {
    toast.show(apiErrorMessage(failure), 'error')
  } finally {
    busy.value = ''
  }
}

async function copyPrompt() {
  if (!image.value?.prompt) return
  try {
    await navigator.clipboard.writeText(image.value.prompt)
    toast.show('提示词已复制。', 'success')
  } catch {
    toast.show('复制失败，请手动选择文本。', 'error')
  }
}
</script>

<template>
  <section class="container_detail_page_main_wrap">
    <NuxtLink class="container_detail_header_top_back" to="/gallery">← 返回画廊</NuxtLink>

    <div v-if="error || !image" class="container_detail_viewer_main_empty">
      <CommonEmpty title="找不到这幅作品" :description="error ? apiErrorMessage(error) : '它可能已被删除，或不属于当前账号。'">
        <CommonPaintButton variant="secondary" @click="refresh()">重试</CommonPaintButton>
      </CommonEmpty>
    </div>

    <div v-else class="container_detail_layout_main_grid">
      <figure class="container_detail_viewer_main_frame">
        <a :href="image.url" target="_blank" rel="noopener"><img class="container_detail_viewer_main_image" :src="image.url" :alt="image.prompt ?? 'AI 画作'" :width="image.width" :height="image.height"></a>
      </figure>

      <aside class="container_detail_meta_side_panel">
        <h1 class="container_detail_meta_side_title">作品 #{{ image.id }}</h1>
        <div class="container_detail_meta_side_prompt">
          <p class="container_detail_meta_side_label">提示词</p>
          <p class="container_detail_meta_side_text">{{ image.prompt ?? '（上传的参考图，没有提示词）' }}</p>
          <button v-if="image.prompt" class="container_detail_meta_side_copy" type="button" @click="copyPrompt">复制提示词</button>
          <details v-if="image.finalPrompt && image.finalPrompt !== image.prompt" class="container_detail_meta_side_final">
            <summary>实际发送的提示词</summary>
            <p>{{ image.finalPrompt }}</p>
          </details>
        </div>

        <dl class="container_detail_meta_side_params">
          <template v-for="[key, value] in params" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template>
        </dl>

        <div v-if="image.references.length" class="container_detail_meta_side_refs">
          <p class="container_detail_meta_side_label">参考图</p>
          <div class="container_detail_meta_side_thumbs">
            <NuxtLink v-for="item in image.references" :key="item.id" :to="`/image/${item.id}`"><img :src="item.thumbUrl" alt="参考图" loading="lazy"></NuxtLink>
          </div>
        </div>

        <div class="container_detail_actions_side_group">
          <a class="container_detail_actions_side_download" :href="image.url" :download="`banana-image-${image.id}`">下载原图</a>
          <CommonPaintButton variant="secondary" :loading="busy === 'favorite'" @click="toggleFavorite">{{ image.isFavorite ? '★ 已收藏' : '☆ 收藏' }}</CommonPaintButton>
          <CommonPaintButton v-if="image.generationId" class="container_detail_actions_side_regenerate" :loading="busy === 'regenerate'" @click="regenerate">再次生成</CommonPaintButton>
          <CommonPaintButton class="container_detail_actions_side_edit" variant="secondary" @click="navigateTo({ path: '/', query: { ref: image.id } })">以此编辑</CommonPaintButton>
          <CommonPaintButton class="container_detail_actions_side_delete" variant="danger" :loading="busy === 'delete'" @click="remove">删除</CommonPaintButton>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped lang="scss">
.container_detail_page_main_wrap { max-width: 1400px; margin: 0 auto; }
.container_detail_header_top_back { @include ink-focus; display: inline-block; margin-bottom: 18px; color: var(--color-ink-soft); font-size: 14px; }
.container_detail_viewer_main_empty { @include paper-panel; min-height: 420px; }
.container_detail_layout_main_grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; align-items: start; gap: 28px; }

.container_detail_viewer_main_frame {
  @include paper-panel;
  display: flex;
  justify-content: center;
  margin: 0;
  padding: 18px;
  border-radius: 20px 16px 22px 15px;
}

.container_detail_viewer_main_image { display: block; max-width: 100%; max-height: 78vh; height: auto; border-radius: 8px; object-fit: contain; }
.container_detail_meta_side_panel { @include paper-panel; display: grid; gap: 18px; padding: 24px; border-radius: 18px 22px 17px 24px; }
.container_detail_meta_side_title { margin: 0; font-family: $font-display; font-size: 28px; font-weight: 500; }
.container_detail_meta_side_label { margin: 0 0 6px; color: var(--color-ink-soft); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.container_detail_meta_side_text { margin: 0; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }
.container_detail_meta_side_copy { @include ink-focus; margin-top: 6px; padding: 0; border: 0; background: none; color: var(--color-primary); cursor: pointer; font-size: 13px; }
.container_detail_meta_side_final { margin-top: 8px; color: var(--color-ink-soft); font-size: 13px; }

.container_detail_meta_side_params {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 7px 14px;
  margin: 0;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border);
  font-size: 13px;

  dt { color: var(--color-ink-soft); }
  dd { margin: 0; word-break: break-all; }
}

.container_detail_meta_side_thumbs { display: flex; flex-wrap: wrap; gap: 8px; }
.container_detail_meta_side_thumbs img { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; }
.container_detail_actions_side_group { display: grid; gap: 10px; }
.container_detail_actions_side_download { @include ink-focus; padding: 10px; border: 1px dashed var(--color-border); border-radius: 12px; color: var(--color-primary); font-weight: 700; text-align: center; }

@media (max-width: 960px) {
  .container_detail_layout_main_grid { grid-template-columns: 1fr; }
}
</style>
