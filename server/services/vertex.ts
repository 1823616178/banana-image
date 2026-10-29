import { GoogleGenAI, Modality } from '@google/genai'
import type { AspectRatio, ImageSize } from '#shared/types/api'
import { AppError } from '#server/utils/errors'
import { getServerConfig } from '#server/utils/config'
import { withTimeout } from '#server/utils/async'

export interface VertexReferenceImage {
  data: Buffer
  mimeType: string
}

export interface VertexImageRequest {
  prompt: string
  model: string
  aspectRatio: AspectRatio
  imageSize: ImageSize
  referenceImages?: VertexReferenceImage[]
}

export interface VertexImageResult {
  images: Array<{ data: Buffer, mimeType: string }>
  text: string
  finishReasons: string[]
  inputTokens: number
  outputTokens: number
}

let client: GoogleGenAI | undefined

export function getVertexClient() {
  if (client) return client
  const config = getServerConfig().vertex
  if (!config.project) {
    throw new AppError('VERTEX_NOT_CONFIGURED', '请先在 .env 中配置 GOOGLE_CLOUD_PROJECT', 503)
  }
  client = new GoogleGenAI({ vertexai: true, project: config.project, location: config.location })
  return client
}

export async function checkVertexConnection() {
  const config = getServerConfig().vertex
  await withTimeout(getVertexClient().models.get({ model: config.defaultModel }), 10_000, 'Vertex 连接超时')
}

export async function generateWithVertex(input: VertexImageRequest): Promise<VertexImageResult> {
  const parts: Array<{ text: string } | { inlineData: { data: string, mimeType: string } }> = [{ text: input.prompt }]
  for (const image of input.referenceImages ?? []) {
    parts.push({ inlineData: { data: image.data.toString('base64'), mimeType: image.mimeType } })
  }

  const response = await withTimeout(getVertexClient().models.generateContent({
    model: input.model,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: { aspectRatio: input.aspectRatio, imageSize: input.imageSize },
    },
  }), 120_000, 'Vertex 图像生成超时')

  const responseParts = response.candidates?.flatMap(candidate => candidate.content?.parts ?? []) ?? []
  const images = responseParts.flatMap((part) => {
    if (!part.inlineData?.data) return []
    return [{
      data: Buffer.from(part.inlineData.data, 'base64'),
      mimeType: part.inlineData.mimeType || 'image/png',
    }]
  })
  const text = responseParts.map(part => part.text).filter((value): value is string => Boolean(value)).join('\n')
  return {
    images,
    text,
    finishReasons: response.candidates?.map(candidate => String(candidate.finishReason ?? '')).filter(Boolean) ?? [],
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  }
}

/** 调用多模态文本模型分析图片，返回原始文本（期望为 JSON）与 token 用量。 */
export async function describeImageWithVertex(input: { model: string, instruction: string, image: VertexReferenceImage }) {
  const response = await withTimeout(getVertexClient().models.generateContent({
    model: input.model,
    contents: [{ role: 'user', parts: [{ text: input.instruction }, { inlineData: { data: input.image.data.toString('base64'), mimeType: input.image.mimeType } }] }],
    config: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 4096 },
  }), 60_000, 'Vertex 提示词推荐超时')
  const text = response.candidates?.flatMap(candidate => candidate.content?.parts ?? []).map(part => part.text).filter((value): value is string => Boolean(value)).join('\n') ?? ''
  return {
    text,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
  }
}
