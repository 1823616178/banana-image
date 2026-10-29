/**
 * 内置假发电商预设提示词（写死在代码里，始终显示在创作页提示词区域）。
 * 面向外贸卖家：Amazon / Shopify / AliExpress 等平台的主图、场景图与细节图。
 */
export interface WigPromptPreset {
  id: string
  label: string
  prompt: string
}

export interface WigPromptGroup {
  scene: string
  items: WigPromptPreset[]
}

export const WIG_PROMPT_GROUPS: WigPromptGroup[] = [
  {
    scene: '白底主图',
    items: [
      { id: 'main-front', label: '正面白底主图', prompt: 'E-commerce main product photo of a professional model wearing the wig from the reference image, front view, head and shoulders, pure white seamless background (#FFFFFF), soft even studio lighting, natural undetectable hairline, hair texture and color exactly as in the reference, sharp focus, high resolution, Amazon listing style, no text, no watermark' },
      { id: 'main-mannequin', label: '假发头模白底', prompt: 'Clean product shot of the wig from the reference image on a neutral mannequin head, pure white background, centered composition, soft shadowless lighting, true-to-life color and curl pattern, every strand crisp, e-commerce catalog photo, no text' },
    ],
  },
  {
    scene: '生活场景',
    items: [
      { id: 'life-street', label: '城市街拍', prompt: 'Lifestyle photo of a confident Black woman wearing the wig from the reference image, walking on a sunny city street, golden hour light, hair moving naturally, candid smile, shallow depth of field, Shopify banner style, realistic skin texture' },
      { id: 'life-home', label: '居家自然光', prompt: 'Lifestyle portrait of a woman wearing the wig from the reference image, cozy modern living room, soft window light, relaxed pose, natural makeup, hair volume and shine clearly visible, authentic social media ad style' },
    ],
  },
  {
    scene: '发际线特写',
    items: [
      { id: 'detail-hairline', label: '蕾丝发际线特写', prompt: 'Extreme close-up of the front hairline of the wig from the reference image worn by a model, transparent HD lace melting into the skin, pre-plucked natural hairline with baby hair, visible individual knots, macro lens, soft diffused light, white background' },
      { id: 'detail-texture', label: '发丝纹理特写', prompt: 'Macro close-up of the hair texture of the wig from the reference image, showing curl pattern, density and natural shine, true color including any ombre or highlights, studio lighting, clean background, product detail photo' },
    ],
  },
  {
    scene: '侧面/背面',
    items: [
      { id: 'angle-side', label: '侧面展示', prompt: 'Side profile view of a model wearing the wig from the reference image, showing length, layers and volume from the side, pure white background, even studio lighting, e-commerce detail image, no text' },
      { id: 'angle-back', label: '背面展示', prompt: 'Back view of a model wearing the wig from the reference image, showing full length, density and how the hair falls, pure white background, soft studio light, e-commerce product photo, no text' },
    ],
  },
  {
    scene: '模特穿戴',
    items: [
      { id: 'model-diverse', label: '多肤色模特', prompt: 'Beauty portrait of a model with deep brown skin wearing the wig from the reference image, glamorous makeup, three-quarter angle, neutral beige backdrop, soft beauty-dish lighting, hair looks natural and glossy, high-end hair brand campaign' },
      { id: 'model-bust', label: '半身穿戴效果', prompt: 'Half-body photo of a smiling model wearing the wig from the reference image, simple elegant outfit, light grey studio background, natural pose, realistic hairline and parting, AliExpress product image style, high resolution' },
    ],
  },
]
