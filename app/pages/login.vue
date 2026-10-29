<script setup lang="ts">
import type { ApiFailure, ApiSuccess } from '#shared/types/api'

definePageMeta({ layout: false })

type Mode = 'login' | 'register'
type Field = 'username' | 'password' | 'confirm'

const route = useRoute()
const toast = useToast()
const { login, register } = useAuth()
const { label: themeLabel, cycleTheme } = useTheme()

const mode = ref<Mode>(route.query.mode === 'register' ? 'register' : 'login')
const username = ref('')
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const pending = ref(false)
const formError = ref('')
const touched = reactive<Record<Field, boolean>>({ username: false, password: false, confirm: false })
const serverErrors = reactive<Partial<Record<Field, string>>>({})
const usernameInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)

const { data: status, refresh: refreshStatus } = await useAsyncData('auth-status', () =>
  $fetch<ApiSuccess<{ registrationOpen: boolean }>>('/api/auth/status')
    .then(item => ({ ok: true, registrationOpen: item.data.registrationOpen }))
    .catch(() => ({ ok: false, registrationOpen: false })))
const registrationOpen = computed(() => status.value?.registrationOpen ?? false)
const statusUnavailable = computed(() => status.value?.ok === false)
const isRegister = computed(() => mode.value === 'register')

useHead({ title: () => `${isRegister.value ? '创建账号' : '登录'} · banana-image` })

const redirectTarget = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/login') ? target : '/'
})
const redirectHint = computed(() => ({ '/gallery': '作品画廊', '/tasks': '作画任务', '/settings': '画室设置' } as Record<string, string>)[redirectTarget.value.split('?')[0]!] ?? '')

const clientErrors = computed<Record<Field, string>>(() => {
  const name = username.value.trim()
  const errors: Record<Field, string> = { username: '', password: '', confirm: '' }
  if (!name) errors.username = '请输入用户名'
  else if (isRegister.value && name.length < 3) errors.username = '用户名至少 3 个字符'
  else if (isRegister.value && !/^[a-zA-Z0-9_.-]+$/.test(name)) errors.username = '只能使用字母、数字、下划线、点和横线'
  if (!password.value) errors.password = '请输入密码'
  else if (isRegister.value && password.value.length < 8) errors.password = `密码至少 8 位，还差 ${8 - password.value.length} 位`
  if (isRegister.value) {
    if (!confirm.value) errors.confirm = '请再次输入密码'
    else if (confirm.value !== password.value) errors.confirm = '两次输入的密码不一致'
  }
  return errors
})

const fieldError = (field: Field) => serverErrors[field] || (touched[field] ? clientErrors.value[field] : '')
const invalid = computed(() => ({ username: Boolean(fieldError('username')), password: Boolean(fieldError('password')), confirm: Boolean(fieldError('confirm')) }))
const strength = computed(() => {
  const value = password.value
  if (!isRegister.value || !value) return null
  const score = [value.length >= 8, value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^a-zA-Z0-9]/.test(value)].filter(Boolean).length
  if (score <= 2) return { level: 1, label: '较弱' }
  if (score <= 3) return { level: 2, label: '中等' }
  return { level: 3, label: '较强' }
})

watch([username, password, confirm], () => {
  formError.value = ''
  for (const key of Object.keys(serverErrors) as Field[]) delete serverErrors[key]
})

watch(registrationOpen, (open) => {
  if (!open && mode.value === 'register') mode.value = 'login'
})

function switchMode(next: Mode) {
  mode.value = next
  formError.value = ''
  confirm.value = ''
  Object.assign(touched, { username: false, password: false, confirm: false })
  for (const key of Object.keys(serverErrors) as Field[]) delete serverErrors[key]
  void nextTick(() => usernameInput.value?.focus())
}

