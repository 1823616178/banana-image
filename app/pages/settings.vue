<script setup lang="ts">
import { ASPECT_RATIOS, IMAGE_SIZES } from '#shared/config/models'
import type { HealthDto, ModelDto, SettingsDto, UsageStatsDto } from '#shared/types/api'

useHead({ title: '设置 · banana-image' })

const api = useApi()
const toast = useToast()
const { user } = useAuth()
const isAdmin = computed(() => user.value?.role === 'admin')
const pricingDraft = ref<Record<string, Record<'1K' | '2K' | '4K', number | ''>>>({})
const range = ref<'7d' | '30d' | '90d'>('30d')
const saving = ref(false)
const checking = ref(false)
const health = ref<HealthDto | null>(null)
const passwordForm = reactive({ current: '', next: '', confirm: '' })
const passwordPending = ref(false)

const [{ data: settings, error: settingsError, refresh: refreshSettings }, { data: models }, { data: stats, refresh: refreshStats, pending: statsPending }] = await Promise.all([
  useAsyncData('settings', () => api<SettingsDto>('/api/settings')),
  useAsyncData('settings-models', () => api<ModelDto[]>('/api/models').catch(() => [] as ModelDto[])),
  useAsyncData('settings-usage', () => api<UsageStatsDto>('/api/stats/usage', { query: { range: range.value } }), { watch: [range] }),
])

const form = reactive({
  model: '',
  aspectRatio: '1:1' as SettingsDto['defaults']['aspectRatio'],
  imageSize: '1K' as SettingsDto['defaults']['imageSize'],
  count: 1,
  dailyBudgetUsd: 0,
  rateLimitPerMinute: 10,
  creditGrantUsd: 0,
  allowRegistration: false,
})

watch(settings, (value) => {
  if (!value) return
  Object.assign(form, value.defaults, {
    dailyBudgetUsd: value.dailyBudgetUsd,
    rateLimitPerMinute: value.rateLimitPerMinute,
    creditGrantUsd: value.creditGrantUsd,
    allowRegistration: value.allowRegistration,
  })
}, { immediate: true })

// 价格覆盖草稿：留空表示使用官方价格（或待确认）。
watch([settings, models], ([value, list]) => {
  if (!value) return
  const ids = new Set([...(list ?? []).map(item => item.id), ...Object.keys(value.pricing)])
  pricingDraft.value = Object.fromEntries([...ids].map(id => [id, { '1K': value.pricing[id]?.['1K'] ?? '', '2K': value.pricing[id]?.['2K'] ?? '', '4K': value.pricing[id]?.['4K'] ?? '' }]))
}, { immediate: true })
const modelById = (id: string) => models.value?.find(item => item.id === id)

const maxDayCost = computed(() => Math.max(0.0001, ...(stats.value?.days.map(day => day.costUsd) ?? [0])))
const maxDayImages = computed(() => Math.max(1, ...(stats.value?.days.map(day => day.images) ?? [0])))
const creditLeft = computed(() => stats.value && stats.value.creditGrantUsd > 0 ? stats.value.creditGrantUsd - stats.value.monthCostUsd : null)
const selectedPrice = computed(() => models.value?.find(item => item.id === form.model)?.prices[form.imageSize] ?? null)
const money = (value: number) => `$${value.toFixed(value >= 100 ? 2 : 4)}`

async function save() {
  saving.value = true
  try {
    settings.value = await api<SettingsDto>('/api/settings', {
      method: 'PUT',
      body: {
        defaults: { model: form.model, aspectRatio: form.aspectRatio, imageSize: form.imageSize, count: Number(form.count) },
        ...(isAdmin.value
          ? {
              dailyBudgetUsd: Number(form.dailyBudgetUsd) || 0,
              rateLimitPerMinute: Math.round(Number(form.rateLimitPerMinute) || 0),
              creditGrantUsd: Number(form.creditGrantUsd) || 0,
              allowRegistration: form.allowRegistration,
              pricing: Object.fromEntries(Object.entries(pricingDraft.value).map(([id, prices]) => [id, { '1K': Number(prices['1K']) || 0, '2K': Number(prices['2K']) || 0, '4K': Number(prices['4K']) || 0 }])),
            }
          : {}),
      },
    })
    toast.show('设置已保存，创作页会使用新的默认值。', 'success')
    await refreshStats()
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  } finally {
    saving.value = false
  }
}

async function checkHealth() {
  checking.value = true
  try {
    health.value = await api<HealthDto>('/api/health')
  } catch (error) {
    const failure = error as { data?: { data?: HealthDto } }
    health.value = failure.data?.data ?? null
    if (!health.value) toast.show(apiErrorMessage(error), 'error')
  } finally {
    checking.value = false
  }
}

