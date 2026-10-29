import type { NuxtConfig } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack/types'

const nitroConfig: NitroConfig = {
  preset: 'node-server',
  typescript: {
    tsConfig: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  esbuild: {
    options: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  },
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'banana-image · 让灵感落进颜料里',
      meta: [
        { name: 'description', content: '在本地使用 Vertex AI 创作、编辑与管理 AI 画作。' },
        { name: 'theme-color', content: '#F4EBDC' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  css: ['~/assets/scss/main.scss'],
  hooks: {
    'app:resolve'(app) {
      app.plugins = app.plugins.filter(plugin => !plugin.src.includes('check-if-page-unused'))
    },
  },
  devServer: {
    host: process.env.APP_HOST || '127.0.0.1',
    port: Number(process.env.APP_PORT || 3000),
  },
  nitro: nitroConfig as NuxtConfig['nitro'],
  typescript: {
    typeCheck: true,
    tsConfig: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/scss/_tokens.scss" as *; @use "~/assets/scss/_mixins.scss" as *;',
        },
      },
    },
  },
})