function describeFailure(error: unknown) {
  const failure = error as { data?: ApiFailure & { details?: { path: string, message: string }[] }, statusCode?: number, status?: number }
  const code = failure.data?.code
  const statusCode = failure.statusCode ?? failure.status
  switch (code) {
    case 'INVALID_CREDENTIALS':
      serverErrors.password = '用户名或密码不正确'
      return '用户名或密码不正确，请检查后重试（注意大小写）。'
    case 'ACCOUNT_DISABLED':
      return '该账号已被管理员停用，请联系管理员恢复。'
    case 'TOO_MANY_ATTEMPTS':
      return '尝试次数过多，为保护账号已暂时锁定，请 10 分钟后再试。'
    case 'REGISTRATION_CLOSED':
      void refreshStatus()
      mode.value = 'login'
      return '注册已关闭，请使用已有账号登录，或联系管理员开通。'
    case 'USERNAME_TAKEN':
      serverErrors.username = '这个用户名已被占用'
      return '这个用户名已被占用，换一个试试。'
    case 'VALIDATION_ERROR':
      for (const item of failure.data?.details ?? []) {
        if (item.path === 'username' || item.path === 'password') serverErrors[item.path] = item.message
      }
      return '填写的内容不符合要求，请按提示修改。'
    case 'AUTH_UNAVAILABLE':
      return '服务暂时无法校验账号（数据库未连接），请稍后再试。'
  }
  if (!statusCode) return '网络连接失败，请检查服务是否已启动。'
  if (statusCode >= 500) return '服务器暂时出了点问题，请稍后再试。'
  return failure.data?.message ?? '操作失败，请稍后重试。'
}

async function submit() {
  if (pending.value) return
  Object.assign(touched, { username: true, password: true, confirm: true })
  const firstInvalid = (['username', 'password', 'confirm'] as Field[]).find(field => clientErrors.value[field])
  if (firstInvalid) {
    document.getElementById(`login-${firstInvalid}`)?.focus()
    return
  }
  pending.value = true
  formError.value = ''
  try {
    if (isRegister.value) await register(username.value.trim(), password.value)
    else await login(username.value.trim(), password.value)
    toast.show(isRegister.value ? '账号已创建，欢迎入驻画室。' : '欢迎回到画室。', 'success')
    await navigateTo(redirectTarget.value, { replace: true })
  } catch (error) {
    formError.value = describeFailure(error)
    if (serverErrors.username) usernameInput.value?.focus()
    else if (serverErrors.password) passwordInput.value?.select()
  } finally {
    pending.value = false
  }
}

onMounted(() => usernameInput.value?.focus())
</script>

