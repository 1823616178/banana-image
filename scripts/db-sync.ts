/**
 * 按实体定义创建 / 补齐数据库表结构并写入初始数据（生产环境首次部署用）。
 * 生产环境 NODE_ENV=production 时服务端不会自动同步表结构，新服务器上先执行一次：npm run db:sync
 * 注意：TypeORM 同步可能修改已有表结构，已有数据的库请先备份，或改用 docs/migrations 下的 SQL。
 */
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const { dataSource } = await import('../server/db/data-source')
const { seedDatabase } = await import('../server/db/seed')

await dataSource.initialize()
await dataSource.synchronize()
await seedDatabase(dataSource)
console.info(`数据库 ${dataSource.options.database as string} 表结构已同步`)
await dataSource.destroy()
