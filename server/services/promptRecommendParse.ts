import { z } from 'zod'
import type { PromptRecommendationDto } from '#shared/types/api'

export const WIG_TYPES = ['lace front', 'full lace', 'bob', 'curly', 'straight', 'body wave', 'deep wave', 'kinky', 'water wave', 'other'] as const

const analysisSchema = z.object({
  isWig: z.boolean().default(true),
  wigType: z.string().trim().max(60).default('other'),
  length: z.string().trim().max(60).default(''),
  color: z.string().trim().max(80).default(''),
  density: z.string().trim().max(60).default(''),
  hairline: z.string().trim().max(80).default(''),
  texture: z.string().trim().max(80).default(''),
  summaryZh: z.string().trim().max(200).default(''),
})

const promptSchema = z.object({
  scene: z.string().trim().min(1).max(30),
  labelZh: z.string().trim().min(1).max(40),
  explanationZh: z.string().trim().max(120).default(''),
  prompt: z.string().trim().min(20).max(1200),
})

const responseSchema = z.object({
  analysis: analysisSchema,
  prompts: z.array(z.unknown()).min(1),
})

export const RECOMMENDATION_INSTRUCTION = `You are a prompt writer for a wig e-commerce image generator used by cross-border sellers (Amazon, Shopify, AliExpress, TikTok Shop).
Analyze the attached image (a wig product photo or a model wearing a wig). Identify: wig type (one of: ${WIG_TYPES.join(', ')}), length (inches if estimable), color (including ombre/highlights/root color), density, hairline/lace type, texture/curl pattern.
Then write 5 ready-to-use English image-generation prompts for e-commerce model shots of THIS wig. Cover different scenes: white-background main image, lifestyle, close-up hairline/lace detail, side or back view, and a model wearing shot. Use diverse model ethnicities where appropriate. Each prompt must say the model wears "the wig from the reference image" and repeat its key attributes so the hair stays faithful. No text or watermarks in images.
For each prompt give a short Chinese label (labelZh, <= 12 chars) and a one-sentence Chinese explanation (explanationZh). scene must be one of: 白底主图, 生活场景, 发际线特写, 侧面/背面, 模特穿戴.
If the image does not show a wig or hair, set analysis.isWig=false and still return generic wig e-commerce prompts.
Respond with JSON only, no markdown:
{"analysis":{"isWig":true,"wigType":"","length":"","color":"","density":"","hairline":"","texture":"","summaryZh":""},"prompts":[{"scene":"","labelZh":"","explanationZh":"","prompt":""}]}`

/** 去掉模型可能附带的 ```json 代码块包裹，取出第一个 JSON 对象。 */
function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

/**
 * 解析并校验模型返回的推荐结果；单条不合规的提示词会被丢弃，最多保留 6 条并按提示词去重。
 * 无法解析或没有可用提示词时返回 null。
 */
export function parseRecommendation(text: string): Pick<PromptRecommendationDto, 'analysis' | 'prompts'> | null {
  const raw = extractJson(text)
  const parsed = responseSchema.safeParse(raw)
  if (!parsed.success) return null
  const seen = new Set<string>()
  const prompts = parsed.data.prompts.flatMap((item) => {
    const result = promptSchema.safeParse(item)
    if (!result.success) return []
    const key = result.data.prompt.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [result.data]
  }).slice(0, 6)
  if (!prompts.length) return null
  return { analysis: parsed.data.analysis, prompts }
}
