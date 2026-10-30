import type { AspectRatio, ImageSize } from '../types/api'

// 官方尺寸桶：https://github.com/OpenSenseNova/SenseNova-Skills/blob/main/skills/sn-image-base/scripts/sn_image_base/generation/sensenova.py
export const SENSENOVA_DIMENSIONS: Partial<Record<ImageSize, Partial<Record<AspectRatio, readonly [number, number]>>>> = {
  '1K': {
    '1:1': [1344, 1344],
    '2:3': [1088, 1632],
    '3:2': [1632, 1088],
    '3:4': [1152, 1536],
    '4:3': [1536, 1152],
    '4:5': [1184, 1472],
    '5:4': [1472, 1184],
    '16:9': [1792, 992],
    '9:16': [992, 1792],
  },
  '2K': {
    '1:1': [2048, 2048],
    '2:3': [1664, 2496],
    '3:2': [2496, 1664],
    '3:4': [1760, 2368],
    '4:3': [2368, 1760],
    '4:5': [1824, 2272],
    '5:4': [2272, 1824],
    '16:9': [2752, 1536],
    '9:16': [1536, 2752],
  },
}

export const SENSENOVA_IMAGE_SIZES = Object.keys(SENSENOVA_DIMENSIONS) as ImageSize[]
export const SENSENOVA_ASPECT_RATIOS = Object.keys(SENSENOVA_DIMENSIONS['2K']!) as AspectRatio[]
