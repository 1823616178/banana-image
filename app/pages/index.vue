<script setup lang="ts">
import { DEFAULT_MODELS, resolveModelCapabilities } from '#shared/config/models'
import type { ApiFailure, AspectRatio, GenerationDto, ImageDto, ImageSize, ModelDto, PresetDto, SettingsDto, TemplateDto } from '#shared/types/api'

const toast = useToast()
const api = useApi()
const route = useRoute()
const { data: remoteModels } = await useAsyncData('home-models', () => api<ModelDto[]>('/api/models').catch(() => null))
const { data: userSettings } = await useAsyncData('home-settings', () => api<SettingsDto>('/api/settings').catch(() => null))
const models = computed<ModelDto[]>(() => remoteModels.value?.length ? remoteModels.value : DEFAULT_MODELS.filter(item => resolveModelCapabilities(item.id).provider !== 'sensenova').map(item => ({ ...item, officialPrices: item.prices, tokenPrices: item.tokenPrices ?? null, priceSource: item.priceSource ?? null, priceCheckedAt: item.priceCheckedAt ?? null })))
const { data: presets } = await useAsyncData('home-presets', () => api<PresetDto[]>('/api/presets').catch(() => [] as PresetDto[]))
const { data: templates } = await useAsyncData('home-templates', () => api<TemplateDto[]>('/api/templates').catch(() => [] as TemplateDto[]))
const stylePresetId = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const prompt = ref('')
const model = ref(userSettings.value?.defaults.model ?? DEFAULT_MODELS[0]!.id)
const aspectRatio = ref<AspectRatio>(userSettings.value?.defaults.aspectRatio ?? '1:1')
const imageSize = ref<ImageSize>(userSettings.value?.defaults.imageSize ?? '1K')
const count = ref(userSettings.value?.defaults.count ?? 1)
const requestPending = ref(false)
const activeGeneration = ref<GenerationDto | null>(null)
const activeGenerationKey = 'banana-active-generation'
let pollTimer: ReturnType<typeof setTimeout> | undefined
let pollSerial = 0

const modelOptions = computed(() => models.value.map(item => ({
  value: item.id,
  label: item.name,
  caption: formatImagePrice(item.prices[imageSize.value]),
  hint: `${item.description}${item.tokenPrices ? `｜输入 $${item.tokenPrices.inputPerMillion}/百万 tokens，图片输出 $${item.tokenPrices.imageOutputPerMillion}/百万 tokens` : ''}`,
})))
const countOptions = [1, 2, 3, 4].map(value => ({ value, label: `${value} 张` }))
const selectedModel = computed(() => models.value.find(item => item.id === model.value) ?? models.value[0]!)
const capabilities = computed(() => resolveModelCapabilities(selectedModel.value.id, selectedModel.value))
const ratioOptions = computed(() => capabilities.value.supportedAspectRatios.map(value => ({ value, label: value })))
const sizeOptions = computed(() => capabilities.value.supportedImageSizes.map(value => ({ value, label: value })))

watch([model, selectedModel, aspectRatio, imageSize], () => {
  model.value = selectedModel.value.id
  if (!capabilities.value.supportedAspectRatios.includes(aspectRatio.value)) aspectRatio.value = '1:1'
  if (!capabilities.value.supportedImageSizes.includes(imageSize.value)) imageSize.value = '1K'
}, { immediate: true })
const {
  references,
  historyOptions,
  uploading,
  dragging,
  addReference,
  removeReference,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
} = useReferenceUploads(() => capabilities.value.maxReferenceImages)
const unitPrice = computed(() => selectedModel.value.prices[imageSize.value] ?? 0)
const isGenerating = computed(() => requestPending.value || ['queued', 'running'].includes(activeGeneration.value?.status ?? ''))
const resultTitle = computed(() => activeGeneration.value ? `任务 #${activeGeneration.value.id}` : '等待第一笔色彩')

function errorMessage(error: unknown) {
  const failure = error as { data?: ApiFailure, message?: string, statusCode?: number, status?: number }
  return failure.data?.message ?? failure.message ?? '操作失败，请稍后重试'
}

function isMissingGeneration(error: unknown) {
  const failure = error as { statusCode?: number, status?: number }
  return (failure.statusCode ?? failure.status) === 404
}

function rememberGeneration(id: string) {
  localStorage.setItem(activeGenerationKey, id)
}

