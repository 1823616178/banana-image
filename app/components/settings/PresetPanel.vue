<script setup lang="ts">
import type { PresetDto } from '#shared/types/api'

const props = defineProps<{ isAdmin: boolean }>()
const api = useApi()
const toast = useToast()
const items = ref<PresetDto[]>([])
const editingId = ref<string | null>(null)
const pending = ref(false)
const form = reactive({ name: '', promptSuffix: '', sort: 100, enabled: true, shared: false })

async function load() {
  try {
    items.value = await api<PresetDto[]>('/api/presets', { query: { manage: '1' } })
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  }
}

function reset() {
  editingId.value = null
  Object.assign(form, { name: '', promptSuffix: '', sort: 100, enabled: true, shared: false })
}

function edit(item: PresetDto) {
  editingId.value = item.id
  Object.assign(form, { name: item.name, promptSuffix: item.promptSuffix, sort: item.sort, enabled: item.enabled, shared: item.shared })
}

async function submit() {
  pending.value = true
  try {
    const body = { name: form.name, promptSuffix: form.promptSuffix, sort: Number(form.sort) || 0, enabled: form.enabled }
    if (editingId.value) await api(`/api/presets/${editingId.value}`, { method: 'PUT', body })
    else await api('/api/presets', { method: 'POST', body: { ...body, shared: props.isAdmin && form.shared } })
    toast.show(editingId.value ? '预设已更新。' : '预设已添加。', 'success')
    reset()
    await load()
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  } finally {
    pending.value = false
  }
}

async function remove(item: PresetDto) {
  if (!window.confirm(`删除预设「${item.name}」？`)) return
  try {
    await api(`/api/presets/${item.id}`, { method: 'DELETE' })
    if (editingId.value === item.id) reset()
    await load()
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  }
}

onMounted(load)
</script>

<template>
  <section class="container_settings_library_main_panel">
    <h2 class="container_settings_library_main_title">风格预设</h2>
    <p class="container_settings_library_main_note">共享预设所有人可用，{{ isAdmin ? '你是管理员，可以维护' : '由管理员维护' }}；“我的”预设只有自己可见。</p>
    <ul class="container_settings_library_main_list">
      <li v-for="item in items" :key="item.id" class="container_settings_library_item_row" :class="{ 'is-disabled': !item.enabled }">
        <div class="container_settings_library_item_body">
          <strong>{{ item.name }}</strong>
          <span class="container_settings_library_item_tag">{{ item.shared ? '共享' : '我的' }}{{ item.enabled ? '' : ' · 已停用' }}</span>
          <p class="container_settings_library_item_text">{{ item.promptSuffix }}</p>
        </div>
        <div v-if="item.editable" class="container_settings_library_item_actions">
          <button class="container_settings_library_item_btn" type="button" @click="edit(item)">编辑</button>
          <button class="container_settings_library_item_btn" type="button" @click="remove(item)">删除</button>
        </div>
      </li>
    </ul>
    <form class="container_settings_library_bottom_form" @submit.prevent="submit">
      <input v-model="form.name" class="container_settings_library_bottom_input" maxlength="32" placeholder="名称，如：赛博朋克" required>
      <textarea v-model="form.promptSuffix" class="container_settings_library_bottom_input" rows="2" maxlength="2000" placeholder="追加到提示词末尾的风格描述" required />
      <div class="container_settings_library_bottom_row">
        <label>排序 <input v-model.number="form.sort" class="container_settings_library_bottom_number" type="number"></label>
        <label><input v-model="form.enabled" type="checkbox"> 启用</label>
        <label v-if="isAdmin && !editingId"><input v-model="form.shared" type="checkbox"> 设为共享</label>
        <CommonPaintButton type="submit" :loading="pending">{{ editingId ? '保存修改' : '添加预设' }}</CommonPaintButton>
        <CommonPaintButton v-if="editingId" variant="ghost" @click="reset">取消</CommonPaintButton>
      </div>
    </form>
  </section>
</template>

<style lang="scss">
/* 预设与常用提示词面板共用的样式（TemplatePanel 也使用这些类名） */
.container_settings_library_main_panel { @include paper-panel; display: grid; gap: 12px; padding: 22px; }
.container_settings_library_main_title { margin: 0; font-family: $font-display; font-size: 22px; font-weight: 500; }
.container_settings_library_main_note { margin: 0; color: var(--color-ink-soft); font-size: 12px; }
.container_settings_library_main_list { display: grid; max-height: 360px; gap: 0; margin: 0; overflow: auto; padding: 0; list-style: none; }
.container_settings_library_item_row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px dashed var(--color-border); &.is-disabled { opacity: .55; } }
.container_settings_library_item_body { flex: 1; min-width: 0; }
.container_settings_library_item_tag { margin-left: 8px; color: var(--color-ink-soft); font-size: 11px; }
.container_settings_library_item_text { margin: 4px 0 0; color: var(--color-ink-soft); font-size: 13px; word-break: break-word; }
.container_settings_library_item_actions { display: flex; gap: 6px; }
.container_settings_library_item_btn {
  @include ink-focus;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.container_settings_library_bottom_form { display: grid; gap: 8px; }
.container_settings_library_bottom_input,
.container_settings_library_bottom_number {
  @include ink-focus;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-paper);
  color: var(--color-ink);
  font: inherit;
}
.container_settings_library_bottom_number { width: 80px; }
.container_settings_library_bottom_row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: var(--color-ink-soft); font-size: 13px; }
</style>