async function changePassword() {
  if (passwordForm.next !== passwordForm.confirm) {
    toast.show('两次输入的新密码不一致', 'error')
    return
  }
  passwordPending.value = true
  try {
    await api('/api/auth/password', { method: 'POST', body: { currentPassword: passwordForm.current, newPassword: passwordForm.next } })
    Object.assign(passwordForm, { current: '', next: '', confirm: '' })
    toast.show('密码已修改，其他设备上的登录已失效。', 'success')
  } catch (error) {
    toast.show(apiErrorMessage(error), 'error')
  } finally {
    passwordPending.value = false
  }
}
</script>

<template>
  <section class="container_settings_page_main_wrap">
    <header class="container_settings_header_top_bar"><p class="container_settings_header_top_eyebrow">THE STUDIO</p><h1 class="container_settings_header_top_title">画室设置</h1><p class="container_settings_header_top_subtitle">调好颜料与画布，再开始下一幅。</p></header>

    <div class="container_settings_stats_top_grid">
      <article class="container_settings_stats_top_card"><span>今日费用</span><strong>{{ money(stats?.todayCostUsd ?? 0) }}</strong></article>
      <article class="container_settings_stats_top_card"><span>本月费用</span><strong>{{ money(stats?.monthCostUsd ?? 0) }}</strong></article>
      <article class="container_settings_stats_top_card"><span>近 {{ stats?.rangeDays ?? 30 }} 天出图</span><strong>{{ stats?.totalImages ?? 0 }} 张</strong></article>
      <article class="container_settings_stats_top_card"><span>赠金剩余（按本月）</span><strong>{{ creditLeft === null ? '未设置' : money(creditLeft) }}</strong></article>
    </div>

    <div class="container_settings_layout_main_grid">
      <section class="container_settings_stats_main_panel">
        <header class="container_settings_stats_main_header">
          <h2 class="container_settings_section_main_title">我的用量</h2>
          <select v-model="range" class="container_settings_form_item_select" aria-label="统计范围">
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
          </select>
        </header>
        <p v-if="statsPending && !stats" class="container_settings_stats_main_note">正在统计…</p>
        <template v-else-if="stats">
          <div class="container_settings_stats_main_chart" role="img" :aria-label="`近 ${stats.rangeDays} 天每日费用柱状图`">
            <div v-for="day in stats.days" :key="day.date" class="container_settings_stats_item_bar" :title="`${day.date}：${money(day.costUsd)}，${day.images} 张`">
              <span class="container_settings_stats_item_fill" :style="{ height: `${Math.max(day.costUsd > 0 ? 3 : 0, day.costUsd / maxDayCost * 100)}%` }" />
              <span class="container_settings_stats_item_dot" :style="{ bottom: `${day.images / maxDayImages * 100}%` }" />
            </div>
          </div>
          <p class="container_settings_stats_main_note">柱高为每日费用（{{ money(stats.totalCostUsd) }} 合计），圆点为出图张数；日期按 UTC 统计，费用为估算值，以 GCP 账单为准。</p>
          <table v-if="stats.byModel.length" class="container_settings_stats_main_table">
            <thead><tr><th>模型</th><th>张数</th><th>费用</th></tr></thead>
            <tbody><tr v-for="row in stats.byModel" :key="row.model"><td>{{ row.model }}</td><td>{{ row.images }}</td><td>{{ money(row.costUsd) }}</td></tr></tbody>
          </table>
        </template>
      </section>

      <form class="container_settings_form_main_wrap" @submit.prevent="save">
        <h2 class="container_settings_section_main_title">创作默认值 <small>（仅对我生效）</small></h2>
        <CommonEmpty v-if="settingsError" title="设置读取失败" :description="apiErrorMessage(settingsError)"><CommonPaintButton variant="secondary" @click="refreshSettings()">重试</CommonPaintButton></CommonEmpty>
        <template v-else>
          <label class="container_settings_form_item_label">默认模型
            <select v-model="form.model" class="container_settings_form_main_model">
              <option v-for="item in models ?? []" :key="item.id" :value="item.id">{{ item.name }}（{{ item.id }}）· {{ form.imageSize }} {{ formatImagePrice(item.prices[form.imageSize]) }}</option>
            </select>
          </label>
          <div class="container_settings_form_item_row">
            <label class="container_settings_form_item_label">画布比例
              <select v-model="form.aspectRatio" class="container_settings_form_item_select"><option v-for="item in ASPECT_RATIOS" :key="item" :value="item">{{ item }}</option></select>
            </label>
            <label class="container_settings_form_item_label">分辨率
              <select v-model="form.imageSize" class="container_settings_form_item_select"><option v-for="item in IMAGE_SIZES" :key="item" :value="item">{{ item }}</option></select>
            </label>
            <label class="container_settings_form_item_label">张数
              <select v-model.number="form.count" class="container_settings_form_item_select"><option v-for="item in [1, 2, 3, 4]" :key="item" :value="item">{{ item }}</option></select>
            </label>
          </div>
          <p class="container_settings_stats_main_note">当前组合单价：{{ formatImagePrice(selectedPrice) }}</p>

          <h2 class="container_settings_section_main_title">模型价格 <small>（Vertex AI 官方价，Global 区域 Standard 档{{ isAdmin ? '；填写数字可覆盖，留空用官方价' : '' }}）</small></h2>
          <table class="container_settings_form_main_pricing">
            <thead><tr><th>模型（USD/张）</th><th>1K</th><th>2K</th><th>4K</th><th>按 token 计价（USD/百万 tokens）</th></tr></thead>
            <tbody>
              <tr v-for="(prices, id) in pricingDraft" :key="id">
                <td>{{ modelById(id)?.name ?? id }}<br><small>{{ id }}</small></td>
                <td v-for="size in (['1K', '2K', '4K'] as const)" :key="size">
                  <input v-if="isAdmin" v-model="prices[size]" class="container_settings_form_item_input" type="number" min="0" max="100" step="0.001" :placeholder="modelById(id)?.officialPrices[size]?.toString() ?? '待确认'" :aria-label="`${id} ${size} 单价`">
                  <span>{{ formatImagePrice(modelById(id)?.prices[size]) }}</span>
                </td>
                <td>
                  <template v-if="modelById(id)?.tokenPrices">输入 {{ formatTokenPrice(modelById(id)?.tokenPrices?.inputPerMillion) }}<br>文本输出 {{ formatTokenPrice(modelById(id)?.tokenPrices?.textOutputPerMillion) }}<br>图片输出 {{ formatTokenPrice(modelById(id)?.tokenPrices?.imageOutputPerMillion) }}</template>
                  <template v-else>待确认</template>
                  <br><a v-if="modelById(id)?.priceSource" :href="modelById(id)?.priceSource ?? undefined" target="_blank" rel="noopener">官方来源（{{ modelById(id)?.priceCheckedAt }} 核对）</a>
                </td>
              </tr>
            </tbody>
          </table>

          <h2 class="container_settings_section_main_title">共享限额 <small>（所有账号共用{{ isAdmin ? '' : '，仅管理员可修改' }}）</small></h2>
          <fieldset class="container_settings_form_main_shared" :disabled="!isAdmin">
          <div class="container_settings_form_item_row">
            <label class="container_settings_form_item_label">每日预算（USD，0 为不限）
              <input v-model.number="form.dailyBudgetUsd" class="container_settings_form_item_input" type="number" min="0" step="0.01">
            </label>
            <label class="container_settings_form_item_label">每人每分钟任务数（0 为不限）
              <input v-model.number="form.rateLimitPerMinute" class="container_settings_form_item_input" type="number" min="0" step="1">
            </label>
            <label class="container_settings_form_item_label">赠金额度（USD）
              <input v-model.number="form.creditGrantUsd" class="container_settings_form_item_input" type="number" min="0" step="1">
            </label>
          </div>
          <template v-if="isAdmin">
            <label class="container_settings_form_item_check"><input v-model="form.allowRegistration" type="checkbox" :disabled="settings?.registrationForcedByEnv"> 开放新用户注册<span v-if="settings?.registrationForcedByEnv">（.env 中 ALLOW_REGISTRATION=true，已强制开放）</span></label>
          </template>
          </fieldset>
          <CommonPaintButton type="submit" :loading="saving">保存设置</CommonPaintButton>
        </template>
      </form>

      <section class="container_settings_health_main_panel">
        <h2 class="container_settings_section_main_title">连接测试</h2>
        <CommonPaintButton variant="secondary" :loading="checking" @click="checkHealth">检测服务连接</CommonPaintButton>
        <ul v-if="health" class="container_settings_health_main_list">
          <li v-for="(item, key) in health" :key="key" class="container_settings_health_item_row" :data-status="item.status"><strong>{{ key }}</strong> {{ item.status === 'ok' ? '正常' : item.status === 'disabled' ? '未启用' : '异常' }}<template v-if="item.status !== 'disabled'"> · {{ item.latencyMs }}ms</template><span v-if="item.status !== 'ok'"> · {{ item.message }}</span></li>
        </ul>
      </section>

      <SettingsPresetPanel :is-admin="isAdmin" />
      <SettingsTemplatePanel :is-admin="isAdmin" />
      <SettingsAdminUsers v-if="isAdmin" class="container_settings_admin_main_wide" />

      <form class="container_settings_account_main_panel" @submit.prevent="changePassword">
        <h2 class="container_settings_section_main_title">账号 · {{ user?.username }} <small>（{{ isAdmin ? '管理员' : '普通用户' }}）</small></h2>
        <label class="container_settings_form_item_label">当前密码<input v-model="passwordForm.current" class="container_settings_form_item_input" type="password" autocomplete="current-password" required></label>
        <label class="container_settings_form_item_label">新密码（至少 8 位）<input v-model="passwordForm.next" class="container_settings_form_item_input" type="password" autocomplete="new-password" minlength="8" required></label>
        <label class="container_settings_form_item_label">确认新密码<input v-model="passwordForm.confirm" class="container_settings_form_item_input" type="password" autocomplete="new-password" minlength="8" required></label>
        <CommonPaintButton type="submit" variant="secondary" :loading="passwordPending">修改密码</CommonPaintButton>
      </form>
    </div>
  </section>
