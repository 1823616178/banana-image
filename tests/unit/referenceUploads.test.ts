import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useReferenceUploads } from '../../app/composables/useReferenceUploads'
import type { ImageDto } from '#shared/types/api'

vi.mock('vue', async (importOriginal) => ({ ...await importOriginal<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn() }))

let scope: ReturnType<typeof effectScope>
const toast = vi.fn()
const api = vi.fn()
const image = (id: string) => ({ id } as ImageDto)

beforeEach(() => {
  vi.clearAllMocks()
  scope = effectScope()
  vi.stubGlobal('useApi', () => api)
  vi.stubGlobal('useToast', () => ({ show: toast }))
})

afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
})

describe('参考图随模型能力变化', () => {
  it('切换为纯文生图时立即移除已有参考图并提示', () => {
    const max = ref(14)
    const uploads = scope.run(() => useReferenceUploads(max))!
    uploads.addReference(image('1'))
    max.value = 0
    expect(uploads.references.value).toEqual([])
    expect(toast).toHaveBeenCalledWith('当前模型不支持参考图，已移除所选参考图', 'info')
  })

  it('降低参考图上限时保留上限内的图片', () => {
    const max = ref(14)
    const uploads = scope.run(() => useReferenceUploads(max))!
    uploads.addReference(image('1'))
    uploads.addReference(image('2'))
    max.value = 1
    expect(uploads.references.value.map(item => item.id)).toEqual(['1'])
  })

  it('上传过程中切到纯文生图，完成的图片只进入历史，不重新加入参考图', async () => {
    const max = ref(14)
    const uploads = scope.run(() => useReferenceUploads(max))!
    let complete!: (value: ImageDto) => void
    api.mockReturnValue(new Promise<ImageDto>(resolve => { complete = resolve }))
    const pending = uploads.uploadFiles([new File(['image'], 'cat.png', { type: 'image/png' })])
    max.value = 0
    complete(image('1'))
    await pending
    expect(uploads.references.value).toEqual([])
    expect(uploads.historyOptions.value.map(item => item.id)).toEqual(['1'])
    expect(uploads.uploading.value).toBe(false)
  })

  it('纯文生图模型不会发起图片上传', async () => {
    const uploads = scope.run(() => useReferenceUploads(0))!
    await uploads.uploadFiles([new File(['image'], 'cat.png', { type: 'image/png' })])
    expect(api).not.toHaveBeenCalled()
  })
})
