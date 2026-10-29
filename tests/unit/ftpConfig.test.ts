import { afterEach, describe, expect, it } from 'vitest'
import { ftpConfig } from '#server/utils/config'

const keys = ['FTP_HOST', 'FTP_PORT', 'FTP_USER', 'FTP_PASSWORD', 'FTP_DIR', 'FTP_ENABLED'] as const
afterEach(() => { for (const key of keys) delete process.env[key] })

describe('FTP 配置解析', () => {
  it('未配置 FTP_HOST 时关闭', () => {
    expect(ftpConfig().enabled).toBe(false)
  })

  it('解析主机、端口和目录', () => {
    Object.assign(process.env, { FTP_HOST: '127.0.0.1', FTP_USER: 'u', FTP_DIR: 'banana/' })
    expect(ftpConfig()).toMatchObject({ enabled: true, port: 21, dir: '/banana', errors: [] })
  })

  it('校验端口、用户名和目录', () => {
    Object.assign(process.env, { FTP_HOST: 'h', FTP_PORT: '70000', FTP_DIR: '../x' })
    expect(ftpConfig().errors).toHaveLength(3)
  })

  it('FTP_ENABLED=false 可关闭', () => {
    Object.assign(process.env, { FTP_HOST: 'h', FTP_USER: 'u', FTP_ENABLED: 'false' })
    expect(ftpConfig().enabled).toBe(false)
  })
})