</template>

<style scoped lang="scss">
.container_settings_page_main_wrap { max-width: 1400px; margin: 0 auto; }
.container_settings_header_top_bar { margin-bottom: 22px; }
.container_settings_header_top_eyebrow { margin: 0; color: var(--color-primary); font-family: $font-accent; font-size: 11px; letter-spacing: .22em; }
.container_settings_header_top_title { margin: 3px 0; font-family: $font-display; font-size: 40px; font-weight: 500; }
.container_settings_header_top_subtitle { margin: 0; color: var(--color-ink-soft); }
.container_settings_stats_top_grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 22px; }

.container_settings_stats_top_card {
  @include paper-panel;
  display: grid;
  gap: 6px;
  padding: 18px 20px;

  span { color: var(--color-ink-soft); font-size: 13px; }
  strong { color: var(--color-primary); font-family: $font-accent; font-size: 26px; }
}

.container_settings_layout_main_grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 22px; }

.container_settings_stats_main_panel,
.container_settings_form_main_wrap,
.container_settings_health_main_panel,
.container_settings_account_main_panel {
  @include paper-panel;
  display: grid;
  gap: 14px;
  padding: 22px;
}

.container_settings_stats_main_header { display: flex; align-items: center; justify-content: space-between; }
.container_settings_section_main_title { margin: 0; font-family: $font-display; font-size: 22px; font-weight: 500; small { color: var(--color-ink-soft); font-family: inherit; font-size: 12px; } }
.container_settings_stats_main_chart { display: flex; height: 180px; align-items: stretch; gap: 2px; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
.container_settings_stats_item_bar { position: relative; display: flex; flex: 1; align-items: flex-end; }
.container_settings_stats_item_fill { width: 100%; border-radius: 3px 3px 0 0; background: $paint-gradient; opacity: .8; }
.container_settings_stats_item_dot { position: absolute; left: 50%; width: 5px; height: 5px; border-radius: 50%; background: var(--color-ink); opacity: .55; transform: translate(-50%, 50%); }
.container_settings_stats_main_note { margin: 0; color: var(--color-ink-soft); font-size: 12px; }

.container_settings_stats_main_table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th, td { padding: 6px 4px; border-bottom: 1px dashed var(--color-border); text-align: left; }
  th { color: var(--color-ink-soft); font-weight: 700; }
}

