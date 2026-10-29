<script setup lang="ts">
import type { GenerationDto, GenerationStatus, PageDto } from '#shared/types/api'

useHead({ title: '作画任务 · banana-image' })

const api = useApi()
const toast = useToast()
const status = ref<GenerationStatus | ''>('')
const page = ref(1)
const pageSize = 20
const result = ref<PageDto<GenerationDto> | null>(null)
const loading = ref(false)
const loadError = ref('')
const acting = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
let serial = 0

const statusOptions: { value: GenerationStatus | '', label: string }[] = [
  { value: '', label: '全部' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '进行中' },
  { value: 'succeeded', label: '成功' },
  { value: 'partial', label: '部分成功' },
  { value: 'failed', label: '失败' },
  { value: 'blocked', label: '被拦截' },
  { value: 'canceled', label: '已取消' },
]
const statusLabel = (value: GenerationStatus) => statusOptions.find(item => item.value === value)?.label ?? value
const totalPages = computed(() => Math.max(1, Math.ceil((result.value?.total ?? 0) / pageSize)))
const hasActive = computed(() => result.value?.items.some(item => ['queued', 'running'].includes(item.status)) ?? false)

async function load(silent = false) {
  const current = ++serial
  clearTimeout(timer)
  if (!silent) loading.value = true
  try {
    const data = await api<PageDto<GenerationDto>>('/api/generations', { query: { status: status.value || undefined, page: page.value, size: pageSize } })
    if (current !== serial) return
    result.value = data
    loadError.value = ''
  } catch (error) {
    if (current === serial) loadError.value = apiErrorMessage(error)
  } finally {
    if (current === serial) {
      loading.value = false
      if (hasActive.value) timer = setTimeout(() => void load(true), 2500)
    }
  }
}

