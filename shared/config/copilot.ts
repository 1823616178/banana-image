import type { AspectRatio, ImageSize } from '../types/api'

// Microsoft Copilot（自建 OpenAI 兼容服务）：无尺寸参数，固定输出约 1024×1536 / 1536×1024；
// 比例只能通过提示词文字引导，因此只开放常见比例与 1K 档位。
// 参考图走 /v1/images/edits（上游 UploadFile + messageAnnotations），与 Copilot API 的 COPILOT_MAX_INPUT_IMAGES 默认值一致。
export const COPILOT_IMAGE_SIZES: readonly ImageSize[] = ['1K']
export const COPILOT_ASPECT_RATIOS: readonly AspectRatio[] = ['1:1', '3:2', '2:3', '3:4', '4:3', '9:16', '16:9']
export const COPILOT_MAX_REFERENCE_IMAGES = 4