.container_settings_form_item_row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.container_settings_form_item_label { display: grid; gap: 6px; color: var(--color-ink-soft); font-size: 13px; font-weight: 700; }

.container_settings_form_main_model,
.container_settings_form_item_select,
.container_settings_form_item_input {
  @include ink-focus;
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-paper);
  color: var(--color-ink);
  font-weight: 400;
}

.container_settings_form_main_shared { display: grid; gap: 12px; min-width: 0; margin: 0; padding: 0; border: 0; }
.container_settings_form_item_check { display: flex; align-items: center; gap: 6px; color: var(--color-ink-soft); font-size: 13px; }
.container_settings_form_main_pricing {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th, td { padding: 4px; text-align: left; }
  th { color: var(--color-ink-soft); }
  input { width: 100%; min-height: 32px; }
}
.container_settings_admin_main_wide { grid-column: 1 / -1; }
.container_settings_health_main_list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.container_settings_health_item_row { &[data-status='ok'] strong { color: var(--color-success); } &[data-status='error'] strong { color: var(--color-danger); } }

@media (max-width: 960px) {
  .container_settings_stats_top_grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .container_settings_layout_main_grid { grid-template-columns: 1fr; }
}

@media (max-width: 520px) {
  .container_settings_form_item_row { grid-template-columns: 1fr; }
  .container_settings_header_top_title { font-size: 32px; }
}
</style>
