<script setup lang="ts">
import type { TemplateDto } from '#shared/types/api'

const props = defineProps<{ isAdmin: boolean }>()
const api = useApi()
const toast = useToast()
const items = ref<TemplateDto[]>([])
const editingId = ref<string | null>(null)
const pending = ref(false)
const form = reactive({ title: '', content: '', shared: false })

async function load() {
  try {
    items.value = await api<TemplateDto[]>('/api/templates')
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  }
}

function reset() {
  editingId.value = null
  Object.assign(form, { title: '', content: '', shared: false })
}

function edit(item: TemplateDto) {
  editingId.value = item.id
  Object.assign(form, { title: item.title, content: item.content, shared: item.shared })
}

async function submit() {
  pending.value = true
  try {
    const body = { title: form.title, content: form.content }
    if (editingId.value) await api(`/api/templates/${editingId.value}`, { method: 'PUT', body })
    else await api('/api/templates', { method: 'POST', body: { ...body, shared: props.isAdmin && form.shared } })
    toast.show(editingId.value ? '提示词已更新。' : '提示词已添加。', 'success')
    reset()
    await load()
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  } finally {
    pending.value = false
  }
}

async function remove(item: TemplateDto) {
  if (!window.confirm(`删除常用提示词「${item.title}」？`)) return
  try {
    await api(`/api/templates/${item.id}`, { method: 'DELETE' })
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
    <h2 class="container_settings_library_main_title">常用提示词</h2>
    <p class="container_settings_library_main_note">在创作页可一键填入；共享提示词{{ isAdmin ? '由你（管理员）维护' : '由管理员维护' }}。</p>
    <ul class="container_settings_library_main_list">
      <li v-for="item in items" :key="item.id" class="container_settings_library_item_row">
        <div class="container_settings_library_item_body">
          <strong>{{ item.title }}</strong>
          <span class="container_settings_library_item_tag">{{ item.shared ? '共享' : '我的' }} · 用过 {{ item.useCount }} 次</span>
          <p class="container_settings_library_item_text">{{ item.content }}</p>
        </div>
        <div v-if="item.editable" class="container_settings_library_item_actions">
          <button class="container_settings_library_item_btn" type="button" @click="edit(item)">编辑</button>
          <button class="container_settings_library_item_btn" type="button" @click="remove(item)">删除</button>
        </div>
      </li>
    </ul>
    <form class="container_settings_library_bottom_form" @submit.prevent="submit">
      <input v-model="form.title" class="container_settings_library_bottom_input" maxlength="64" placeholder="标题" required>
      <textarea v-model="form.content" class="container_settings_library_bottom_input" rows="3" maxlength="4000" placeholder="提示词内容" required />
      <div class="container_settings_library_bottom_row">
        <label v-if="isAdmin && !editingId"><input v-model="form.shared" type="checkbox"> 设为共享</label>
        <CommonPaintButton type="submit" :loading="pending">{{ editingId ? '保存修改' : '添加提示词' }}</CommonPaintButton>
        <CommonPaintButton v-if="editingId" variant="ghost" @click="reset">取消</CommonPaintButton>
      </div>
    </form>
  </section>
</template>
