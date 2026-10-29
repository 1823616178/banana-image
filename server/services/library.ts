import { IsNull } from 'typeorm'
import type { PresetDto, TemplateDto, UserRole } from '#shared/types/api'
import { initializeDatabase } from '#server/db/data-source'
import { PromptTemplate } from '#server/db/entities/PromptTemplate'
import { StylePreset } from '#server/db/entities/StylePreset'
import { AppError } from '#server/utils/errors'

export interface Actor {
  id: string
  role: UserRole
}

const canEdit = (actor: Actor, ownerId: string | null) => ownerId === null ? actor.role === 'admin' : ownerId === actor.id

function toPresetDto(item: StylePreset, actor: Actor): PresetDto {
  return { id: item.id, name: item.name, promptSuffix: item.promptSuffix, sort: item.sort, enabled: item.enabled, shared: item.userId === null, editable: canEdit(actor, item.userId) }
}

function toTemplateDto(item: PromptTemplate, actor: Actor): TemplateDto {
  return { id: item.id, title: item.title, content: item.content, useCount: item.useCount, shared: item.userId === null, editable: canEdit(actor, item.userId) }
}

/** 共享（userId 为 null）与自己的条目；manage=false 时只返回启用的预设。 */
export async function listPresets(actor: Actor, manage = false) {
  const source = await initializeDatabase()
  const where = manage
    ? [{ userId: IsNull() }, { userId: actor.id }]
    : [{ userId: IsNull(), enabled: true }, { userId: actor.id, enabled: true }]
  const items = await source.getRepository(StylePreset).find({ where, order: { sort: 'ASC', id: 'ASC' } })
  return items.map(item => toPresetDto(item, actor))
}

export async function findUsablePreset(actor: Pick<Actor, 'id'>, id: string) {
  const source = await initializeDatabase()
  return source.getRepository(StylePreset).findOne({ where: [{ id, userId: IsNull(), enabled: true }, { id, userId: actor.id, enabled: true }] })
}

async function editablePreset(actor: Actor, id: string) {
  const source = await initializeDatabase()
  const item = await source.getRepository(StylePreset).findOne({ where: [{ id, userId: IsNull() }, { id, userId: actor.id }] })
  if (!item) throw new AppError('PRESET_NOT_FOUND', '风格预设不存在', 404)
  if (!canEdit(actor, item.userId)) throw new AppError('FORBIDDEN', '共享预设只有管理员可以修改', 403)
  return item
}

async function assertUniqueName(ownerId: string | null, name: string, exceptId?: string) {
  const source = await initializeDatabase()
  const existing = await source.getRepository(StylePreset).findOneBy({ userId: ownerId ?? IsNull(), name })
  if (existing && existing.id !== exceptId) throw new AppError('PRESET_NAME_TAKEN', '已有同名预设', 409)
}

export async function createPreset(actor: Actor, input: { name: string, promptSuffix: string, sort?: number, enabled?: boolean, shared?: boolean }) {
  if (input.shared && actor.role !== 'admin') throw new AppError('FORBIDDEN', '只有管理员可以创建共享预设', 403)
  const ownerId = input.shared ? null : actor.id
  await assertUniqueName(ownerId, input.name)
  const source = await initializeDatabase()
  const repository = source.getRepository(StylePreset)
  const item = await repository.save(repository.create({ userId: ownerId, name: input.name, promptSuffix: input.promptSuffix, sort: input.sort ?? 100, enabled: input.enabled ?? true, coverImageId: null }))
  return toPresetDto(item, actor)
}

export async function updatePreset(actor: Actor, id: string, input: Partial<{ name: string, promptSuffix: string, sort: number, enabled: boolean }>) {
  const item = await editablePreset(actor, id)
  if (input.name !== undefined && input.name !== item.name) await assertUniqueName(item.userId, input.name, item.id)
  Object.assign(item, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)))
  const source = await initializeDatabase()
  return toPresetDto(await source.getRepository(StylePreset).save(item), actor)
}

export async function deletePreset(actor: Actor, id: string) {
  const item = await editablePreset(actor, id)
  const source = await initializeDatabase()
  await source.getRepository(StylePreset).delete({ id: item.id })
  return { id }
}

export async function listTemplates(actor: Actor) {
  const source = await initializeDatabase()
  const items = await source.getRepository(PromptTemplate).find({ where: [{ userId: IsNull() }, { userId: actor.id }], order: { useCount: 'DESC', id: 'ASC' }, take: 200 })
  return items.map(item => toTemplateDto(item, actor))
}

async function editableTemplate(actor: Actor, id: string) {
  const source = await initializeDatabase()
  const item = await source.getRepository(PromptTemplate).findOne({ where: [{ id, userId: IsNull() }, { id, userId: actor.id }] })
  if (!item) throw new AppError('TEMPLATE_NOT_FOUND', '常用提示词不存在', 404)
  if (!canEdit(actor, item.userId)) throw new AppError('FORBIDDEN', '共享提示词只有管理员可以修改', 403)
  return item
}

export async function createTemplate(actor: Actor, input: { title: string, content: string, shared?: boolean }) {
  if (input.shared && actor.role !== 'admin') throw new AppError('FORBIDDEN', '只有管理员可以创建共享提示词', 403)
  const source = await initializeDatabase()
  const repository = source.getRepository(PromptTemplate)
  const item = await repository.save(repository.create({ userId: input.shared ? null : actor.id, title: input.title, content: input.content, useCount: 0 }))
  return toTemplateDto(item, actor)
}

export async function updateTemplate(actor: Actor, id: string, input: Partial<{ title: string, content: string }>) {
  const item = await editableTemplate(actor, id)
  if (input.title !== undefined) item.title = input.title
  if (input.content !== undefined) item.content = input.content
  const source = await initializeDatabase()
  return toTemplateDto(await source.getRepository(PromptTemplate).save(item), actor)
}

export async function deleteTemplate(actor: Actor, id: string) {
  const item = await editableTemplate(actor, id)
  const source = await initializeDatabase()
  await source.getRepository(PromptTemplate).delete({ id: item.id })
  return { id }
}

/** 记录一次使用（共享或自己的），用于按热度排序。 */
export async function useTemplate(actor: Actor, id: string) {
  const source = await initializeDatabase()
  const result = await source.getRepository(PromptTemplate).createQueryBuilder().update().set({ useCount: () => 'useCount + 1' })
    .where('id = :id AND (userId IS NULL OR userId = :userId)', { id, userId: actor.id }).execute()
  if (!result.affected) throw new AppError('TEMPLATE_NOT_FOUND', '常用提示词不存在', 404)
  return { id }
}
