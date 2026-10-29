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

export const imageListSchema = z.object({
  q: z.string().trim().max(200).optional().transform(value => value || undefined),
  model: z.string().trim().max(64).optional().transform(value => value || undefined),
  ratio: z.enum(ASPECT_RATIOS).optional(),
  favorite: z.enum(['true', 'false', '1', '0']).optional().transform(value => value === 'true' || value === '1'),
  source: z.enum(['generated', 'upload']).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  size: z.coerce.number().int().min(1).max(60).default(24),
}).strict()

export const favoriteSchema = z.object({ favorite: z.boolean() }).strict()

export const settingsUpdateSchema = z.object({
  defaults: z.object({
    model: z.string().trim().min(1).max(64).optional(),
    aspectRatio: z.enum(ASPECT_RATIOS).optional(),
    imageSize: z.enum(IMAGE_SIZES).optional(),
    count: z.number().int().min(1).max(4).optional(),
  }).strict().optional(),
  dailyBudgetUsd: z.number().min(0).max(100000).optional(),
  rateLimitPerMinute: z.number().int().min(0).max(1000).optional(),
  creditGrantUsd: z.number().min(0).max(1000000).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  allowRegistration: z.boolean().optional(),
  pricing: z.record(z.string().min(1).max(64), z.object({
    '1K': z.number().min(0).max(100).optional(),
    '2K': z.number().min(0).max(100).optional(),
    '4K': z.number().min(0).max(100).optional(),
  }).strict()).optional(),
}).strict()

export const usageQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).default('30d'),
}).strict()
