import { describe, expect, it } from 'vitest'
import { ASPECT_RATIOS, IMAGE_SIZES } from '#shared/config/models'
import { mapDimensions } from '#server/services/sensenova'

describe('SenseNova 尺寸映射与分辨率对齐', () => {
  it('1:1 比例在 1K 下映射为 1024x1024', () => {
    const dim = mapDimensions('1:1', '1K')
    expect(dim.width).toBe(1024)
    expect(dim.height).toBe(1024)
  })

  it('1:1 比例在 2K 下映射为 1536x1536 且保持 16 像素对齐', () => {
    const dim = mapDimensions('1:1', '2K')
    expect(dim.width).toBe(1536)
    expect(dim.height).toBe(1536)
    expect(dim.width % 16).toBe(0)
    expect(dim.height % 16).toBe(0)
  })

  it('16:9 比例在 1K 与 2K 下保持 16 像素对齐', () => {
    const dim1k = mapDimensions('16:9', '1K')
    expect(dim1k.width % 16).toBe(0)
    expect(dim1k.height % 16).toBe(0)

    const dim2k = mapDimensions('16:9', '2K')
    expect(dim2k.width % 16).toBe(0)
    expect(dim2k.height % 16).toBe(0)
  })

  it('所有支持的宽高比和分辨率均满足 16 像素对齐且在有效范围内', () => {
    for (const ratio of ASPECT_RATIOS) {
      for (const size of IMAGE_SIZES) {
        const { width, height } = mapDimensions(ratio, size)
        expect(width % 16, `width for ${ratio} @ ${size}`).toBe(0)
        expect(height % 16, `height for ${ratio} @ ${size}`).toBe(0)
        expect(width).toBeGreaterThanOrEqual(256)
        expect(width).toBeLessThanOrEqual(4096)
        expect(height).toBeGreaterThanOrEqual(256)
        expect(height).toBeLessThanOrEqual(4096)
      }
    }
  })
})
