import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRecommendation } from '#server/services/promptRecommendParse'

const generateContent = vi.fn()
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent } },
  Modality: { IMAGE: 'IMAGE' },
}))

const prompt = (label: string, extra = '') => ({ scene: '白底主图', labelZh: label, explanationZh: '说明', prompt: `Model wearing the wig from the reference image, white background ${label} ${extra}`.trim() })
const valid = { analysis: { isWig: true, wigType: 'body wave', length: '24 inch', color: 'natural black', density: '180%', hairline: 'HD lace front', texture: 'body wave', summaryZh: '24寸黑色大波浪蕾丝前头套' }, prompts: [prompt('a'), prompt('b')] }

describe('推荐提示词解析', () => {
  it('解析合法 JSON', () => {
    const result = parseRecommendation(JSON.stringify(valid))
    expect(result?.analysis.wigType).toBe('body wave')
    expect(result?.prompts).toHaveLength(2)
  })

  it('兼容 ```json 代码块与前后多余文字', () => {
    expect(parseRecommendation(`好的：\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)?.prompts).toHaveLength(2)
  })

  it('丢弃不合规条目并去重，最多 6 条', () => {
    const items = [prompt('a'), prompt('a'), { scene: '白底主图', labelZh: '', prompt: 'x' }, ...Array.from({ length: 8 }, (_, i) => prompt(`n${i}`))]
    const result = parseRecommendation(JSON.stringify({ ...valid, prompts: items }))
    expect(result?.prompts).toHaveLength(6)
    expect(new Set(result?.prompts.map(item => item.prompt)).size).toBe(6)
  })

  it('analysis 缺字段时使用默认值', () => {
    const result = parseRecommendation(JSON.stringify({ analysis: {}, prompts: [prompt('a')] }))
    expect(result?.analysis).toMatchObject({ isWig: true, wigType: 'other' })
  })

  it('非 JSON、缺 prompts 或全部不合规时返回 null', () => {
    expect(parseRecommendation('sorry, I cannot help')).toBeNull()
    expect(parseRecommendation('{"analysis":{}}')).toBeNull()
    expect(parseRecommendation(JSON.stringify({ analysis: {}, prompts: [{ prompt: 'short' }] }))).toBeNull()
  })
})

describe('Vertex 多模态调用（mock）', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project'
    generateContent.mockReset()
  })

  it('请求 JSON 输出并汇总 token（含思考 token）', async () => {
    generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }],
      usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 600, thoughtsTokenCount: 400 },
    })
    const { describeImageWithVertex } = await import('#server/services/vertex')
    const result = await describeImageWithVertex({ model: 'gemini-2.5-flash', instruction: 'x', image: { data: Buffer.from('img'), mimeType: 'image/png' } })
    expect(generateContent.mock.calls[0]![0]).toMatchObject({ model: 'gemini-2.5-flash', config: { responseMimeType: 'application/json' } })
    expect(result).toMatchObject({ inputTokens: 1500, outputTokens: 1000 })
    expect(parseRecommendation(result.text)?.prompts).toHaveLength(2)
  })

  it('按官方 token 单价计算费用，未知模型返回 null', async () => {
    const { textModelCost } = await import('#server/services/promptRecommend')
    expect(textModelCost('gemini-2.5-flash', 1_000_000, 1_000_000)).toBe(2.8)
    expect(textModelCost('gemini-2.5-flash', 1500, 1000)).toBe(0.00295)
    expect(textModelCost('unknown', 1, 1)).toBeNull()
  })
})

describe('Vertex 错误分类', () => {
  it('按状态码给出具体中文错误', async () => {
    const { toRecommendError } = await import('#server/services/promptRecommend')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const vertexError = (status: number, message: string) => Object.assign(new Error(message), { status })
    expect(toRecommendError(vertexError(404, 'Publisher model was not found'), 'm').code).toBe('RECOMMEND_MODEL_UNAVAILABLE')
    expect(toRecommendError(vertexError(403, 'PERMISSION_DENIED'), 'm').code).toBe('RECOMMEND_PERMISSION_DENIED')
    expect(toRecommendError(vertexError(429, 'RESOURCE_EXHAUSTED'), 'm').code).toBe('RECOMMEND_QUOTA')
    expect(toRecommendError(new Error('Vertex 提示词推荐超时'), 'm').code).toBe('RECOMMEND_TIMEOUT')
    expect(toRecommendError(new Error('boom'), 'm').code).toBe('RECOMMEND_FAILED')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('status=404'))
    spy.mockRestore()
  })
})
