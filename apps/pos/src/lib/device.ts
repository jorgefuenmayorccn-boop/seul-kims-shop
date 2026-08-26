export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr'
  let id = localStorage.getItem('seul_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('seul_device_id', id)
  }
  return id
}

export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Terminal'
  return localStorage.getItem('seul_device_label') ?? 'Terminal'
}

export function setDeviceLabel(label: string): void {
  localStorage.setItem('seul_device_label', label)
}