function forgetGeneration() {
  localStorage.removeItem(activeGenerationKey)
}

function showGeneration(generation: GenerationDto) {
  activeGeneration.value = generation
  if (prompt.value.trim()) return
  prompt.value = generation.prompt
  model.value = generation.model
  aspectRatio.value = generation.aspectRatio
  imageSize.value = generation.imageSize
  count.value = generation.count
}

function startPolling(id: string, announce: boolean) {
  const serial = ++pollSerial
  clearTimeout(pollTimer)
  void pollGeneration(id, announce, serial)
}

async function pollGeneration(id: string, announce: boolean, serial: number) {
  try {
    const response = { data: await api<GenerationDto>(`/api/generations/${id}`) }
    if (serial !== pollSerial) return
    rememberGeneration(id)
    showGeneration(response.data)
    if (['queued', 'running'].includes(response.data.status)) {
      pollTimer = setTimeout(() => void pollGeneration(id, true, serial), 1500)
      return
    }
    if (!announce) return
    if (response.data.status === 'succeeded' || response.data.status === 'partial') {
      toast.show('画作已完成，颜料已经干透。', 'success')
    } else {
      toast.show(response.data.errorMessage ?? '生成未完成，请到任务页查看原因。', 'error')
    }
  } catch (error) {
    if (serial !== pollSerial) return
    if (isMissingGeneration(error)) forgetGeneration()
    if (announce) toast.show(errorMessage(error), 'error')
  }
}

async function generate() {
  if (!prompt.value.trim()) {
    toast.show('先写下一点灵感，再开始作画。', 'info')
    return
  }
  if (isGenerating.value) return

  requestPending.value = true
  const previous = activeGeneration.value
  activeGeneration.value = null
  try {
    const response = { data: await api<{ id: string }>('/api/generations', {
      method: 'POST',
      body: {
        prompt: prompt.value.trim(),
        model: model.value,
        aspectRatio: aspectRatio.value,
        imageSize: imageSize.value,
        count: count.value,
        refImageIds: references.value.map(item => item.id),
        stylePresetId: stylePresetId.value || null,
      },
    }) }
    rememberGeneration(response.data.id)
    toast.show('任务已入队，画笔开始蘸取颜料。', 'success')
    startPolling(response.data.id, true)
  } catch (error) {
    activeGeneration.value = previous
    toast.show(errorMessage(error), 'error')
  } finally {
    requestPending.value = false
  }
}

function onPromptKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void generate()
  }
}

function usePrompt(text: string, mode: 'fill' | 'append') {
  const current = prompt.value.trim()
  prompt.value = (mode === 'append' && current ? `${current}\n${text}` : text).slice(0, 4000)
}

function markTemplateUsed(id: string) {
  void api(`/api/templates/${id}/use`, { method: 'POST' }).catch(() => {})
}

onMounted(async () => {
  const refId = typeof route.query.ref === 'string' ? route.query.ref : ''
  if (/^\d{1,20}$/.test(refId)) {
    try {
      addReference(await api<ImageDto>(`/api/images/${refId}`))
    } catch (error) {
      toast.show(apiErrorMessage(error), 'error')
    }
  }
  const id = localStorage.getItem(activeGenerationKey) ?? ''
  if (/^\d{1,20}$/.test(id) && id !== '0') startPolling(id, false)
})

onUnmounted(() => {
  pollSerial += 1
  clearTimeout(pollTimer)
})
</script>

