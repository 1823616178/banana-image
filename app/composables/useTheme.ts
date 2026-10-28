export type ThemePreference = 'system' | 'light' | 'dark'

export function useTheme() {
  const preference = useState<ThemePreference>('theme-preference', () => 'system')

  const applyPreference = (value: ThemePreference) => {
    if (!import.meta.client) return
    if (value === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.dataset.theme = value
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      const saved = localStorage.getItem('banana-theme') as ThemePreference | null
      if (saved && ['system', 'light', 'dark'].includes(saved)) {
        preference.value = saved
      }
      applyPreference(preference.value)
    })

    watch(preference, (value) => {
      localStorage.setItem('banana-theme', value)
      applyPreference(value)
    })
  }

  const cycleTheme = () => {
    const order: ThemePreference[] = ['system', 'light', 'dark']
    const index = order.indexOf(preference.value)
    preference.value = order[(index + 1) % order.length]!
  }

  const label = computed(() => ({
    system: '跟随系统',
    light: '亮色模式',
    dark: '暗色模式',
  })[preference.value])

  return { preference, label, cycleTheme }
}
