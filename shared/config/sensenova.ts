import type { AspectRatio, ImageSize } from '../types/api'

// U1.5 Lite 文档：比例限制 1:3 到 3:1，分辨率 1K / 2K / 4K，宽高按 32 像素对齐。
export const SENSENOVA_IMAGE_SIZES: readonly ImageSize[] = ['1K', '2K', '4K']
export const SENSENOVA_ASPECT_RATIOS: readonly AspectRatio[] = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9']
export const SENSENOVA_MAX_REFERENCE_IMAGES = 5
