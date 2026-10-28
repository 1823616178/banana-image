import { existsSync } from 'node:fs'
import { DEFAULT_MODELS } from '../shared/config/models'

if (existsSync('.env')) process.loadEnvFile('.env')

const { checkVertexConnection, generateWithVertex } = await import('../server/services/vertex')
const { getServerConfig } = await import('../server/utils/config')

const shouldGenerate = process.argv.includes('--generate')
const configured = getServerConfig().vertex
const modelIds = [...new Set(configured.models.flatMap(id => id.endsWith('-preview') ? [id] : [id, `${id}-preview`]))]
const available: string[] = []

console.info(`Vertex project: ${configured.project || '(not configured)'}`)
console.info(`Mode: ${shouldGenerate ? 'paid image generation' : 'metadata only'}`)

for (const model of modelIds) {
  process.env.DEFAULT_IMAGE_MODEL = model
  try {
    if (shouldGenerate) {
      const definition = DEFAULT_MODELS.find(item => item.id === model)
      const result = await generateWithVertex({
        prompt: 'A small yellow banana on a linen canvas, simple oil painting.',
        model,
        aspectRatio: '1:1',
        imageSize: '1K',
      })
      if (!result.images.length) throw new Error(result.text || `No image returned (${result.finishReasons.join(', ')})`)
      console.info(`OK ${model} (${result.images.length} image, ${result.images[0]!.data.length} bytes${definition ? '' : ', preview variant'})`)
    } else {
      await checkVertexConnection()
      console.info(`OK ${model}`)
    }
    available.push(model)
  } catch (error) {
    console.error(`FAIL ${model}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

console.info(`\nAvailable models (${available.length}):\n${available.join('\n') || '(none)'}`)
if (!available.length) process.exitCode = 1
