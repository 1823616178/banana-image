const path = require('node:path')

const cwd = __dirname
const home = process.env.HOME || '/backup/home/sun'
const adc = path.join(home, '.config/gcloud/application_default_credentials.json')

const commonEnv = {
  NODE_ENV: 'production',
  HOME: home,
  GOOGLE_APPLICATION_CREDENTIALS: adc,
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
      script: 'node_modules/tsx/dist/cli.mjs',
      args: '--tsconfig .nuxt/tsconfig.server.json server/worker.ts',
      interpreter: 'node',
      env: commonEnv,
      kill_timeout: 15000,
      max_memory_restart: '1G',
      time: true,
    },
  ],
}
