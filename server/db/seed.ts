import type { DataSource } from 'typeorm'
import { IsNull } from 'typeorm'
import { DEFAULT_MODELS } from '#shared/config/models'
import { PromptTemplate } from '#server/db/entities/PromptTemplate'
import { Setting } from '#server/db/entities/Setting'
import { StylePreset } from '#server/db/entities/StylePreset'

// 新安装时写入的假发电商风格预设（已有数据库不会被改动）。
const presets = [
  { name: '白底电商', promptSuffix: 'Pure white seamless background, soft even studio lighting, e-commerce main image for Amazon/Shopify, no text, no watermark.', sort: 10 },
  { name: '高级棚拍', promptSuffix: 'High-end hair brand campaign look, beauty-dish lighting, neutral backdrop, glossy healthy hair, retouched but realistic skin.', sort: 20 },
  { name: '自然生活', promptSuffix: 'Authentic lifestyle photo, natural daylight, candid pose, social media ad style, realistic skin texture.', sort: 30 },
  { name: '细节微距', promptSuffix: 'Macro close-up, sharp individual strands and lace knots, natural undetectable hairline, soft diffused light.', sort: 40 },
  { name: '社媒竖版', promptSuffix: 'Vertical TikTok/Instagram style frame, trendy outfit, vibrant but natural colors, hair in motion.', sort: 50 },
]

const settings = [
  { key: 'defaults', value: { model: DEFAULT_MODELS[0]!.id, aspectRatio: '1:1', imageSize: '1K', count: 1 } },
  { key: 'dailyBudgetUsd', value: 0 },
  { key: 'rateLimitPerMinute', value: 10 },
  // 单价默认留空：未覆盖时使用 shared/config/models.ts 中的官方价格，管理员可在设置页覆盖。
  { key: 'pricing', value: {} },
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
    { title: '白底主图·正面', content: 'E-commerce main photo of a model wearing the wig from the reference image, front view, head and shoulders, pure white background, soft studio lighting, natural hairline, no text.' },
    { title: '蕾丝发际线特写', content: 'Extreme close-up of the HD lace front hairline of the wig from the reference image on a model, pre-plucked hairline with baby hair, macro lens, white background.' },
    { title: '生活场景街拍', content: 'Lifestyle photo of a confident woman wearing the wig from the reference image on a sunny city street, golden hour, hair moving naturally, shallow depth of field.' },
  ]
  const templateRepository = source.getRepository(PromptTemplate)
  for (const template of templates) {
    if (!await templateRepository.findOneBy({ title: template.title, userId: IsNull() })) {
      await templateRepository.save(templateRepository.create({ ...template, userId: null }))
    }
  }
  await source.createQueryBuilder().insert().into(Setting).values({ key: 'seed:libraryVersion', value: 1 }).orIgnore().execute()
}
