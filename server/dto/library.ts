import { z } from 'zod'

export const presetInputSchema = z.object({
  name: z.string().trim().min(1).max(32),
  promptSuffix: z.string().trim().min(1).max(2000),
  sort: z.number().int().min(-100000).max(100000).optional(),
  enabled: z.boolean().optional(),
  shared: z.boolean().optional(),
}).strict()

export const presetUpdateSchema = presetInputSchema.omit({ shared: true }).partial().strict()

export const templateInputSchema = z.object({
  title: z.string().trim().min(1).max(64),
  content: z.string().trim().min(1).max(4000),
  shared: z.boolean().optional(),
}).strict()

export const templateUpdateSchema = templateInputSchema.omit({ shared: true }).partial().strict()

export const libraryListSchema = z.object({
  manage: z.enum(['1', 'true']).optional(),
}).strict()
