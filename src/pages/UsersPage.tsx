import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { hash } from '../utils/hash'
import { fetchAllUsers, insertUser, updateUser as cloudUpdateUser } from '../db/cloud'
import type { User } from '../types'

interface UserForm {
  username: string
  password: string
  full_name: string
  role: 'admin' | 'employee'
  is_active: boolean
}

const emptyForm: UserForm = {
  username: '',
  password: '',
  full_name: '',
  role: 'employee',
  is_active: true,
}

export function UsersPage() {
  const { t } = useTranslation()
  const { isAdmin, user: currentUser } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    load()
  }, [isAdmin])

  async function load() {
    const { data } = await fetchAllUsers()
    if (data) setUsers(data)
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">{t('common.no_data')}</p>
      </div>
    )
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (u: User) => {
    setEditingId(u.id!)
    setForm({
      username: u.username,
      password: '',
      full_name: u.full_name,
      role: u.role,
      is_active: u.is_active,
    })
    setShowModal(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const now = new Date().toISOString()

      if (editingId) {
        const payload: any = {
          full_name: form.full_name.trim(),
          role: form.role,
          is_active: form.is_active,
          updated_at: now,
        }
        if (form.password.trim()) {
          payload.password_hash = hash(form.password.trim())
        }
        const { error: updateErr } = await cloudUpdateUser(editingId, payload)
        if (updateErr) throw new Error(JSON.stringify(updateErr))
      } else {
        const id = crypto.randomUUID()
        const record: User = {
          id,
          username: form.username.trim(),
          role: form.role,
          full_name: form.full_name.trim(),
          is_active: form.is_active,
          password_hash: hash(form.password.trim()),
          created_at: now,
          updated_at: now,
        }
        const { error: insertErr } = await insertUser(record)
        if (insertErr) throw new Error(JSON.stringify(insertErr))
      }
      await load()
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: User) => {
    if (!currentUser) return
    if (u.id === currentUser.id) {
      alert(t('user.cannot_deactivate_self'))
      return
    }
    if (u.role === 'admin') {
      const { data: admins } = await fetchAllUsers()
      const activeAdmins = (admins || []).filter(a => a.role === 'admin' && a.is_active && a.id !== u.id)
      if (activeAdmins.length === 0) {
        alert(t('user.cannot_deactivate_last_admin'))
        return
      }
    }
    const { error } = await cloudUpdateUser(u.id!, { is_active: !u.is_active, updated_at: new Date().toISOString() })
    if (error) { console.error(error); return }
    await load()
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    employee: 'bg-blue-100 text-blue-800',
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('user.title')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={async () => {
            const { data } = await fetchAllUsers()
            const d = (data || []).map(u => ({ username: u.username, password_hash: u.password_hash }))
            console.table(d)
            alert(JSON.stringify(d, null, 2))
          }}
            className="rounded-lg bg-gray-600 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700">
            تصدير
          </button>
          <button onClick={openAdd}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {t('user.add_user')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-left text-sm min-w-[500px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600">{t('user.username')}</th>
              <th className="px-4 py-3 font-medium text-gray-600">{t('user.full_name')}</th>
              <th className="px-4 py-3 font-medium text-gray-600">{t('user.role')}</th>
              <th className="px-4 py-3 font-medium text-gray-600">{t('common.status')}</th>
              <th className="px-4 py-3 font-medium text-gray-600">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-4 py-3 text-gray-700">{u.full_name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>
                    {u.role === 'admin' ? t('user.admin') : t('user.employee')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(u)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {u.is_active ? t('common.yes') : t('common.no')}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(u)}
                    className="rounded px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50">
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              {editingId ? t('user.edit_user') : t('user.add_user')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('user.username')}</label>
                <input type="text" name="username" value={form.username} onChange={handleChange}
                  required disabled={!!editingId}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('user.password')}</label>
                <input type="password" name="password" value={form.password} onChange={handleChange}
                  required={!editingId}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('user.full_name')}</label>
                <input type="text" name="full_name" value={form.full_name} onChange={handleChange} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('user.role')}</label>
                <select name="role" value={form.role} onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="employee">{t('user.employee')}</option>
                  <option value="admin">{t('user.admin')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_active" id="is_active" checked={form.is_active}
                  onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">{t('user.is_active')}</label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
