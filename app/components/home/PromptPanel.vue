<script setup lang="ts">
import { WIG_PROMPT_GROUPS } from '#shared/config/wigPrompts'
import type { ImageDto, PromptRecommendationDto, TemplateDto } from '#shared/types/api'

const props = defineProps<{
  references: ImageDto[]
  templates: TemplateDto[]
}>()
const emit = defineEmits<{
  use: [text: string, mode: 'fill' | 'append']
  templateUsed: [id: string]
}>()

const api = useApi()
const toast = useToast()
const tab = ref<'ai' | 'preset' | 'mine'>('preset')
const targetId = ref('')
const results = ref<Record<string, PromptRecommendationDto>>({})
const errors = ref<Record<string, string>>({})
const loadingId = ref('')
const presetScene = ref(WIG_PROMPT_GROUPS[0]!.scene)

const target = computed(() => props.references.find(item => item.id === targetId.value) ?? null)
const current = computed(() => target.value ? results.value[target.value.id] : undefined)
const currentError = computed(() => target.value ? errors.value[target.value.id] : undefined)
const presetItems = computed(() => WIG_PROMPT_GROUPS.find(group => group.scene === presetScene.value)?.items ?? [])
const tabs = [
  { value: 'ai', label: 'AI 推荐' },
  { value: 'preset', label: '预设提示词' },
  { value: 'mine', label: '常用提示词' },
] as const
const analysisLine = computed(() => {
  const value = current.value?.analysis
  if (!value) return ''
  return [value.wigType, value.length, value.color, value.density, value.hairline, value.texture].filter(Boolean).join(' · ')
})

async function recommend(id: string) {
  if (loadingId.value) return
  loadingId.value = id
  errors.value = { ...errors.value, [id]: '' }
  try {
    const data = await api<PromptRecommendationDto>('/api/prompts/recommend', { method: 'POST', body: { imageId: id } })
    results.value = { ...results.value, [id]: data }
  } catch (error) {
    errors.value = { ...errors.value, [id]: apiErrorMessage(error) }
  } finally {
    loadingId.value = ''
  }
}

// 新加入参考图时自动切到 AI 推荐并分析最新一张
watch(() => props.references.map(item => item.id), (ids, previous) => {
  if (!ids.includes(targetId.value)) targetId.value = ids.at(-1) ?? ''
  const added = ids.filter(id => !(previous ?? []).includes(id))
  const latest = added.at(-1)
  if (!latest) return
  targetId.value = latest
  tab.value = 'ai'
  if (!results.value[latest]) void recommend(latest)
}, { immediate: true })

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.show('已复制提示词', 'success')
  } catch {
    toast.show('复制失败，请手动选择文本', 'error')
  }
}

function useTemplate(item: TemplateDto, mode: 'fill' | 'append') {
  emit('use', item.content, mode)
  emit('templateUsed', item.id)
}
</script>

