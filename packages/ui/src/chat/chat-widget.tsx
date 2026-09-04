'use client'
import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, ExternalLink } from 'lucide-react'
import { cn } from '../lib/utils'

const API = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787')
  : 'http://localhost:8787'

interface Message {
  role:    'user' | 'assistant'
  content: string
}

const GREETING: Message = {
  role:    'assistant',
  content: '¡Annyeong! Soy el asistente de Seoul Shop. ¿En qué puedo ayudarte hoy? Puedo orientarte sobre productos, delivery o tu subsidio BAES.',
}

export function ChatWidget() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res  = await fetch(`${API}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: next }),
      })
      const data = await res.json() as { reply?: string; error?: string }

      setMessages(prev => [...prev, {
        role:    'assistant',
        content: data.reply ?? 'Lo siento, ocurrió un error. Escríbenos al WhatsApp.',
      }])
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Error de conexión. Puedes escribirnos directo al WhatsApp: +56 9 4878 5299',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Abrir asistente"
        className={cn(
          'fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95',
          'bg-[var(--color-brand)] text-white',
          open && 'hidden',
        )}
      >
        <MessageCircle className="size-6" />
      </button>

      {/* Panel de chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex w-80 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-[var(--color-brand)] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>KR</span>
              <div>
                <p className="text-sm font-bold">Asistente Seoul Shop</p>
                <p className="text-xs opacity-80">Responde en segundos</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/20">
              <X className="size-4" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: '320px' }}>
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'rounded-tr-sm bg-[var(--color-brand)] text-white'
                    : 'rounded-tl-sm bg-[var(--color-surface-sunken)] text-[var(--color-text)]',
                )}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-[var(--color-surface-sunken)] px-4 py-2">
                  <Loader2 className="size-4 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--color-border)] p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Escribe tu pregunta…"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
                disabled={loading}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-brand)] text-white disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>

            <a
              href="https://wa.me/56948785299"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-brand)]"
            >
              <ExternalLink className="size-3" />
              Prefiero hablar con una persona
            </a>
          </div>
        </div>
      )}
    </>
  )
}
