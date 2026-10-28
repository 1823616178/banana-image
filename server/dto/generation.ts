import { z } from 'zod'
import { ASPECT_RATIOS, IMAGE_SIZES } from '#shared/config/models'

const id = z.string().trim().regex(/^\d{1,20}$/).refine(value => value !== '0')

export const createGenerationSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  model: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/),
  aspectRatio: z.enum(ASPECT_RATIOS),
  imageSize: z.enum(IMAGE_SIZES),
  count: z.number().int().min(1).max(4),
  refImageIds: z.array(id).max(14).default([]).refine(items => new Set(items).size === items.length),
  stylePresetId: id.nullable().optional(),
  parentImageId: id.nullable().optional(),
}).strict()

export const generationListSchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'partial', 'failed', 'blocked', 'canceled']).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  size: z.coerce.number().int().min(1).max(50).default(20),
}).strict()

export type CreateGenerationDto = z.infer<typeof createGenerationSchema>
