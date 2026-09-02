'use client'
import { useEffect, useState } from 'react'
import { Users, Plus, UserCheck, UserX, ChevronDown, Trash2 } from 'lucide-react'
import { friendlyErrorMessage } from '@seul/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

type Role = 'owner' | 'admin' | 'staff' | 'delivery' | 'viewer'

interface User {
  id:               string
  email:            string
  name:             string
  role:             Role
  isActive:         boolean
  cargo:            string | null
  departamento:     string | null
  telefonoPersonal: string | null
  lastLoginAt:      string | null
  createdAt:        string
}

const ROLE_LABELS: Record<Role, string> = {
  owner:    'Owner',
  admin:    'Admin',
  staff:    'Staff',
  delivery: 'Delivery',
  viewer:   'Viewer',
}

const ROLE_COLORS: Record<Role, string> = {
  owner:    'bg-brand/10 text-brand',
  admin:    'bg-amber-100 text-amber-700',
  staff:    'bg-green-100 text-green-700',
  delivery: 'bg-blue-100 text-blue-700',
  viewer:   'bg-surface text-text-muted',
}

const emptyForm = { name: '', email: '', password: '', role: 'staff' as Role, cargo: '', departamento: '', telefonoPersonal: '' }

export default function UsuariosPage() {
  const [users,      setUsers]      = useState<User[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editRole,   setEditRole]   = useState<Role>('staff')
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/auth/users`, { credentials: 'include' })
      if (!r.ok) throw new Error('Error al cargar usuarios')
      const d = await r.json() as { users: User[] }
      setUsers(d.users ?? [])
    } catch (err) {
      console.error('[cerebro/usuarios]', err)
      setError(friendlyErrorMessage(err instanceof Error ? err.message : undefined, 'Error de conexión'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const r = await fetch(`${API}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (r.ok) {
      setShowForm(false); setForm(emptyForm); load()
    } else {
      const d = await r.json() as { error?: string }
      setError(d.error ?? 'Error al crear usuario')
    }
  }

  async function toggleActive(user: User) {
    const r = await fetch(`${API}/api/auth/users/${user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (!r.ok) { const d = await r.json() as { error?: string }; setError(d.error ?? 'Error'); return }
    load()
  }

  async function saveRole(userId: string, role: Role) {
    const r = await fetch(`${API}/api/auth/users/${userId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ role }),
    })
    if (!r.ok) { const d = await r.json() as { error?: string }; setError(d.error ?? 'Error'); return }
    setEditingId(null); load()
  }

  async function deleteUser(user: User) {
    if (!window.confirm(`¿Eliminar a ${user.name}? Esta acción lo desactivará del sistema.`)) return
    const r = await fetch(`${API}/api/auth/users/${user.id}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok) { const d = await r.json() as { error?: string }; setError(d.error ?? 'Error al eliminar'); return }
    load()
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2"><Users size={22}/>Usuarios</h1>
          <p className="mt-1 text-sm text-text-muted">Gestión de accesos al sistema</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: 'var(--color-brand)', color: '#fff' }}>
          <Plus size={16} />Nuevo usuario
        </button>
      </div>

      {error && !showForm && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-subtle border border-error text-sm text-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 text-error hover:opacity-70">✕</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
          <p className="font-semibold text-text">Crear usuario</p>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'name',             label: 'Nombre completo', placeholder: 'Nombre completo', type: 'text',     required: true  },
              { key: 'email',            label: 'Email',           placeholder: 'email@example.cl', type: 'email',    required: true  },
              { key: 'password',         label: 'Contraseña',      placeholder: 'Mínimo 8 caracteres', type: 'password', required: true  },
              { key: 'cargo',            label: 'Cargo',           placeholder: 'Cajera, Repartidor…', type: 'text',     required: false },
              { key: 'departamento',     label: 'Departamento',    placeholder: 'Operaciones, Ventas…', type: 'text',     required: false },
              { key: 'telefonoPersonal', label: 'Teléfono personal', placeholder: '+56 9 …',           type: 'tel',      required: false },
            ] as Array<{key: keyof typeof form, label: string, placeholder: string, type: string, required: boolean}>).map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-text-muted mb-1">{f.label}</label>
                <input
                  required={f.required} type={f.type}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Rol</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as Role }))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-text focus:outline-none focus:ring-2 focus:ring-brand/30">
                <option value="staff">Staff</option>
                <option value="delivery">Delivery</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--color-brand)', color: '#fff' }}>
              {saving ? 'Creando…' : 'Crear usuario'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Usuario</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Cargo</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Rol</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Último acceso</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wide">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-text-muted">Cargando…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-text-muted">Sin usuarios</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="bg-[var(--color-background)] hover:bg-[var(--color-surface)] transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'var(--color-brand)', color: '#fff', opacity: user.isActive ? 1 : 0.4 }}>
                      {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-text">{user.name}</p>
                      <p className="text-xs text-text-muted font-mono">{user.email}</p>
                      {user.telefonoPersonal && (
                        <p className="text-[10px] text-text-muted">{user.telefonoPersonal}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <p className="text-xs text-text">{user.cargo ?? '—'}</p>
                  {user.departamento && <p className="text-[10px] text-text-muted">{user.departamento}</p>}
                </td>
                <td className="px-5 py-3.5">
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <select value={editRole} onChange={e => setEditRole(e.target.value as Role)}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-text">
                        {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                      <button onClick={() => saveRole(user.id, editRole)}
                        className="text-xs px-2 py-1 rounded font-medium"
                        style={{ background: 'var(--color-brand)', color: '#fff' }}>OK</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-xs px-2 py-1 rounded text-text-muted hover:text-text">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(user.id); setEditRole(user.role) }}
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                      {user.role !== 'owner' && <ChevronDown size={10} />}
                    </button>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-text-muted font-mono">{formatDate(user.lastLoginAt)}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-surface text-text-muted'}`}>
                    {user.isActive ? <UserCheck size={11} /> : <UserX size={11} />}
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {user.role !== 'owner' && (
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => toggleActive(user)}
                        className="text-xs text-text-muted hover:text-error transition-colors">
                        {user.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => deleteUser(user)}
                        className="text-text-muted hover:text-error transition-colors"
                        title="Eliminar usuario (desactiva la cuenta, no borra su historial)">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