async function act(task: GenerationDto, action: 'cancel' | 'retry') {
  acting.value = `${action}:${task.id}`
  try {
    const data = await api<{ id: string }>(`/api/generations/${task.id}/${action}`, { method: 'POST' })
    toast.show(action === 'cancel' ? '任务已取消。' : `已重新提交为任务 #${data.id}。`, 'success')
    await load(true)
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  } finally {
    acting.value = ''
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

watch(status, () => {
  page.value = 1
  void load()
})
watch(page, () => void load())
onMounted(() => void load())
onUnmounted(() => {
  serial += 1
  clearTimeout(timer)
})
</script>

<template>
  <section class="container_tasks_page_main_wrap">
    <header class="container_tasks_header_top_bar"><p class="container_tasks_header_top_eyebrow">THE PROCESS</p><h1 class="container_tasks_header_top_title">作画任务</h1><p class="container_tasks_header_top_subtitle">每一笔进展都有迹可循。</p></header>

    <div class="container_tasks_filter_top_bar" role="tablist" aria-label="按状态筛选">
      <button v-for="option in statusOptions" :key="option.value" class="container_tasks_filter_top_chip" :class="{ 'is-active': status === option.value }" type="button" role="tab" :aria-selected="status === option.value" @click="status = option.value">{{ option.label }}</button>
      <button class="container_tasks_filter_top_refresh" type="button" :disabled="loading" @click="load()">刷新</button>
    </div>

    <div class="container_tasks_list_main_table">
      <CommonEmpty v-if="loadError && !result" title="任务列表加载失败" :description="loadError"><CommonPaintButton variant="secondary" @click="load()">重试</CommonPaintButton></CommonEmpty>
      <p v-else-if="loading && !result" class="container_tasks_list_main_loading">正在读取任务…</p>
      <CommonEmpty v-else-if="!result?.items.length" title="还没有作画任务" description="提交生成后，可在这里查看排队、进度与失败原因。" />
      <template v-else>
        <article v-for="task in result.items" :key="task.id" class="container_tasks_list_item_row">
          <div class="container_tasks_list_item_thumbs">
            <NuxtLink v-for="image in task.images.slice(0, 4)" :key="image.id" :to="`/image/${image.id}`"><img :src="image.thumbUrl" alt="生成结果" loading="lazy"></NuxtLink>
            <span v-if="!task.images.length" class="container_tasks_list_item_placeholder">#{{ task.id }}</span>
          </div>
          <div class="container_tasks_list_item_body">
            <p class="container_tasks_list_item_prompt" :title="task.prompt">{{ task.prompt }}</p>
            <p class="container_tasks_list_item_meta">#{{ task.id }} · {{ task.model }} · {{ task.aspectRatio }} · {{ task.imageSize }} · {{ task.images.length }}/{{ task.count }} 张 · {{ formatTime(task.createdAt) }}<template v-if="Number(task.costUsd) > 0"> · ${{ Number(task.costUsd).toFixed(4) }}</template></p>
            <details v-if="task.errorMessage" class="container_tasks_list_item_error"><summary>{{ task.errorCode ?? '错误' }}</summary><p>{{ task.errorMessage }}</p></details>
          </div>
          <div class="container_tasks_list_item_side">
            <span class="container_tasks_list_item_status" :data-status="task.status">{{ statusLabel(task.status) }}</span>
            <button v-if="task.status === 'queued'" class="container_tasks_list_item_cancel" type="button" :disabled="Boolean(acting)" @click="act(task, 'cancel')">取消</button>
            <button v-if="['failed', 'partial', 'canceled'].includes(task.status)" class="container_tasks_list_item_retry" type="button" :disabled="Boolean(acting)" @click="act(task, 'retry')">重试</button>
          </div>
        </article>
        <nav v-if="totalPages > 1" class="container_tasks_list_bottom_pager" aria-label="分页">
          <button class="container_tasks_list_bottom_btn" type="button" :disabled="page <= 1" @click="page -= 1">上一页</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button class="container_tasks_list_bottom_btn" type="button" :disabled="page >= totalPages" @click="page += 1">下一页</button>
        </nav>
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.container_tasks_page_main_wrap { max-width: 1400px; margin: 0 auto; }
.container_tasks_header_top_bar { margin-bottom: 22px; }
.container_tasks_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_tasks_header_top_title { margin: 3px 0; font-family: $font-display; font-size: 40px; font-weight: 500; }
.container_tasks_header_top_subtitle { margin: 0; color: var(--color-ink-soft); }
.container_tasks_filter_top_bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }

.container_tasks_filter_top_chip,
.container_tasks_filter_top_refresh,
.container_tasks_list_bottom_btn,
.container_tasks_list_item_cancel,
.container_tasks_list_item_retry {
  @include ink-focus;
  padding: 7px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 13px;

  &:disabled { cursor: not-allowed; opacity: .5; }
  &.is-active { background: var(--color-chip-active); color: var(--color-ink); font-weight: 700; }
}

.container_tasks_filter_top_refresh { margin-left: auto; }
.container_tasks_list_main_table { @include paper-panel; min-height: 420px; padding: 8px 18px; }
.container_tasks_list_main_loading { padding: 40px; color: var(--color-ink-soft); text-align: center; }

.container_tasks_list_item_row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 16px 0;
  border-bottom: 1px dashed var(--color-border);

  &:last-of-type { border-bottom: 0; }
}

.container_tasks_list_item_thumbs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
.container_tasks_list_item_thumbs img { width: 100%; aspect-ratio: 1; border-radius: 6px; object-fit: cover; }
.container_tasks_list_item_placeholder { display: grid; grid-column: 1 / -1; height: 72px; place-items: center; border-radius: 8px; background: var(--color-chip-active); color: var(--color-ink-soft); font-size: 12px; }
.container_tasks_list_item_prompt { overflow: hidden; margin: 0; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.container_tasks_list_item_meta { margin: 4px 0 0; color: var(--color-ink-soft); font-size: 12px; }
.container_tasks_list_item_error { margin-top: 6px; color: var(--color-danger); font-size: 12px; }
.container_tasks_list_item_side { display: flex; align-items: center; gap: 8px; }

.container_tasks_list_item_status {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--color-chip-active);
  color: var(--color-ink-soft);
  font-size: 12px;
  white-space: nowrap;

  &[data-status='succeeded'] { color: var(--color-success); }
  &[data-status='failed'], &[data-status='blocked'] { color: var(--color-danger); }
  &[data-status='running'], &[data-status='queued'] { color: var(--color-primary); }
}

.container_tasks_list_bottom_pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding: 16px 0 8px; color: var(--color-ink-soft); font-size: 13px; }

@media (max-width: 760px) {
  .container_tasks_header_top_title { font-size: 32px; }
  .container_tasks_list_item_row { grid-template-columns: 84px minmax(0, 1fr); }
  .container_tasks_list_item_side { grid-column: 1 / -1; justify-content: flex-end; }
}
</style>
