import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Generation } from '#server/db/entities/Generation'
import { Image } from '#server/db/entities/Image'
import { PromptTemplate } from '#server/db/entities/PromptTemplate'
import { Setting } from '#server/db/entities/Setting'
import { StylePreset } from '#server/db/entities/StylePreset'
import { UsageStat } from '#server/db/entities/UsageStat'
import { User } from '#server/db/entities/User'
import { UserSession } from '#server/db/entities/UserSession'
import { getServerConfig } from '#server/utils/config'
import { seedDatabase } from '#server/db/seed'

const config = getServerConfig().database

export const dataSource = new DataSource({
  type: 'mysql',
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.name,
  charset: 'utf8mb4',
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: true,
  synchronize: config.synchronize,
  logging: config.logging,
  entities: [Generation, Image, StylePreset, PromptTemplate, Setting, UsageStat, User, UserSession],
  invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
  extra: { connectionLimit: 10 },
})

let initialization: Promise<DataSource> | undefined

export async function initializeDatabase() {
  if (dataSource.isInitialized) return dataSource
  if (!initialization) {
    initialization = dataSource.initialize()
      .then(async (source) => {
        await seedDatabase(source)
        return source
      })
      .catch((error) => {
        initialization = undefined
        throw error
      })
  }
  return initialization
}