<template>
  <div class="container_home_page_main_wrap">
    <section class="container_home_header_top_hero">
      <div class="container_home_header_top_copy">
        <p class="container_home_header_top_eyebrow">YOUR LOCAL ATELIER</p>
        <h1 class="container_home_header_top_title">让灵感，落进<span>颜料</span>里。</h1>
        <p class="container_home_header_top_subtitle">一方本地画布，一点 AI 魔法。写下想象，剩下的交给色彩。</p>
      </div>
      <svg class="container_home_header_top_splash" viewBox="0 0 160 110" fill="none" aria-hidden="true">
        <path d="M19 75C41 21 105 15 139 45C113 40 84 70 69 91C49 104 27 96 19 75Z" fill="#F2B629" opacity=".28" />
        <path d="M51 81C74 53 94 36 135 37" stroke="#D9482B" stroke-width="11" stroke-linecap="round" opacity=".34" />
        <circle cx="132" cy="79" r="8" fill="#2E4A9E" opacity=".36" />
        <circle cx="26" cy="29" r="4" fill="#C8557A" opacity=".5" />
      </svg>
    </section>

    <div class="container_home_workspace_main_grid">
      <aside class="container_home_options_left_panel">
        <div class="container_home_prompt_top_group">
          <label class="container_home_prompt_top_label" for="creation-prompt">此刻，你想画什么？</label>
          <textarea
            id="creation-prompt"
            v-model="prompt"
            class="container_home_prompt_top_input"
            maxlength="4000"
            rows="5"
            placeholder="例如：E-commerce main photo of a model wearing the wig from the reference image, pure white background…（上传假发图可获得 AI 推荐提示词）"
            @keydown="onPromptKeydown"
          />
          <div class="container_home_prompt_top_tools">
            <select v-model="stylePresetId" class="container_home_prompt_top_preset" aria-label="风格预设">
              <option value="">不使用风格预设</option>
              <option v-for="item in presets ?? []" :key="item.id" :value="item.id" :title="item.promptSuffix">{{ item.shared ? '' : '★ ' }}{{ item.name }}</option>
            </select>
          </div>
          <div class="container_home_prompt_top_hint"><span>Ctrl + Enter 开始作画</span><span>{{ prompt.length }} / 4000</span></div>
        </div>

        <div v-if="capabilities.maxReferenceImages > 0" class="container_home_upload_side_group">
          <p class="container_home_upload_side_label">参考图（可选，支持拖拽或 Ctrl+V 粘贴图片）</p>
          <div v-if="historyOptions.length" class="container_home_history_top_wrap">
            <span class="container_home_history_top_title">最近上传 · 点击复用</span>
            <div class="container_home_history_main_list">
              <button v-for="(item, index) in historyOptions" :key="item.id" class="container_home_history_item_btn" type="button" :style="{ animationDelay: `${index * 55}ms` }" title="添加为参考图" aria-label="添加为参考图" @click="addReference(item)">
                <img :src="item.thumbUrl" alt="历史上传图" loading="lazy">
              </button>
            </div>
          </div>
          <div class="container_home_upload_side_dropzone" :class="{ 'is-loading': uploading, 'is-dragging': dragging }" @dragover="onDragOver" @dragleave="onDragLeave" @drop.prevent="onDrop">
            <div v-for="item in references" :key="item.id" class="container_home_upload_side_thumb">
              <img :src="item.thumbUrl" alt="参考图">
              <button class="container_home_upload_side_remove" type="button" aria-label="移除参考图" @click="removeReference(item.id)">×</button>
            </div>
            <button class="container_home_upload_side_add" type="button" :disabled="uploading" @click="fileInput?.click()">{{ uploading ? '上传中…' : '+ 添加' }}</button>
            <input ref="fileInput" class="container_home_upload_side_file" type="file" accept="image/png,image/jpeg,image/webp" multiple @change="onFileChange">
          </div>
        </div>

        <p v-else class="container_home_upload_side_label">当前模型仅支持文字生成</p>

        <HomePromptPanel :references="references" :templates="templates ?? []" @use="usePrompt" @template-used="markTemplateUsed" />

        <HomeOptionChips v-model="model" class="container_home_options_side_model" label="选择模型" :options="modelOptions" />
        <HomeOptionChips v-model="aspectRatio" label="画布比例" :options="ratioOptions" />
        <HomeOptionChips v-model="imageSize" label="分辨率" :options="sizeOptions" />
        <HomeOptionChips v-model="count" label="生成张数" :options="countOptions" />

        <div class="container_home_options_bottom_cost">
          <span class="container_home_options_bottom_label">本次预估</span>
          <strong class="container_home_options_bottom_value">{{ unitPrice > 0 ? `$${(unitPrice * count).toFixed(3)}` : '单价待确认' }}</strong>
          <span class="container_home_options_bottom_note">估算仅供参考，以 GCP 账单为准</span>
        </div>

        <CommonPaintButton class="container_home_actions_bottom_generate" :loading="requestPending" :disabled="isGenerating" @click="generate">
          {{ isGenerating ? '正在作画…' : '开始作画' }}
          <svg viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M4 17L15 6M13 4L17 3L18 7L16 9L12 8L13 4Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </CommonPaintButton>
      </aside>

      <section class="container_home_result_center_canvas">
        <header class="container_home_result_center_header">
          <div><p class="container_home_result_center_eyebrow">THE CANVAS</p><h2 class="container_home_result_center_title">{{ resultTitle }}</h2></div>
          <span v-if="activeGeneration" class="container_home_result_center_status" :data-status="activeGeneration.status">{{ activeGeneration.status }}</span>
        </header>

        <CommonBrushLoading v-if="isGenerating" />
        <div v-else-if="activeGeneration?.images.length" class="container_home_result_center_grid">
          <article v-for="image in activeGeneration.images" :key="image.id" class="container_home_result_center_item">
            <NuxtLink class="container_home_result_center_image" :to="`/image/${image.id}`"><img :src="image.thumbUrl" :alt="image.prompt ?? 'AI 生成画作'" loading="lazy"></NuxtLink>
            <footer class="container_home_result_center_actions">
              <a class="container_home_result_center_download" :href="`${image.url}?download=1`" download>下载</a>
              <NuxtLink class="container_home_result_center_detail" :to="`/image/${image.id}`">查看详情</NuxtLink>
            </footer>
          </article>
        </div>
        <div v-else-if="activeGeneration?.errorMessage" class="container_home_result_center_error">
          <CommonEmpty title="这次没有完成作画" :description="activeGeneration.errorMessage" />
        </div>
        <CommonEmpty v-else />
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.container_home_page_main_wrap { max-width: 1400px; margin: 0 auto; }

