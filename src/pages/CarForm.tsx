import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import * as cloud from '../db/cloud'
import { MODEL_YEARS } from '../types'
import type { Car, CarFees, CarImage } from '../types'

export function CarForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isEditing = !!id

  const [form, setForm] = useState({
    name: '',
    model_year: new Date().getFullYear(),
    serial_number: '',
    license_plate: '',
    seller_number: '',
    owner_name: '',
    initial_price: 0,
    notes: '',
  })
  const [fees, setFees] = useState({
    deposit: 0,
    second_payment: 0,
    transport_fee_1: 0,
    transport_fee_2: 0,
    other_fees: 0,
    file_fees: 0,
    shipping_fees: 0,
  })
  const [existingImages, setExistingImages] = useState<CarImage[]>([])
  const [newImageFiles, setNewImageFiles] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(isEditing)
  const [error, setError] = useState('')
  const [feesError, setFeesError] = useState('')

  useEffect(() => {
    if (id) loadExisting(id)
  }, [id])

  async function loadExisting(carId: string) {
    const [carRes, feesRes, imagesRes] = await Promise.all([
      cloud.fetchCar(carId),
      cloud.fetchCarFees(carId),
      cloud.fetchCarImages(carId),
    ])
    const carData = carRes.data
    if (!carData) {
      setError(t('cars.not_found'))
      setFetching(false)
      return
    }
    setForm({
      name: carData.name,
      model_year: carData.model_year,
      serial_number: carData.serial_number || '',
      license_plate: carData.license_plate || '',
      seller_number: carData.seller_number,
      owner_name: carData.owner_name,
      initial_price: carData.initial_price,
      notes: carData.notes,
    })
    if (feesRes.data) {
      setFees({
        deposit: feesRes.data.deposit,
        second_payment: feesRes.data.second_payment,
        transport_fee_1: feesRes.data.transport_fee_1,
        transport_fee_2: feesRes.data.transport_fee_2,
        other_fees: feesRes.data.other_fees,
        file_fees: feesRes.data.file_fees,
        shipping_fees: feesRes.data.shipping_fees,
      })
    }
    setExistingImages(imagesRes.data || [])
    setFetching(false)
  }

  function updateForm(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  function updateFees(key: string, value: string) {
    setFees(prev => ({ ...prev, [key]: Math.max(0, Number(value) || 0) }))
    setFeesError('')
  }

  function handleImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setNewImageFiles(prev => [...prev, ...files])
    const previews = files.map(f => URL.createObjectURL(f))
    setNewImagePreviews(prev => [...prev, ...previews])
    e.target.value = ''
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(newImagePreviews[idx])
    setNewImageFiles(prev => prev.filter((_, i) => i !== idx))
    setNewImagePreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function removeExistingImage(imgId: string) {
    await cloud.deleteCarImage(imgId)
    setExistingImages(prev => prev.filter(img => img.id !== imgId))
  }

  function validate(): string | null {
    if (!form.name.trim()) return t('cars.validation.name_required')
    if (!form.serial_number.trim() && !form.license_plate.trim()) {
      return t('cars.validation.serial_or_plate')
    }
    if (!form.seller_number.trim()) return t('cars.validation.seller_required')
    if (!form.owner_name.trim()) return t('cars.validation.owner_required')
    if (form.initial_price <= 0) return t('cars.validation.price_positive')
    if (Number.isNaN(form.model_year) || !MODEL_YEARS.includes(form.model_year)) {
      return t('cars.validation.invalid_year')
    }
    if (fees.deposit + fees.second_payment > form.initial_price) {
      return t('cars.validation.deposit_second_exceeds')
    }
    return null
  }

  const additionalFees = fees.transport_fee_1 + fees.transport_fee_2 +
    fees.other_fees + fees.file_fees + fees.shipping_fees
  const totalPrice = form.initial_price + additionalFees

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const carId = id || crypto.randomUUID()
      let createdBy = user.id
      let createdAt = now
      if (isEditing) {
        const old = await cloud.fetchCar(carId)
        if (old.data) {
          createdBy = old.data.created_by
          createdAt = old.data.created_at
        }
      }

      const carData: Car = {
        id: carId,
        name: form.name.trim(),
        model_year: form.model_year,
        serial_number: form.serial_number.trim() || null,
        license_plate: form.license_plate.trim() || null,
        seller_number: form.seller_number.trim(),
        owner_name: form.owner_name.trim(),
        initial_price: form.initial_price,
        notes: form.notes.trim(),
        current_stage: 'deposit',
        confirmed: false,
        has_pending_edit: false,
        created_by: createdBy,
        updated_by: user.id,
        confirmed_by: null,
        created_at: createdAt,
        updated_at: now,
      }

      if (isEditing) {
        await cloud.updateCar(carId, carData)
      } else {
        await cloud.insertCar(carData)
      }

      const feeData: CarFees = {
        id: crypto.randomUUID(),
        car_id: carId,
        ...fees,
        created_by: user.id,
        updated_by: user.id,
        created_at: now,
        updated_at: now,
      }
      await cloud.upsertCarFees(feeData)

      for (let i = 0; i < newImageFiles.length; i++) {
        const file = newImageFiles[i]
        const path = URL.createObjectURL(file)
        const img: CarImage = {
          id: crypto.randomUUID(),
          car_id: carId,
          storage_path: path,
          order_index: existingImages.length + i,
          created_by: user.id,
          created_at: now,
        }
        await cloud.insertCarImage(img)
      }

      navigate(`/cars/${carId}`)
    } catch (err) {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isEditing ? t('cars.edit_car') : t('cars.add_car')}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('cars.car_info')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('cars.name')} required>
              <input type="text" value={form.name} onChange={e => updateForm('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </Field>
            <Field label={t('cars.model_year')} required>
              <select value={form.model_year} onChange={e => updateForm('model_year', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white">
                {MODEL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label={t('cars.serial_number')}>
              <input type="text" value={form.serial_number} onChange={e => updateForm('serial_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </Field>
            <Field label={t('cars.license_plate')}>
              <input type="text" value={form.license_plate} onChange={e => updateForm('license_plate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </Field>
            <Field label={t('cars.seller_number')} required>
              <input type="text" value={form.seller_number} onChange={e => updateForm('seller_number', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </Field>
            <Field label={t('cars.owner_name')} required>
              <input type="text" value={form.owner_name} onChange={e => updateForm('owner_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </Field>
            <Field label={t('cars.initial_price')} required>
              <input type="number" min="0" value={form.initial_price || ''} onChange={e => updateForm('initial_price', Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </Field>
          </div>
          <Field label={t('cars.notes')}>
            <textarea value={form.notes} onChange={e => updateForm('notes', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none" />
          </Field>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('cars.fees')}</h2>
          {feesError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-sm">{feesError}</div>}

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cars.payment_breakdown')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeeField label={t('cars.deposit')} value={fees.deposit} onChange={v => updateFees('deposit', v)} />
            <FeeField label={t('cars.second_payment')} value={fees.second_payment} onChange={v => updateFees('second_payment', v)} />
          </div>
          <div className={`flex justify-between text-sm font-semibold ${fees.deposit + fees.second_payment <= form.initial_price ? 'text-green-600' : 'text-red-500'}`}>
            <span>{t('cars.initial_price')}</span>
            <span>{form.initial_price.toLocaleString('de-DE')} KRW</span>
          </div>

          <hr className="border-gray-200" />

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cars.additional_fees')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeeField label={t('cars.transport_fee_1')} value={fees.transport_fee_1} onChange={v => updateFees('transport_fee_1', v)} />
            <FeeField label={t('cars.transport_fee_2')} value={fees.transport_fee_2} onChange={v => updateFees('transport_fee_2', v)} />
            <FeeField label={t('cars.other_fees')} value={fees.other_fees} onChange={v => updateFees('other_fees', v)} />
            <FeeField label={t('cars.file_fees')} value={fees.file_fees} onChange={v => updateFees('file_fees', v)} />
            <FeeField label={t('cars.shipping_fees')} value={fees.shipping_fees} onChange={v => updateFees('shipping_fees', v)} />
          </div>

          <hr className="border-gray-200" />
          <div className="flex justify-between text-base">
            <span className="font-bold text-lg">{t('cars.total_price')}</span>
            <span className="font-bold text-lg text-blue-600">{totalPrice.toLocaleString('de-DE')} KRW</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">{t('cars.images')}</h2>

          {existingImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">{t('cars.existing_images')}</p>
              <div className="flex flex-wrap gap-2">
                {existingImages.map(img => (
                  <div key={img.id} className="relative group">
                    <img src={img.storage_path} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                    <button type="button" onClick={() => removeExistingImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer text-sm text-gray-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              {t('cars.add_images')}
              <input type="file" accept="image/*" multiple onChange={handleImageAdd} className="hidden" />
            </label>
          </div>

          {newImagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newImagePreviews.map((preview, idx) => (
                <div key={idx} className="relative group">
                  <img src={preview} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                  <button type="button" onClick={() => removeNewImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
            {loading ? t('common.saving') : (isEditing ? t('cars.save_changes') : t('cars.create_car'))}
          </button>
          <button type="button" onClick={() => navigate(-1)}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function FeeField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type="number" min="0" value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
    </div>
  )
}
