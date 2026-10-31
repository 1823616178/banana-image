const cwd = __dirname

const commonEnv = {
  NODE_ENV: 'production',
}

module.exports = {
  apps: [
    {
      name: 'banana-web',
      cwd,
      script: '.output/server/index.mjs',
      interpreter: 'node',
      node_args: '--env-file=.env',
      env: {
        ...commonEnv,
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: '50080',
      },
      kill_timeout: 10000,
      max_memory_restart: '1G',
      time: true,
    },
    {
      name: 'banana-worker',
      cwd,
      script: 'server/worker.ts',
      interpreter: 'node',
      node_args: '--import tsx',
      // 直接运行 worker，让 PM2 的信号到达处理任务的进程。
      env: { ...commonEnv, TSX_TSCONFIG_PATH: '.nuxt/tsconfig.server.json' },
      // 停机取消未开始的 Copilot 请求，只排空已在执行的请求、下载和存储。
      // 覆盖 Copilot 上游生成、四张参考图上传及认证恢复的最大等待预算。
      kill_timeout: 3300000,
      max_memory_restart: '1G',
      time: true,
    },
  ],
}