<template>
  <div class="container_auth_page_main_wrap">
    <section class="container_auth_brand_left_panel" aria-hidden="true">
      <svg class="container_auth_brand_left_splash" viewBox="0 0 320 240" fill="none">
        <path d="M38 160C70 58 196 34 270 96C214 86 170 140 138 184C96 214 50 200 38 160Z" fill="#F2B629" opacity=".55" />
        <path d="M92 178C140 120 182 88 268 86" stroke="#D9482B" stroke-width="20" stroke-linecap="round" opacity=".55" />
        <path d="M70 70C110 40 160 44 190 60" stroke="#2E4A9E" stroke-width="9" stroke-linecap="round" opacity=".45" />
        <circle cx="262" cy="168" r="15" fill="#2E4A9E" opacity=".5" />
        <circle cx="52" cy="58" r="8" fill="#C8557A" opacity=".6" />
        <circle cx="290" cy="40" r="5" fill="#2F8F6B" opacity=".6" />
      </svg>
      <div class="container_auth_brand_left_copy">
        <p class="container_auth_brand_left_logo">banana<span>-image</span></p>
        <h2 class="container_auth_brand_left_slogan">让灵感，落进<span>颜料</span>里。</h2>
        <p class="container_auth_brand_left_lead">一方本地画布，一点 AI 魔法。</p>
        <ul class="container_auth_brand_left_points">
          <li>每位画师的作品、任务与用量相互独立</li>
          <li>画廊收藏、再次生成、以图改图</li>
          <li>费用估算与每日预算，心里有数</li>
        </ul>
      </div>
    </section>

    <main class="container_auth_form_right_area">
      <button class="container_auth_header_top_theme" type="button" :aria-label="`当前${themeLabel}，点击切换主题`" @click="cycleTheme">{{ themeLabel }}</button>

      <section class="container_auth_form_center_card" :aria-labelledby="'auth-title'">
        <p class="container_auth_header_top_eyebrow">BANANA-IMAGE ATELIER</p>
        <h1 id="auth-title" class="container_auth_header_top_title">{{ isRegister ? '创建账号' : '登录画室' }}</h1>
        <p class="container_auth_header_top_subtitle">
          <template v-if="isRegister">设置用户名和至少 8 位的密码，注册后自动登录。</template>
          <template v-else>欢迎回来{{ redirectHint ? `，登录后继续前往「${redirectHint}」` : '，继续你的创作' }}。</template>
        </p>

        <div v-if="registrationOpen" class="container_auth_switch_top_tabs" role="tablist" aria-label="登录或注册">
          <button class="container_auth_switch_top_tab" :class="{ 'is-active': !isRegister }" type="button" role="tab" :aria-selected="!isRegister" @click="switchMode('login')">登录</button>
          <button class="container_auth_switch_top_tab" :class="{ 'is-active': isRegister }" type="button" role="tab" :aria-selected="isRegister" @click="switchMode('register')">注册</button>
        </div>

        <p v-if="registrationOpen && isRegister" class="container_auth_notice_top_info">
          如果这是系统里的<strong>第一个账号</strong>，它会成为<strong>管理员</strong>，并接管登录功能上线前留下的作品与任务。
        </p>
        <p v-else-if="statusUnavailable" class="container_auth_notice_top_warn" role="status">暂时无法连接服务，登录可能失败。<button class="container_auth_notice_top_retry" type="button" @click="refreshStatus()">重新检测</button></p>

        <form class="container_auth_form_main_fields" novalidate @submit.prevent="submit">
          <div class="container_auth_form_item_field">
            <label class="container_auth_form_item_label" for="login-username">用户名</label>
            <input
              id="login-username"
              ref="usernameInput"
              v-model="username"
              class="container_auth_form_item_input"
              :class="{ 'is-invalid': invalid.username }"
              name="username"
              :placeholder="isRegister ? '请输入用户名（3–32 位字母、数字、下划线、点或横线）' : '请输入用户名'"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              maxlength="32"
              required
              :aria-invalid="Boolean(fieldError('username'))"
              :aria-describedby="fieldError('username') ? 'login-username-error' : (isRegister ? 'login-username-hint' : undefined)"
              @blur="touched.username = true"
            >
            <p v-if="fieldError('username')" id="login-username-error" class="container_auth_form_item_error">{{ fieldError('username') }}</p>
            <p v-else-if="isRegister" id="login-username-hint" class="container_auth_form_item_hint">3–32 个字符：字母、数字、下划线、点、横线</p>
          </div>

          <div class="container_auth_form_item_field">
            <label class="container_auth_form_item_label" for="login-password">密码</label>
            <div class="container_auth_form_item_control">
              <input
                id="login-password"
                ref="passwordInput"
                v-model="password"
                class="container_auth_form_item_input"
                :class="{ 'is-invalid': invalid.password }"
                name="password"
                :placeholder="isRegister ? '请设置密码（至少 8 位，建议混合字母、数字和符号）' : '请输入密码'"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="isRegister ? 'new-password' : 'current-password'"
                maxlength="128"
                required
                :aria-invalid="Boolean(fieldError('password'))"
                :aria-describedby="fieldError('password') ? 'login-password-error' : undefined"
                @blur="touched.password = true"
              >
              <button class="container_auth_form_item_reveal" type="button" :aria-pressed="showPassword" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :title="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">
                <svg v-if="showPassword" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3L21 21M10.6 10.6A2 2 0 0013.4 13.4M9.9 5.1A10.5 10.5 0 0112 5C17 5 20.5 9.5 21.5 12C21 13.3 20 14.8 18.6 16.1M6.2 6.2C4.3 7.6 3 9.6 2.5 12C3.5 14.5 7 19 12 19C13.6 19 15 18.6 16.3 17.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12C3.5 9.5 7 5 12 5C17 5 20.5 9.5 21.5 12C20.5 14.5 17 19 12 19C7 19 3.5 14.5 2.5 12Z" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" /></svg>
              </button>
            </div>
            <p v-if="fieldError('password')" id="login-password-error" class="container_auth_form_item_error">{{ fieldError('password') }}</p>
            <div v-else-if="strength" class="container_auth_form_item_strength" :data-level="strength.level"><span /><span /><span /><em>强度：{{ strength.label }}</em></div>
          </div>

          <div v-if="isRegister" class="container_auth_form_item_field">
            <label class="container_auth_form_item_label" for="login-confirm">确认密码</label>
            <input
              id="login-confirm"
              v-model="confirm"
              class="container_auth_form_item_input"
              :class="{ 'is-invalid': invalid.confirm }"
              name="confirm"
              placeholder="请再次输入密码（与上面一致）"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              maxlength="128"
              required
              :aria-invalid="Boolean(fieldError('confirm'))"
              :aria-describedby="fieldError('confirm') ? 'login-confirm-error' : undefined"
              @blur="touched.confirm = true"
            >
            <p v-if="fieldError('confirm')" id="login-confirm-error" class="container_auth_form_item_error">{{ fieldError('confirm') }}</p>
          </div>

          <p v-if="formError" class="container_auth_form_main_alert" role="alert">{{ formError }}</p>

          <CommonPaintButton class="container_auth_actions_bottom_submit" type="submit" :loading="pending">
            {{ pending ? (isRegister ? '正在创建…' : '正在登录…') : (isRegister ? '注册并进入画室' : '登录') }}
          </CommonPaintButton>
        </form>

        <p class="container_auth_footer_bottom_note">
          <template v-if="registrationOpen">{{ isRegister ? '已有账号？' : '还没有账号？' }}<button class="container_auth_footer_bottom_link" type="button" @click="switchMode(isRegister ? 'login' : 'register')">{{ isRegister ? '去登录' : '注册一个' }}</button></template>
          <template v-else>注册暂未开放；需要账号或忘记密码，请联系管理员。</template>
        </p>
      </section>
    </main>
    <CommonToast />
  </div>
