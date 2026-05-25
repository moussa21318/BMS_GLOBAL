import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchCustomerByCar, insertCustomer, updateCustomer as cloudUpdateCustomer } from '../db/cloud'

export function CustomerForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: carId } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    national_id: '',
    address: '',
    postal_code: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    if (!carId || !user) return
    const load = async () => {
      const { data: existing } = await fetchCustomerByCar(carId)
      if (existing) {
        setCustomerId(existing.id!)
        setForm({
          first_name: existing.first_name,
          last_name: existing.last_name,
          national_id: existing.national_id,
          address: existing.address,
          postal_code: existing.postal_code,
          phone: existing.phone,
          email: existing.email,
        })
      }
    }
    load()
  }, [carId, user])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!carId || !user) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const record = {
        car_id: carId,
        created_by: user.id!,
        updated_by: user.id!,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        national_id: form.national_id.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        id_image_path: null,
        car_document_path: null,
        created_at: now,
        updated_at: now,
      }

      if (customerId) {
        await cloudUpdateCustomer(customerId, record)
      } else {
        const newId = crypto.randomUUID()
        await insertCustomer({ id: newId, ...record })
      }

      navigate(`/cars/${carId}`)
    } finally {
      setSaving(false)
    }
  }

  const fields = [
    { name: 'first_name', label: t('customer.first_name'), type: 'text' },
    { name: 'last_name', label: t('customer.last_name'), type: 'text' },
    { name: 'national_id', label: t('customer.national_id'), type: 'text' },
    { name: 'phone', label: t('customer.phone'), type: 'tel' },
    { name: 'email', label: t('customer.email'), type: 'email' },
    { name: 'address', label: t('customer.address'), type: 'text' },
    { name: 'postal_code', label: t('customer.postal_code'), type: 'text' },
  ]

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        {customerId ? t('customer.edit_customer') : t('customer.add_customer')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {fields.map(f => (
          <div key={f.name}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
            <input
              type={f.type}
              name={f.name}
              value={(form as any)[f.name]}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}

        <div className="flex items-center gap-3 pt-4">
          <button type="submit" disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? t('common.loading') : t('common.save')}
          </button>
          <button type="button" onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