.container_home_header_top_hero {
  position: relative;
  display: flex;
  min-height: 150px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 24px;
}

.container_home_header_top_eyebrow,
.container_home_result_center_eyebrow {
  margin: 0 0 5px;
  color: var(--color-primary);
  font-family: $font-accent;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
}

.container_home_header_top_title {
  margin: 0;
  font-family: $font-display;
  font-size: clamp(32px, 4vw, 52px);
  font-weight: 500;
  letter-spacing: -0.04em;
  line-height: 1.25;

  span { position: relative; color: var(--color-primary); }
  span::after { position: absolute; right: -3px; bottom: -3px; left: -3px; height: 7px; border-radius: 50%; background: var(--color-accent); content: ''; opacity: .65; transform: rotate(-2deg); }
}

.container_home_header_top_subtitle { margin: 12px 0 0; color: var(--color-ink-soft); font-size: 15px; }
.container_home_header_top_splash { width: 160px; flex: 0 0 auto; }

.container_home_workspace_main_grid {
  display: grid;
  grid-template-columns: 370px minmax(0, 1fr);
  align-items: start;
  gap: clamp(20px, 3vw, 38px);
}

.container_home_options_left_panel {
  @include paper-panel;
  display: grid;
  gap: 23px;
  padding: 25px;
  border-radius: 18px 22px 17px 24px;
}

.container_home_prompt_top_group { display: grid; gap: 8px; }
.container_home_prompt_top_label { font-family: $font-display; font-size: 20px; }

.container_home_prompt_top_input {
  @include ink-focus;
  width: 100%;
  min-height: 130px;
  resize: vertical;
  padding: 13px 14px;
  border: 1px solid var(--color-border);
  border-bottom: 3px solid var(--color-gold);
  border-radius: 10px 10px 5px 5px;
  outline: none;
  background: color-mix(in srgb, var(--color-canvas) 54%, var(--color-paper));
  line-height: 1.75;

  &::placeholder { color: color-mix(in srgb, var(--color-ink-soft) 68%, transparent); }
  &:focus { border-bottom-color: var(--color-primary); }
}

.container_home_prompt_top_hint { display: flex; justify-content: space-between; color: var(--color-ink-soft); font-size: 11px; }

.container_home_options_bottom_cost {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  padding-top: 16px;
  border-top: 1px dashed var(--color-border);
}
.container_home_options_bottom_label { color: var(--color-ink-soft); font-size: 13px; }
.container_home_options_bottom_value { color: var(--color-primary); font-family: $font-accent; font-size: 25px; }
.container_home_options_bottom_note { grid-column: 1 / -1; margin-top: 3px; color: var(--color-ink-soft); font-size: 10px; }

.container_home_actions_bottom_generate { width: 100%; min-height: 50px; font-size: 16px; }
.container_home_actions_bottom_generate svg { width: 21px; }

.container_home_result_center_canvas {
  @include paper-panel;
  min-height: 650px;
  overflow: hidden;
  padding: clamp(20px, 3vw, 34px);
  border-radius: 24px 18px 25px 17px;
}