</template>

<style scoped lang="scss">
.container_auth_page_main_wrap {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
}

.container_auth_brand_left_panel {
  position: relative;
  display: flex;
  overflow: hidden;
  align-items: center;
  padding: clamp(32px, 6vw, 88px);
  border-right: 1px solid var(--color-border);
  background:
    radial-gradient(circle at 20% 15%, rgba(242, 182, 41, 0.22), transparent 42%),
    radial-gradient(circle at 85% 90%, rgba(46, 74, 158, 0.16), transparent 45%),
    color-mix(in srgb, var(--color-paper) 70%, var(--color-canvas));
}

.container_auth_brand_left_splash {
  position: absolute;
  right: -40px;
  bottom: -20px;
  width: min(460px, 70%);
  pointer-events: none;
}

.container_auth_brand_left_copy { position: relative; max-width: 460px; }
.container_auth_brand_left_logo { margin: 0 0 28px; font-family: $font-accent; font-size: 24px; font-weight: 700; letter-spacing: -0.04em; span { color: var(--color-primary); } }

.container_auth_brand_left_slogan {
  margin: 0;
  font-family: $font-display;
  font-size: clamp(36px, 4.2vw, 58px);
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.25;

  span { position: relative; color: var(--color-primary); }
  span::after { position: absolute; right: -3px; bottom: -2px; left: -3px; height: 8px; border-radius: 50%; background: var(--color-accent); content: ''; opacity: .65; transform: rotate(-2deg); }
}

.container_auth_brand_left_lead { margin: 14px 0 26px; color: var(--color-ink-soft); font-size: 16px; }

.container_auth_brand_left_points {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  color: var(--color-ink-soft);
  font-size: 14px;
  list-style: none;

  li { position: relative; padding-left: 22px; }
  li::before { position: absolute; top: .55em; left: 0; width: 12px; height: 6px; border-radius: 50%; background: $paint-gradient; content: ''; transform: rotate(-12deg); }
}

.container_auth_form_right_area { position: relative; display: grid; place-items: center; padding: 48px 20px; }

.container_auth_header_top_theme {
  @include ink-focus;
  position: fixed;
  z-index: 30;
  top: 16px;
  right: 16px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-paper);
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 12px;
}

.container_auth_form_center_card {
  @include paper-panel;
  width: min(430px, 100%);
  padding: 36px 32px 28px;
  border-radius: 22px 18px 24px 17px;
  animation: page-enter 360ms ease both;
}

.container_auth_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_auth_header_top_title { margin: 4px 0 6px; font-family: $font-display; font-size: 34px; font-weight: 500; }
.container_auth_header_top_subtitle { margin: 0 0 20px; color: var(--color-ink-soft); font-size: 14px; }

.container_auth_switch_top_tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 16px; padding: 4px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-canvas); }

.container_auth_switch_top_tab {
  @include ink-focus;
  padding: 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
  font-size: 14px;
  transition: background-color 160ms ease, color 160ms ease;

  &.is-active { background: var(--color-paper); box-shadow: 0 2px 0 var(--color-accent); color: var(--color-ink); font-weight: 700; }
}

