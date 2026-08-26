'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useRef, useEffect } from 'react'
import { Search } from '@seul/icons'

export function ProductSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentQ = searchParams.get('q') ?? ''

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== currentQ) {
      inputRef.current.value = currentQ
    }
  }, [currentQ])

  const updateSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [pathname, router, searchParams],
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateSearch(value), 350)
  }

  return (
    <div
      className="relative flex items-center"
      style={{ maxWidth: 480 }}
    >
      <div
        className="absolute left-3 pointer-events-none"
        style={{ color: 'var(--color-heuk)', opacity: isPending ? 0.3 : 0.4 }}
      >
        <Search size={16} />
      </div>
      <input
        ref={inputRef}
        type="search"
        defaultValue={currentQ}
        onChange={handleChange}
        placeholder="Buscar productos..."
        className="w-full font-body text-sm pl-9 pr-4 py-2.5"
        style={{
          background: 'var(--color-baek-pure)',
          border: 'var(--border-editorial)',
          color: 'var(--color-heuk)',
          outline: 'none',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-heuk)' }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
        aria-label="Buscar productos"
      />
    </div>
  )
}
