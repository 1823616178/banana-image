import type { DataSource } from 'typeorm'
import { IsNull } from 'typeorm'
import { DEFAULT_MODELS } from '#shared/config/models'
import { PromptTemplate } from '#server/db/entities/PromptTemplate'
import { Setting } from '#server/db/entities/Setting'
import { StylePreset } from '#server/db/entities/StylePreset'

const presets = [
  { name: '油画', promptSuffix: '以经典油画呈现，可见细腻笔触与亚麻画布肌理，色彩层次丰富。', sort: 10 },
  { name: '水彩', promptSuffix: '以轻盈水彩呈现，颜料自然晕染，保留纸张纹理与通透留白。', sort: 20 },
  { name: '厚涂', promptSuffix: '以厚涂油画呈现，调色刀笔触明显，颜料立体，光影浓郁。', sort: 30 },
  { name: '印象派', promptSuffix: '以印象派风格呈现，捕捉瞬时光影，色点交织，轮廓柔和。', sort: 40 },
  { name: '水墨', promptSuffix: '以中国水墨画呈现，墨色浓淡相宜，线条简练，留白富有意境。', sort: 50 },
]

const settings = [
  { key: 'defaults', value: { model: DEFAULT_MODELS[0]!.id, aspectRatio: '1:1', imageSize: '1K', count: 1 } },
  { key: 'dailyBudgetUsd', value: 0 },
  { key: 'rateLimitPerMinute', value: 10 },
  { key: 'pricing', value: Object.fromEntries(DEFAULT_MODELS.map(model => [model.id, model.prices])) },
  { key: 'theme', value: 'system' },
  { key: 'creditGrantUsd', value: 0 },
  { key: 'models', value: DEFAULT_MODELS },
]

export async function seedDatabase(source: DataSource) {
  // 预设与模板只在首次初始化时写入一次，管理员删除后不会在重启时被恢复。
  const settingRepository = source.getRepository(Setting)
  if (await settingRepository.findOneBy({ key: 'seed:libraryVersion' })) return
  const presetRepository = source.getRepository(StylePreset)
  for (const preset of presets) {
    if (!await presetRepository.findOneBy({ name: preset.name, userId: IsNull() })) {
      await presetRepository.save(presetRepository.create({ ...preset, userId: null, enabled: true, coverImageId: null }))
    }
  }
  const templates = [
    { title: '暮色花田', content: '暮色里的向日葵花田，远处有群青色的山，风穿过花瓣，厚涂油画质感。' },
    { title: '雨夜街巷', content: '雨后的老街，暖色灯光映在石板路上，一位撑伞的行人，电影感构图。' },
  ]
  const templateRepository = source.getRepository(PromptTemplate)
  for (const template of templates) {
    if (!await templateRepository.findOneBy({ title: template.title, userId: IsNull() })) {
      await templateRepository.save(templateRepository.create({ ...template, userId: null }))
    }
  }
  await source.createQueryBuilder().insert().into(Setting).values({ key: 'seed:libraryVersion', value: 1 }).orIgnore().execute()
}