.container_auth_notice_top_info,
.container_auth_notice_top_warn { margin: 0 0 16px; padding: 10px 12px; border-radius: 10px; font-size: 13px; line-height: 1.6; }
.container_auth_notice_top_info { border: 1px dashed var(--color-gold); background: var(--color-chip-active); }
.container_auth_notice_top_warn { border: 1px dashed var(--color-danger); color: var(--color-danger); }
.container_auth_notice_top_retry { @include ink-focus; margin-left: 6px; padding: 0; border: 0; background: none; color: var(--color-primary); cursor: pointer; font-size: 13px; text-decoration: underline; }

.container_auth_form_main_fields { display: grid; gap: 14px; }
.container_auth_form_item_field { display: grid; gap: 5px; }
.container_auth_form_item_label { color: var(--color-ink-soft); font-size: 13px; font-weight: 700; }
.container_auth_form_item_control { position: relative; }

.container_auth_form_item_input {
  @include ink-focus;
  width: 100%;
  padding: 11px 13px;
  border: 1px solid var(--color-border);
  border-bottom: 3px solid var(--color-gold);
  border-radius: 10px 10px 5px 5px;
  outline: none;
  background: color-mix(in srgb, var(--color-canvas) 54%, var(--color-paper));
  color: var(--color-ink);
  font-size: 16px;
  transition: border-color 160ms ease;

  &:focus { border-bottom-color: var(--color-primary); }
  &.is-invalid { border-bottom-color: var(--color-danger); }
}

.container_auth_form_item_control .container_auth_form_item_input { padding-right: 46px; }

.container_auth_form_item_reveal {
  @include ink-focus;
  position: absolute;
  top: 50%;
  right: 6px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--color-ink-soft);
  cursor: pointer;
  transform: translateY(-50%);

  &:hover { color: var(--color-ink); }
  svg { width: 20px; }
}

.container_auth_form_item_error { margin: 0; color: var(--color-danger); font-size: 12px; }
.container_auth_form_item_hint { margin: 0; color: var(--color-ink-soft); font-size: 12px; }

.container_auth_form_item_strength {
  display: flex;
  align-items: center;
  gap: 4px;

  span { width: 36px; height: 4px; border-radius: 4px; background: var(--color-border); }
  em { margin-left: 6px; color: var(--color-ink-soft); font-size: 12px; font-style: normal; }
  &[data-level='1'] span:nth-child(1) { background: var(--color-danger); }
  &[data-level='2'] span:nth-child(-n+2) { background: var(--color-accent); }
  &[data-level='3'] span { background: var(--color-success); }
}

.container_auth_form_main_alert { margin: 0; padding: 10px 12px; border-left: 4px solid var(--color-danger); border-radius: 6px; background: color-mix(in srgb, var(--color-danger) 10%, transparent); color: var(--color-ink); font-size: 13px; }
.container_auth_actions_bottom_submit { width: 100%; min-height: 48px; margin-top: 4px; font-size: 16px; }
.container_auth_footer_bottom_note { margin: 18px 0 0; color: var(--color-ink-soft); font-size: 13px; text-align: center; }
.container_auth_footer_bottom_link { @include ink-focus; margin-left: 4px; padding: 0; border: 0; background: none; color: var(--color-primary); cursor: pointer; font-size: 13px; font-weight: 700; }

@media (max-width: 900px) {
  .container_auth_page_main_wrap { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .container_auth_brand_left_panel { padding: 28px 22px 26px; border-right: 0; border-bottom: 1px solid var(--color-border); }
  .container_auth_brand_left_splash { right: -30px; bottom: -40px; width: 220px; opacity: .7; }
  .container_auth_brand_left_logo { margin-bottom: 10px; font-size: 20px; }
  .container_auth_brand_left_slogan { font-size: 30px; }
  .container_auth_brand_left_lead { margin: 6px 0 0; font-size: 14px; }
  .container_auth_brand_left_points { display: none; }
  .container_auth_form_right_area { align-items: start; padding: 22px 14px 40px; }
}

@media (max-width: 420px) {
  .container_auth_form_center_card { padding: 26px 18px 22px; }
  .container_auth_header_top_title { font-size: 28px; }
}

@media (prefers-reduced-motion: reduce) {
  .container_auth_form_center_card { animation: none; }
}
</style>