.container_home_result_center_header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; border-bottom: 1px solid var(--color-border); }
.container_home_result_center_title { margin: 0; font-family: $font-display; font-size: 25px; font-weight: 500; }
.container_home_result_center_status { padding: 4px 10px; border-radius: 999px; background: var(--color-chip-active); color: var(--color-ink-soft); font-size: 11px; text-transform: uppercase; }
.container_home_result_center_grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 22px; padding-top: 24px; }
.container_home_result_center_item { overflow: hidden; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-canvas); box-shadow: $soft-shadow; }
.container_home_result_center_image { display: block; overflow: hidden; aspect-ratio: 1; background: var(--color-chip-active); }
.container_home_result_center_image img { width: 100%; height: 100%; object-fit: cover; animation: paint-reveal 800ms ease both; }
.container_home_result_center_actions { display: flex; justify-content: space-between; padding: 12px 15px; font-size: 13px; }
.container_home_result_center_download,
.container_home_result_center_detail { @include ink-focus; color: var(--color-primary); }

.container_home_prompt_top_tools { display: flex; flex-wrap: wrap; gap: 8px; }
.container_home_prompt_top_template,
.container_home_prompt_top_preset { @include ink-focus; flex: 1 1 140px; min-height: 34px; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-paper); color: var(--color-ink); font-size: 13px; }
.container_home_upload_side_group { display: grid; gap: 8px; }
.container_home_upload_side_label { margin: 0; color: var(--color-ink-soft); font-size: 13px; font-weight: 700; letter-spacing: 0.08em; }
.container_home_upload_side_dropzone { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; border: 1px dashed var(--color-border); border-radius: 12px; transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease; &.is-loading { opacity: .7; } &.is-dragging { border-color: var(--color-primary); background: var(--color-chip-active); box-shadow: 0 0 0 4px rgba($ultramarine, 0.12); animation: upload-drag-pulse 1.1s ease-in-out infinite; } }
.container_home_upload_side_thumb { position: relative; width: 64px; height: 64px; animation: upload-thumb-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.container_home_history_top_wrap { display: grid; gap: 6px; }
.container_home_history_top_title { color: var(--color-ink-soft); font-size: 12px; }
.container_home_history_main_list { display: flex; flex-wrap: wrap; gap: 8px; }
.container_home_history_item_btn { @include ink-focus; width: 52px; height: 52px; padding: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-canvas); cursor: pointer; animation: upload-thumb-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both; transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease; img { width: 100%; height: 100%; object-fit: cover; transition: transform 260ms ease; } &:hover { border-color: var(--color-primary); box-shadow: 0 6px 14px rgba(59, 42, 32, 0.2); transform: translateY(-3px) scale(1.06); img { transform: scale(1.12); } } &:active { transform: scale(0.94); } }

@keyframes upload-thumb-pop {
  from { opacity: 0; transform: scale(0.5) rotate(-6deg); }
  to { opacity: 1; transform: scale(1) rotate(0); }
}

@keyframes upload-drag-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.015); }
}
.container_home_upload_side_thumb img { width: 100%; height: 100%; border-radius: 8px; object-fit: cover; }
.container_home_upload_side_remove { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: var(--color-danger); color: #fff8ed; cursor: pointer; line-height: 20px; }
.container_home_upload_side_add { @include ink-focus; width: 64px; height: 64px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-paper); color: var(--color-ink-soft); cursor: pointer; font-size: 12px; }
.container_home_upload_side_file { display: none; }

@media (max-width: 960px) {
  .container_home_workspace_main_grid { grid-template-columns: 320px minmax(0, 1fr); gap: 18px; }
  .container_home_options_left_panel { padding: 20px; }
}

@media (max-width: 760px) {
  .container_home_header_top_hero { min-height: 140px; padding-right: 0; padding-left: 0; }
  .container_home_header_top_splash { width: 110px; opacity: .65; }
  .container_home_header_top_subtitle { max-width: 310px; font-size: 13px; }
  .container_home_workspace_main_grid { grid-template-columns: 1fr; }
  .container_home_result_center_canvas { min-height: 430px; }
}

@media (max-width: 420px) {
  .container_home_header_top_splash { display: none; }
  .container_home_options_left_panel { padding: 18px; }
  .container_home_prompt_top_hint span:first-child { display: none; }
  .container_home_prompt_top_hint { justify-content: flex-end; }
}
</style>
