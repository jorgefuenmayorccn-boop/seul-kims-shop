'use client'
import { useState, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { API_BASE } from '@/lib/client-api'

type ImageItem = { id: string; url: string; sortOrder: number }

interface Props { productId: string; initial?: ImageItem[] }

export function ImageUploader({ productId, initial = [] }: Props) {
  const [images, setImages]   = useState<ImageItem[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(''); setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        const res  = await fetch(`${API_BASE}/api/products/${productId}/images`, { method: 'POST', credentials: 'include', body: fd })
        const data = await res.json() as { ok?: boolean; id?: string; url?: string; error?: string }
        if (!res.ok || !data.ok) { setError(data.error ?? 'Error al subir'); break }
        setImages(prev => [...prev, { id: data.id!, url: `${API_BASE}${data.url}`, sortOrder: prev.length }])
      }
    } catch { setError('No se pudo subir la imagen') }
    finally  { setUploading(false) }
  }

  async function deleteImage(imageId: string) {
    const res = await fetch(`${API_BASE}/api/products/${productId}/images/${imageId}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) setImages(prev => prev.filter(i => i.id !== imageId))
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {images.map((img, idx) => (
            <div key={img.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-border)] bg-background">
              <img src={img.url} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && <span className="absolute top-1 left-1 bg-brand text-white text-[9px] font-bold px-1 rounded">PORTADA</span>}
              <button type="button" onClick={() => deleteImage(img.id)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-error text-white items-center justify-center hidden group-hover:flex">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center cursor-pointer hover:border-brand transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        {uploading ? <Loader2 size={20} className="mx-auto animate-spin text-brand" /> : <Upload size={20} className="mx-auto text-text-muted" />}
        <p className="text-xs text-text-muted font-body mt-2">
          {uploading ? 'Subiendo…' : 'Arrastra imágenes o haz clic · JPG, PNG, WebP · máx 5MB'}
        </p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>
      {error && <p className="text-xs text-error font-body">{error}</p>}
    </div>
  )
}