<template>
  <section class="container_home_promptpanel_main_wrap" aria-label="提示词区域">
    <div class="container_home_promptpanel_top_tabs" role="tablist">
      <button v-for="item in tabs" :key="item.value" type="button" role="tab" class="container_home_promptpanel_top_tab" :class="{ 'is-active': tab === item.value }" :aria-selected="tab === item.value" @click="tab = item.value">{{ item.label }}</button>
    </div>

    <div v-if="tab === 'ai'" class="container_home_promptpanel_body_ai">
      <p v-if="!references.length" class="container_home_promptpanel_body_note">上传假发产品图或模特图后，AI 会识别假发类型、长度、颜色、发际线等，并给出可直接使用的英文提示词。</p>
      <template v-else>
        <div class="container_home_promptpanel_body_targets">
          <button v-for="item in references" :key="item.id" type="button" class="container_home_promptpanel_body_target" :class="{ 'is-active': item.id === targetId }" :aria-label="`分析参考图 ${item.id}`" @click="targetId = item.id; !results[item.id] && recommend(item.id)"><img :src="item.thumbUrl" alt=""></button>
          <button type="button" class="container_home_promptpanel_body_regen" :disabled="Boolean(loadingId) || !target" @click="target && recommend(target.id)">{{ loadingId ? '分析中…' : (current ? '重新生成' : '生成推荐') }}</button>
        </div>
        <p v-if="loadingId === targetId" class="container_home_promptpanel_body_note">正在分析这顶假发并撰写提示词…</p>
        <div v-else-if="currentError" class="container_home_promptpanel_body_error">
          <span>{{ currentError }}</span>
          <button type="button" class="container_home_promptpanel_body_retry" @click="target && recommend(target.id)">重试</button>
        </div>
        <template v-else-if="current">
          <p class="container_home_promptpanel_body_analysis"><strong>{{ current.analysis.summaryZh || '识别结果' }}</strong><span v-if="analysisLine">{{ analysisLine }}</span><span v-if="!current.analysis.isWig">（图中似乎不是假发，以下为通用提示词）</span></p>
          <ul class="container_home_promptpanel_body_list">
            <li v-for="item in current.prompts" :key="item.prompt" class="container_home_promptpanel_body_item">
              <header class="container_home_promptpanel_item_head"><b>{{ item.labelZh }}</b><small>{{ item.scene }}</small></header>
              <p class="container_home_promptpanel_item_explain">{{ item.explanationZh }}</p>
              <p class="container_home_promptpanel_item_text">{{ item.prompt }}</p>
              <div class="container_home_promptpanel_item_actions">
                <button type="button" class="container_home_promptpanel_item_btn" @click="emit('use', item.prompt, 'fill')">填入</button>
                <button type="button" class="container_home_promptpanel_item_btn" @click="emit('use', item.prompt, 'append')">追加</button>
                <button type="button" class="container_home_promptpanel_item_btn" @click="copy(item.prompt)">复制</button>
              </div>
            </li>
          </ul>
          <p class="container_home_promptpanel_body_note">模型 {{ current.model }} · {{ current.costUsd === null ? '费用未知' : `约 $${current.costUsd.toFixed(4)}` }}</p>
        </template>
      </template>
    </div>

    <div v-else-if="tab === 'preset'" class="container_home_promptpanel_body_preset">
      <div class="container_home_promptpanel_body_scenes">
        <button v-for="group in WIG_PROMPT_GROUPS" :key="group.scene" type="button" class="container_home_promptpanel_body_scene" :class="{ 'is-active': group.scene === presetScene }" @click="presetScene = group.scene">{{ group.scene }}</button>
      </div>
      <ul class="container_home_promptpanel_body_list">
        <li v-for="item in presetItems" :key="item.id" class="container_home_promptpanel_body_item">
          <header class="container_home_promptpanel_item_head"><b>{{ item.label }}</b></header>
          <p class="container_home_promptpanel_item_text">{{ item.prompt }}</p>
          <div class="container_home_promptpanel_item_actions">
            <button type="button" class="container_home_promptpanel_item_btn" @click="emit('use', item.prompt, 'fill')">填入</button>
            <button type="button" class="container_home_promptpanel_item_btn" @click="emit('use', item.prompt, 'append')">追加</button>
            <button type="button" class="container_home_promptpanel_item_btn" @click="copy(item.prompt)">复制</button>
          </div>
        </li>
      </ul>
    </div>

    <div v-else class="container_home_promptpanel_body_mine">
      <p v-if="!templates.length" class="container_home_promptpanel_body_note">还没有常用提示词，可在设置页添加。</p>
      <ul v-else class="container_home_promptpanel_body_list">
        <li v-for="item in templates" :key="item.id" class="container_home_promptpanel_body_item">
          <header class="container_home_promptpanel_item_head"><b>{{ item.shared ? '' : '★ ' }}{{ item.title }}</b><small>{{ item.shared ? '共享' : '我的' }}</small></header>
          <p class="container_home_promptpanel_item_text">{{ item.content }}</p>
          <div class="container_home_promptpanel_item_actions">
            <button type="button" class="container_home_promptpanel_item_btn" @click="useTemplate(item, 'fill')">填入</button>
            <button type="button" class="container_home_promptpanel_item_btn" @click="useTemplate(item, 'append')">追加</button>
            <button type="button" class="container_home_promptpanel_item_btn" @click="copy(item.content)">复制</button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.container_home_promptpanel_main_wrap { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--color-line, rgba(0, 0, 0, .12)); border-radius: 14px; background: var(--color-surface, rgba(255, 255, 255, .6)); }
.container_home_promptpanel_top_tabs, .container_home_promptpanel_body_scenes, .container_home_promptpanel_body_targets, .container_home_promptpanel_item_actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.container_home_promptpanel_top_tab, .container_home_promptpanel_body_scene, .container_home_promptpanel_item_btn, .container_home_promptpanel_body_regen, .container_home_promptpanel_body_retry {
  padding: 4px 10px; border: 1px solid var(--color-line, rgba(0, 0, 0, .15)); border-radius: 999px; background: transparent; color: inherit; font-size: 12px; cursor: pointer;
  &.is-active { border-color: var(--color-primary); background: var(--color-primary); color: #fff; }
  &:disabled { opacity: .5; cursor: default; }
}
.container_home_promptpanel_top_tab { font-weight: 700; }
.container_home_promptpanel_body_regen { margin-left: auto; }
.container_home_promptpanel_body_target {
  width: 40px; height: 40px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 8px; cursor: pointer;
  &.is-active { border-color: var(--color-primary); }
  img { width: 100%; height: 100%; object-fit: cover; }
}
.container_home_promptpanel_body_list { display: grid; max-height: 340px; gap: 8px; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
.container_home_promptpanel_body_item { display: grid; gap: 4px; padding: 8px 10px; border-radius: 10px; background: var(--color-paper, rgba(0, 0, 0, .03)); }
.container_home_promptpanel_item_head { display: flex; gap: 8px; align-items: baseline; small { color: var(--color-ink-soft); } }
.container_home_promptpanel_item_explain, .container_home_promptpanel_body_note { margin: 0; color: var(--color-ink-soft); font-size: 12px; }
.container_home_promptpanel_item_text { margin: 0; font-size: 12px; line-height: 1.5; word-break: break-word; }
.container_home_promptpanel_body_analysis { display: grid; gap: 2px; margin: 0; font-size: 12px; }
.container_home_promptpanel_body_error { display: flex; gap: 8px; align-items: center; color: var(--color-danger, #c0392b); font-size: 12px; }
.container_home_promptpanel_body_ai, .container_home_promptpanel_body_preset, .container_home_promptpanel_body_mine { display: grid; gap: 8px; }
</style>
