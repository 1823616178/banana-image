import { defaultModel, resolveModelCapabilities } from '#shared/config/models'
import type { ModelDefinition } from '#shared/config/models'
import type { AspectRatio, ImageSize } from '#shared/types/api'
import { getServerConfig } from '#server/utils/config'
import { AppError } from '#server/utils/errors'

export function resolveConfiguredModels(configured: readonly (ModelDefinition | string)[], config = getServerConfig()) {
  const stored = new Map(configured.filter((item): item is ModelDefinition => typeof item !== 'string').map(item => [item.id, item]))
  const ids = new Set([...configured.map(item => typeof item === 'string' ? item : item.id), ...config.vertex.models, ...config.sensenova.models, ...config.copilot.models])
  return [...ids].map((id) => {
    const definition = defaultModel(id) ?? stored.get(id)
    const provider = definition?.provider ?? (config.sensenova.models.includes(id) ? 'sensenova' : config.copilot.models.includes(id) ? 'copilot' : undefined)
    const capabilities = resolveModelCapabilities(id, { ...definition, provider })
    return { id, definition, ...capabilities, enabled: capabilities.provider === 'sensenova' ? Boolean(config.sensenova.apiKey) : capabilities.provider === 'copilot' ? Boolean(config.copilot.baseUrl) : true }
  })
}

export function validateModelRequest(model: ReturnType<typeof resolveConfiguredModels>[number], input: { aspectRatio: AspectRatio, imageSize: ImageSize, refImageIds: readonly string[] }) {
  if (!model.enabled) {
    if (model.provider === 'copilot') throw new AppError('COPILOT_NOT_CONFIGURED', '请先配置 COPILOT_BASE_URL 后再使用 Copilot 模型', 503)
    throw new AppError('SENSENOVA_NOT_CONFIGURED', '请先配置 SENSENOVA_API_KEY 后再使用商汤模型', 503)
  }
  if (!model.supportedAspectRatios.includes(input.aspectRatio)) {
    throw new AppError('UNSUPPORTED_ASPECT_RATIO', '所选模型不支持该画布比例', 400)
  }
  if (!model.supportedImageSizes.includes(input.imageSize)) {
    throw new AppError('UNSUPPORTED_IMAGE_SIZE', '所选模型不支持该分辨率', 400)
  }
  if (input.refImageIds.length > model.maxReferenceImages) {
    throw new AppError('TOO_MANY_REFERENCES', model.maxReferenceImages === 0 ? '所选模型不支持参考图' : `最多使用 ${model.maxReferenceImages} 张参考图`, 400)
  }
}
