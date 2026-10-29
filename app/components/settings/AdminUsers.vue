<script setup lang="ts">
import type { AdminUserDto } from '#shared/types/api'

const api = useApi()
const toast = useToast()
const { user: me } = useAuth()
const users = ref<AdminUserDto[]>([])
const busy = ref('')

async function load() {
  try {
    users.value = await api<AdminUserDto[]>('/api/admin/users')
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  }
}

async function update(target: AdminUserDto, body: Record<string, unknown>, done: string) {
  busy.value = target.id
  try {
    const updated = await api<AdminUserDto>(`/api/admin/users/${target.id}`, { method: 'PATCH', body })
    users.value = users.value.map(item => item.id === updated.id ? updated : item)
    toast.show(done, 'success')
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  } finally {
    busy.value = ''
  }
}

function resetPassword(target: AdminUserDto) {
  const password = window.prompt(`为 ${target.username} 设置新密码（至少 8 位）`)
  if (!password) return
  void update(target, { password }, '密码已重置，该用户需重新登录。')
}

onMounted(load)
</script>

<template>
  <section class="container_settings_admin_main_panel">
    <h2 class="container_settings_admin_main_title">用户管理</h2>
    <table class="container_settings_admin_main_table">
      <thead><tr><th>用户</th><th>角色</th><th>状态</th><th>最近登录</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="item in users" :key="item.id">
          <td>{{ item.username }}<span v-if="item.id === me?.id">（我）</span></td>
          <td>{{ item.role === 'admin' ? '管理员' : '普通用户' }}</td>
          <td>{{ item.disabled ? '已停用' : '正常' }}</td>
          <td>{{ item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('zh-CN', { hour12: false }) : '—' }}</td>
          <td class="container_settings_admin_item_actions">
            <template v-if="item.id !== me?.id">
              <button class="container_settings_admin_item_btn" type="button" :disabled="busy === item.id" @click="update(item, { role: item.role === 'admin' ? 'user' : 'admin' }, '角色已更新。')">{{ item.role === 'admin' ? '设为普通用户' : '设为管理员' }}</button>
              <button class="container_settings_admin_item_btn" type="button" :disabled="busy === item.id" @click="update(item, { disabled: !item.disabled }, item.disabled ? '账号已启用。' : '账号已停用，会话已注销。')">{{ item.disabled ? '启用' : '停用' }}</button>
            </template>
            <button class="container_settings_admin_item_btn" type="button" :disabled="busy === item.id" @click="resetPassword(item)">重置密码</button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped lang="scss">
.container_settings_admin_main_panel { @include paper-panel; display: grid; gap: 12px; padding: 22px; overflow-x: auto; }
.container_settings_admin_main_title { margin: 0; font-family: $font-display; font-size: 22px; font-weight: 500; }
.container_settings_admin_main_table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td { padding: 8px 6px; border-bottom: 1px dashed var(--color-border); text-align: left; white-space: nowrap; }
  th { color: var(--color-ink-soft); }
}
.container_settings_admin_item_actions { display: flex; gap: 6px; }
.container_settings_admin_item_btn {
  @include ink-focus;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 12px;

  &:disabled { opacity: .5; }
}
</style>
