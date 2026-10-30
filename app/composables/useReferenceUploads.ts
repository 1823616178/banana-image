import { computed, onMounted, onUnmounted, ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { ImageDto, PageDto } from '#shared/types/api'

const MAX_UPLOAD_BYTES = 7 * 1024 * 1024
const HISTORY_LIMIT = 6

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(element && (element.isContentEditable || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA'))
}

function hasDraggedFiles(event: DragEvent) {
  const types = event.dataTransfer?.types
  if (!types) return false
  return Array.from(types).includes('Files')
}

/**
 * 创作页参考图：选择 / 拖拽 / 粘贴上传，以及“最近上传”快捷复用。
 * maxReferences 随所选模型动态变化，超出上限的文件不会被上传。
 */
export function useReferenceUploads(maxReferences: MaybeRefOrGetter<number>) {
  const api = useApi()
  const toast = useToast()
  const references = ref<ImageDto[]>([])
  const uploadHistory = ref<ImageDto[]>([])
  const uploading = ref(false)
  const dragging = ref(false)

  const historyOptions = computed(() => uploadHistory.value
    .filter(item => !references.value.some(picked => picked.id === item.id))
    .slice(0, HISTORY_LIMIT))

  function isFull() {
    return references.value.length >= toValue(maxReferences)
  }

  function addReference(image: ImageDto) {
    if (references.value.some(item => item.id === image.id)) return
    const max = toValue(maxReferences)
    if (max <= 0) {
      toast.show('当前模型不支持参考图', 'info')
      return
    }
    if (isFull()) {
      toast.show(`最多使用 ${max} 张参考图`, 'info')
      return
    }
    references.value.push(image)
  }

  function removeReference(id: string) {
    references.value = references.value.filter(item => item.id !== id)
  }

  /** 上传成功后直接插入历史头部，避免再请求一次列表；服务端按哈希去重，可能返回已有记录。 */
  function rememberUpload(image: ImageDto) {
    uploadHistory.value = [image, ...uploadHistory.value.filter(item => item.id !== image.id)].slice(0, HISTORY_LIMIT * 2)
  }

  async function loadHistory() {
    try {
      // 多取一些，过滤掉已选中的参考图后仍能凑满 HISTORY_LIMIT 张
      const result = await api<PageDto<ImageDto>>('/api/images', { query: { source: 'upload', sort: 'newest', size: HISTORY_LIMIT * 2 } })
      uploadHistory.value = result.items
    } catch {
      // 历史仅是快捷入口，加载失败时保持现状，不打扰用户
    }
  }

  async function uploadFiles(input: FileList | File[] | null | undefined) {
    const files = Array.from(input ?? [])
    if (!files.length) return
    const max = toValue(maxReferences)
    if (max <= 0) {
      toast.show('当前模型不支持参考图', 'info')
      return
    }
    if (uploading.value) {
      toast.show('上一批图片还在上传，请稍候再试', 'info')
      return
    }
    uploading.value = true
    try {
      for (const file of files) {
        if (isFull()) {
          toast.show(`最多使用 ${max} 张参考图，其余图片未上传`, 'info')
          break
        }
        if (!file.type.startsWith('image/')) {
          toast.show(`${file.name} 不是图片`, 'error')
          continue
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.show(`${file.name} 超过 7MB`, 'error')
          continue
        }
        // 单张失败不影响同批其他图片
        try {
          const body = new FormData()
          body.append('file', file)
          const image = await api<ImageDto>('/api/uploads', { method: 'POST', body })
          rememberUpload(image)
          addReference(image)
        } catch (error) {
          toast.show(`${file.name}：${apiErrorMessage(error)}`, 'error')
        }
      }
    } finally {
      uploading.value = false
    }
  }

  function onFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    // 先清空，保证再次选择同一文件也能触发 change
    input.value = ''
    void uploadFiles(files)
  }

  function onDragOver(event: DragEvent) {
    if (!hasDraggedFiles(event)) return
    event.preventDefault()
    dragging.value = true
  }

  function onDragLeave(event: DragEvent) {
    // 在子元素之间移动也会触发 dragleave，只有真正离开拖放区才取消高亮
    const zone = event.currentTarget as Node
    if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) return
    dragging.value = false
  }

  function onDrop(event: DragEvent) {
    dragging.value = false
    void uploadFiles(event.dataTransfer?.files)
  }

  function onPaste(event: ClipboardEvent) {
    const data = event.clipboardData
    if (!data) return
    const types = Array.from(data.types ?? [])
    // 在输入框粘贴同时含文字与图片的内容（如 Word）时，保留默认的文字粘贴
    if (isEditableTarget(event.target) && types.includes('text/plain')) return

    const files = Array.from(data.files ?? []).filter(file => file.type.startsWith('image/'))
    const imageFiles = files.length
      ? files
      : Array.from(data.items ?? [])
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter((file): file is File => Boolean(file))

    if (!imageFiles.length) return
    event.preventDefault()
    void uploadFiles(imageFiles)
  }

  onMounted(() => {
    document.addEventListener('paste', onPaste)
    void loadHistory()
  })

  onUnmounted(() => {
    document.removeEventListener('paste', onPaste)
  })

  return {
    references,
    historyOptions,
    uploading,
    dragging,
    addReference,
    removeReference,
    uploadFiles,
    onFileChange,
    onDragOver,
    onDragLeave,
    onDrop,
  }
}
