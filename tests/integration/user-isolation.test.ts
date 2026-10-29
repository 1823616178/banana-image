/**
 * 多用户隔离集成测试：需要一个可随意清空的 MySQL 库。
 * 通过 BI_TEST_MYSQL_URL=mysql://user:pass@host:port/db 启用，未设置时整组跳过。
 * 测试会删除并重建该库中的表，切勿指向正式数据库。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.BI_TEST_MYSQL_URL
const suite = url ? describe : describe.skip

if (url) {
  const parsed = new URL(url)
  process.env.DB_HOST = parsed.hostname
  process.env.DB_PORT = parsed.port || '3306'
  process.env.DB_USER = decodeURIComponent(parsed.username)
  process.env.DB_PASSWORD = decodeURIComponent(parsed.password)
  process.env.DB_NAME = parsed.pathname.slice(1)
  process.env.DB_SYNCHRONIZE = 'true'
  process.env.REDIS_HOST = '127.0.0.1'
  process.env.REDIS_PORT = '1'
}

suite('登录与按用户隔离（MySQL）', () => {
  let modules: Awaited<ReturnType<typeof load>>
  let alice: { id: string, role: 'admin' | 'user' }
  let bob: { id: string, role: 'admin' | 'user' }
  let legacyGenerationId: string
  let aliceImageId: string
  let aliceImagePath: string

  async function load() {
    const [db, auth, generation, images, userSettings, Generation, Image, admin, library] = await Promise.all([
      import('#server/db/data-source'),
      import('#server/services/auth'),
      import('#server/services/generation'),
      import('#server/services/images'),
      import('#server/services/userSettings'),
      import('#server/db/entities/Generation'),
      import('#server/db/entities/Image'),
      import('#server/services/admin'),
      import('#server/services/library'),
    ])
    return { db, auth, generation, images, userSettings, Generation: Generation.Generation, Image: Image.Image, admin, library }
  }

  async function insertGeneration(userId: string | null, prompt: string) {
    const source = await modules.db.initializeDatabase()
    const repository = source.getRepository(modules.Generation)
    return repository.save(repository.create({
      userId, prompt, finalPrompt: prompt, model: 'gemini-nano-banana-2.1', aspectRatio: '1:1', imageSize: '1K',
      count: 1, mode: 'text2img', refImageIds: [], stylePresetId: null, status: 'succeeded', costUsd: '0.0340', parentImageId: null,
    }))
  }

  async function insertImage(userId: string | null, generationId: string | null, name: string) {
    const source = await modules.db.initializeDatabase()
    const repository = source.getRepository(modules.Image)
    return repository.save(repository.create({
      userId, generationId, source: 'generated', filePath: `images/2026/10/${name}.png`, thumbPath: `thumbs/2026/10/${name}.webp`,
      mimeType: 'image/png', width: 10, height: 10, bytes: 100, sha256: name.padEnd(64, '0').slice(0, 64), isFavorite: false,
    }))
  }

  async function expectNotFound(action: () => Promise<unknown>) {
    await expect(action()).rejects.toMatchObject({ statusCode: 404 })
  }

  beforeAll(async () => {
    modules = await load()
    const source = await modules.db.initializeDatabase()
    await source.dropDatabase()
    await source.synchronize()
    const legacy = await insertGeneration(null, '登录前的旧任务')
    legacyGenerationId = legacy.id
    await insertImage(null, legacy.id, 'legacy')
  })

  afterAll(async () => {
    if (modules?.db.dataSource.isInitialized) await modules.db.dataSource.destroy()
  })

  it('首个账号可注册并接管旧数据，之后默认关闭注册', async () => {
    delete process.env.ALLOW_REGISTRATION
    expect(await modules.auth.registrationOpen()).toBe(true)
    alice = await modules.auth.registerUser('alice', 'alice-password')
    expect(alice.role).toBe('admin')
    expect(await modules.auth.registrationOpen()).toBe(false)
    await expect(modules.auth.registerUser('mallory', 'mallory-password')).rejects.toMatchObject({ statusCode: 403 })
    const legacy = await modules.generation.getGeneration(legacyGenerationId, alice.id)
    expect(legacy.images).toHaveLength(1)
  })

  it('开放注册后可创建第二个账号，用户名不可重复', async () => {
    process.env.ALLOW_REGISTRATION = 'true'
    bob = await modules.auth.registerUser('bob', 'bob-password')
    expect(bob.role).toBe('user')
    await expect(modules.auth.registerUser('bob', 'other-password')).rejects.toMatchObject({ statusCode: 409 })
    delete process.env.ALLOW_REGISTRATION
  })

  it('登录、会话查询与注销', async () => {
    await expect(modules.auth.authenticate('alice', 'wrong-password')).rejects.toMatchObject({ statusCode: 401 })
    await expect(modules.auth.authenticate('nobody', 'whatever-pass')).rejects.toMatchObject({ statusCode: 401 })
    const user = await modules.auth.authenticate('alice', 'alice-password')
    const token = await modules.auth.createSession(user.id)
    expect((await modules.auth.findSessionUser(token))?.id).toBe(alice.id)
    expect(await modules.auth.findSessionUser('forged-token')).toBeNull()
    await modules.auth.destroySession(token)
    expect(await modules.auth.findSessionUser(token)).toBeNull()
  })

  it('改密后旧密码失效，其他会话被注销', async () => {
    const keep = await modules.auth.createSession(bob.id)
    const other = await modules.auth.createSession(bob.id)
    await expect(modules.auth.changePassword(bob.id, 'wrong', 'bob-password-2', keep)).rejects.toMatchObject({ statusCode: 400 })
    await modules.auth.changePassword(bob.id, 'bob-password', 'bob-password-2', keep)
    await expect(modules.auth.authenticate('bob', 'bob-password')).rejects.toMatchObject({ statusCode: 401 })
    expect((await modules.auth.findSessionUser(keep))?.id).toBe(bob.id)
    expect(await modules.auth.findSessionUser(other)).toBeNull()
  })

  it('任务只对所属用户可见', async () => {
    const task = await insertGeneration(alice.id, '向日葵花田')
    const image = await insertImage(alice.id, task.id, 'alice-1')
    aliceImageId = image.id
    aliceImagePath = image.filePath

    const aliceList = await modules.generation.listGenerations(alice.id, undefined, 1, 20)
    expect(aliceList.items.map(item => item.id)).toContain(task.id)
    const bobList = await modules.generation.listGenerations(bob.id, undefined, 1, 20)
    expect(bobList.total).toBe(0)

    await expectNotFound(() => modules.generation.getGeneration(task.id, bob.id))
    await expectNotFound(() => modules.generation.cancelGeneration(task.id, bob.id))
    await expectNotFound(() => modules.generation.retryGeneration(task.id, bob.id))
  })

  it('画廊、详情、收藏、删除、文件读取都按用户隔离', async () => {
    const aliceGallery = await modules.images.listImages(alice.id, { sort: 'newest', page: 1, size: 24 })
    expect(aliceGallery.items.map(item => item.id)).toContain(aliceImageId)
    expect((await modules.images.listImages(alice.id, { q: '向日葵', sort: 'newest', page: 1, size: 24 })).total).toBe(1)
    expect((await modules.images.listImages(bob.id, { sort: 'newest', page: 1, size: 24 })).total).toBe(0)

    await expectNotFound(() => modules.images.getImageDetail(aliceImageId, bob.id))
    await expectNotFound(() => modules.images.setFavorite(aliceImageId, bob.id, true))
    await expectNotFound(() => modules.images.deleteImage(aliceImageId, bob.id))
    await expectNotFound(() => modules.images.regenerateFromImage(aliceImageId, bob.id))
    await expectNotFound(() => modules.images.assertFileOwner(aliceImagePath, bob.id))
    await expect(modules.images.assertFileOwner(aliceImagePath, alice.id)).resolves.toMatchObject({ storage: 'local', isOriginal: true })

    await modules.images.setFavorite(aliceImageId, alice.id, true)
    expect((await modules.images.listImages(alice.id, { favorite: true, sort: 'newest', page: 1, size: 24 })).total).toBe(1)
    await modules.images.deleteImage(aliceImageId, alice.id)
    await expectNotFound(() => modules.images.getImageDetail(aliceImageId, alice.id))
    await expectNotFound(() => modules.images.assertFileOwner(aliceImagePath, alice.id))
  })

  it('同一张图可被不同用户各自保存，删除后可重新保存', async () => {
    const source = await modules.db.initializeDatabase()
    const repository = source.getRepository(modules.Image)
    await insertImage(bob.id, null, 'alice-1')
    await modules.images.purgeDeletedDuplicate(repository, alice.id, 'alice-1'.padEnd(64, '0'))
    await expect(insertImage(alice.id, null, 'alice-1')).resolves.toMatchObject({ userId: alice.id })
  })

  it('默认参数按用户保存，用量统计只算自己的任务', async () => {
    await modules.userSettings.updateUserSettings(alice.id, { defaults: { aspectRatio: '16:9', count: 3 } })
    expect((await modules.userSettings.getUserSettings(alice.id)).defaults).toMatchObject({ aspectRatio: '16:9', count: 3 })
    expect((await modules.userSettings.getUserSettings(bob.id)).defaults).toMatchObject({ aspectRatio: '1:1', count: 1 })
    const aliceUsage = await modules.userSettings.getUsageStats(alice.id, 7)
    const bobUsage = await modules.userSettings.getUsageStats(bob.id, 7)
    expect(aliceUsage.totalCostUsd).toBeGreaterThan(0)
    expect(bobUsage.totalCostUsd).toBe(0)
    expect(aliceUsage.days).toHaveLength(7)
  })

  it('共享设置只有管理员可改，普通用户只能改自己的默认值', async () => {
    await expect(modules.userSettings.updateUserSettings(bob.id, { dailyBudgetUsd: 5 }, 'user')).rejects.toMatchObject({ statusCode: 403 })
    await expect(modules.userSettings.updateUserSettings(bob.id, { pricing: { 'gemini-nano-banana-2.1': { '1K': 1 } } }, 'user')).rejects.toMatchObject({ statusCode: 403 })
    await expect(modules.userSettings.updateUserSettings(bob.id, { defaults: { count: 2 } }, 'user')).resolves.toMatchObject({ defaults: { count: 2 }, canManageShared: false })
    const updated = await modules.userSettings.updateUserSettings(alice.id, { dailyBudgetUsd: 5, pricing: { 'gemini-nano-banana-2.1': { '1K': 0.05 } } }, 'admin')
    expect(updated.dailyBudgetUsd).toBe(5)
    expect(updated.pricing['gemini-nano-banana-2.1']?.['1K']).toBe(0.05)
    // 未覆盖的分辨率不写入设置，实际单价回落到官方价格（2K = $0.05）
    expect(updated.pricing['gemini-nano-banana-2.1']?.['2K']).toBeUndefined()
    const effective = (await modules.userSettings.listModels()).find(item => item.id === 'gemini-nano-banana-2.1')
    expect(effective?.prices).toEqual({ '1K': 0.05, '2K': 0.05, '4K': 0.113 })
    await expect(modules.userSettings.updateUserSettings(alice.id, { pricing: { 'no-such-model': { '1K': 1 } } }, 'admin')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('管理员可开关注册', async () => {
    delete process.env.ALLOW_REGISTRATION
    await modules.userSettings.updateUserSettings(alice.id, { allowRegistration: true }, 'admin')
    expect(await modules.auth.registrationOpen()).toBe(true)
    await modules.userSettings.updateUserSettings(alice.id, { allowRegistration: false }, 'admin')
    expect(await modules.auth.registrationOpen()).toBe(false)
  })

  it('用户管理：停用后无法登录且会话失效，不能停用或降级最后一个管理员', async () => {
    const users = await modules.admin.listUsers()
    expect(users.map(item => item.username)).toEqual(['alice', 'bob'])
    await expect(modules.admin.updateUser(alice.id, alice.id, { role: 'user' })).rejects.toMatchObject({ statusCode: 400 })
    const session = await modules.auth.createSession(bob.id)
    await modules.admin.updateUser(alice.id, bob.id, { disabled: true })
    expect(await modules.auth.findSessionUser(session)).toBeNull()
    await expect(modules.auth.authenticate('bob', 'bob-password-2')).rejects.toMatchObject({ statusCode: 403 })
    await modules.admin.updateUser(alice.id, bob.id, { disabled: false, role: 'admin' })
    await modules.admin.updateUser(bob.id, alice.id, { role: 'user' })
    await expect(modules.admin.updateUser(alice.id, bob.id, { role: 'user' })).rejects.toMatchObject({ statusCode: 400 })
    await modules.admin.updateUser(bob.id, alice.id, { role: 'admin' })
    await modules.admin.updateUser(alice.id, bob.id, { role: 'user', password: 'bob-password-3' })
    await expect(modules.auth.authenticate('bob', 'bob-password-3')).resolves.toMatchObject({ id: bob.id })
  })

  it('预设与常用提示词：共享归管理员维护，个人条目只对自己可见', async () => {
    const aliceActor = { id: alice.id, role: 'admin' as const }
    const bobActor = { id: bob.id, role: 'user' as const }
    const shared = await modules.library.createPreset(aliceActor, { name: '共享风格', promptSuffix: '共享后缀', shared: true })
    await expect(modules.library.createPreset(bobActor, { name: '偷偷共享', promptSuffix: 'x', shared: true })).rejects.toMatchObject({ statusCode: 403 })
    const mine = await modules.library.createPreset(bobActor, { name: '鲍勃风格', promptSuffix: '鲍勃后缀' })
    await expect(modules.library.createPreset(bobActor, { name: '鲍勃风格', promptSuffix: '重复' })).rejects.toMatchObject({ statusCode: 409 })

    expect((await modules.library.listPresets(bobActor)).map(item => item.name)).toEqual(expect.arrayContaining(['共享风格', '鲍勃风格']))
    expect((await modules.library.listPresets(aliceActor)).map(item => item.name)).not.toContain('鲍勃风格')
    await expect(modules.library.updatePreset(bobActor, shared.id, { name: '改名' })).rejects.toMatchObject({ statusCode: 403 })
    await expect(modules.library.deletePreset(aliceActor, mine.id)).rejects.toMatchObject({ statusCode: 404 })
    expect(await modules.library.findUsablePreset(aliceActor, mine.id)).toBeNull()
    await modules.library.updatePreset(bobActor, mine.id, { enabled: false })
    expect(await modules.library.findUsablePreset(bobActor, mine.id)).toBeNull()
    await modules.library.deletePreset(bobActor, mine.id)
    await modules.library.updatePreset(aliceActor, shared.id, { promptSuffix: '新后缀' })

    const template = await modules.library.createTemplate(bobActor, { title: '我的模板', content: '内容' })
    expect((await modules.library.listTemplates(aliceActor)).some(item => item.id === template.id)).toBe(false)
    await expect(modules.library.useTemplate(aliceActor, template.id)).rejects.toMatchObject({ statusCode: 404 })
    await modules.library.useTemplate(bobActor, template.id)
    expect((await modules.library.listTemplates(bobActor)).find(item => item.id === template.id)?.useCount).toBe(1)
    await expect(modules.library.deleteTemplate(aliceActor, template.id)).rejects.toMatchObject({ statusCode: 404 })
    await modules.library.deleteTemplate(bobActor, template.id)
  })
})
