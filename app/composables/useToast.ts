export type ToastKind = 'info' | 'success' | 'error'

export interface ToastMessage {
  id: number
  message: string
  kind: ToastKind
}

const nextId = () => Date.now() + Math.floor(Math.random() * 1000)

export function useToast() {
  const messages = useState<ToastMessage[]>('toast-messages', () => [])

  const dismiss = (id: number) => {
    messages.value = messages.value.filter(item => item.id !== id)
  }

  const show = (message: string, kind: ToastKind = 'info', duration = 3600) => {
    const id = nextId()
    messages.value.push({ id, message, kind })
    if (import.meta.client && duration > 0) {
      window.setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  return { messages, show, dismiss }
}
