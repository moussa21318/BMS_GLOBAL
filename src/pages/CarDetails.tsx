import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import * as cloud from '../db/cloud'
import { STAGE_LABELS, STAGE_ORDER } from '../types'
import type { Car, CarImage, CarFees, CarStageLog, Customer, EditRequest, User, ChangeLog } from '../types'

const STAGE_COLORS: Record<string, string> = {
  deposit: 'bg-yellow-500',
  purchase: 'bg-blue-500',
  parking: 'bg-green-500',
  shipping_prep: 'bg-purple-500',
  shipping: 'bg-indigo-500',
}

export function CarDetails() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user, isAdmin } = useAuth()

  const [car, setCar] = useState<Car | null>(null)
  const [images, setImages] = useState<CarImage[]>([])
  const [fees, setFees] = useState<CarFees | null>(null)
  const [stageLogs, setStageLogs] = useState<CarStageLog[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [editRequests, setEditRequests] = useState<EditRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<number>(0)
  const [stageNote, setStageNote] = useState('')
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [activeTab, setActiveTab] = useState<'info' | 'fees'>('info')
  const [carLogs, setCarLogs] = useState<ChangeLog[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX }
    const onEnd = (e: TouchEvent) => {
      const diff = touchStartX.current - e.changedTouches[0].clientX
      if (Math.abs(diff) > 50) {
        setActiveTab(prev => diff > 0 ? 'fees' : 'info')
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  useEffect(() => {
    if (!id) return
    loadAll()
  }, [id])

  async function loadAll() {
    if (!id) return
    setLoading(true)
    try {
      const [cRes, imgsRes, fRes, logsRes, custRes, editsRes, usersRes, changeLogsRes] = await Promise.all([
        cloud.fetchCar(id),
        cloud.fetchCarImages(id),
        cloud.fetchCarFees(id),
        cloud.fetchCarStageLogs(id),
        cloud.fetchCustomerByCar(id),
        cloud.fetchEditRequestsByCar(id),
        cloud.fetchAllUsers(),
        cloud.fetchChangeLogsByTable('car_fees'),
      ])
      const c = cRes.data
      if (!c) { setLoading(false); return }
      setCar(c)
      setImages(imgsRes.data || [])
      setFees(fRes.data || null)
      setStageLogs(logsRes.data || [])
      setCustomer(custRes.data || null)
      setEditRequests(editsRes.data || [])
      setCarLogs((changeLogsRes.data || []).filter(l => l.table_name === 'car_fees' && l.record_id === fRes.data?.id))
      setUserMap(new Map((usersRes.data || []).map(u => [u.id, u])))
    } catch (e) {
      console.error('loadAll error:', e)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!car) return
    if (!confirm(t('cars.confirm_delete') || `Delete "${car.name}"?`)) return
    await cloud.deleteCar(car.id)
    navigate('/cars')
  }

  async function handleConfirm() {
    if (!car || !user) return
    await cloud.updateCar(car.id, { confirmed: true, confirmed_by: user.id, updated_by: user.id })
    await loadAll()
  }

  async function handleStageMove(stage: string) {
    if (!car || !user) return
    const log: CarStageLog = {
      id: crypto.randomUUID(),
      car_id: car.id,
      stage: stage as Car['current_stage'],
      evidence_url: null,
      notes: stageNote,
      moved_by: user.id,
      created_at: new Date().toISOString(),
    }
    await cloud.insertCarStageLog(log)
    await cloud.updateCar(car.id, { current_stage: stage as Car['current_stage'], updated_by: user.id })
    setStageNote('')
    await loadAll()
  }

  async function handleEvidenceUpload(stageId: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || !car) return
      const path = URL.createObjectURL(file)
      const logsRes = await cloud.fetchCarStageLogs(car.id)
      const logs = logsRes.data || []
      const targetLog = logs.find(l => l.id === stageId)
      if (targetLog) {
        await cloud.updateCarStageLog(stageId, { evidence_url: path })
        await loadAll()
      }
    }
    input.click()
  }

  async function handleRequestEdit() {
    if (!car || !user) return
    navigate(`/cars/${car.id}/edit`)
  }

  async function handleFeeUpdate(key: string, value: number) {
    if (!car || !fees || !user) return
    const oldVal = (fees as any)[key]
    const label = t(`cars.${key}`)
    if (!confirm(t('fees.confirm_edit', { label, oldVal: oldVal.toLocaleString('de-DE'), newVal: value.toLocaleString('de-DE') }))) {
      await loadAll()
      return
    }
    const updated: CarFees = { ...fees, [key]: value, updated_by: user.id }
    if (key === 'deposit') updated.second_payment = car.initial_price - value
    if (key === 'second_payment') updated.deposit = car.initial_price - value
    await cloud.upsertCarFees(updated)
    await loadAll()
  }

  const additionalFees = fees
    ? fees.transport_fee_1 + fees.transport_fee_2 + fees.other_fees + fees.file_fees + fees.shipping_fees
    : 0
  const totalPrice = car ? (car.initial_price + additionalFees) : 0
  const canEdit = isAdmin || !car?.confirmed
  const canEditFees = canEdit
  const paymentDiff = fees ? (car!.initial_price - fees.deposit - fees.second_payment) : 0
  const getUserName = (id: string) => userMap.get(id)?.full_name || userMap.get(id)?.username || id
  const canConfirm = car && !car.confirmed && user && car.created_by === user.id

  if (loading) {
    return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
  }

  if (!car) {
    return <div className="text-center py-12 text-red-500">{t('cars.not_found')}</div>
  }

  const currentStageIndex = STAGE_ORDER.indexOf(car.current_stage)
  const canMoveToStage = (idx: number) => isAdmin || idx === currentStageIndex + 1

  return (
    <div ref={contentRef} className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">{car.name}</h1>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <button
              onClick={() => navigate(`/cars/${car.id}/edit`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {t('cars.edit')}
            </button>
          )}
          {canConfirm && (
            <button
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {t('cars.confirm')}
            </button>
          )}
          {car.confirmed && !isAdmin && (
            <button
              onClick={handleRequestEdit}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {t('cars.request_edit')}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {t('cars.delete')}
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('tabs.info')}
        </button>
        <button
          onClick={() => setActiveTab('fees')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'fees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('tabs.fees')}
        </button>
      </div>

      {activeTab === 'info' && (
      <>
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded-xl overflow-hidden h-64 sm:h-80">
            <img
              src={images[selectedImage].storage_path}
              alt={`${car.name} ${selectedImage + 1}`}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.map((img, idx) => (
              <button
                key={img.id}
                onClick={() => setSelectedImage(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  idx === selectedImage ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img src={img.storage_path} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">{t('cars.car_info')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <InfoRow label={t('cars.model_year')} value={String(car.model_year)} />
              <InfoRow label={t('cars.serial_number')} value={car.serial_number || '—'} />
              <InfoRow label={t('cars.license_plate')} value={car.license_plate || '—'} />
              <InfoRow label={t('cars.seller_number')} value={car.seller_number} />
              <InfoRow label={t('cars.owner_name')} value={car.owner_name} />
              <InfoRow label={t('cars.initial_price')} value={`${car.initial_price.toLocaleString('de-DE')} KRW`} />
              <InfoRow label={t('cars.stage')} value={t(STAGE_LABELS[car.current_stage])} />
              <InfoRow label={t('cars.status')} value={car.confirmed ? t('cars.confirmed') : t('cars.unconfirmed')} />
            </div>
            {car.notes && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('cars.notes')}</label>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{car.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">{t('cars.stage_progression')}</h2>
            <div className="flex items-center gap-0">
              {STAGE_ORDER.map((stage, idx) => {
                const isActive = idx <= currentStageIndex
                const isCurrent = idx === currentStageIndex
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center">
                    <button
                      onClick={() => canMoveToStage(idx) && handleStageMove(stage)}
                      disabled={!canMoveToStage(idx)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white transition-colors ${
                        isCurrent ? 'ring-2 ring-offset-2 ring-blue-400' : ''
                      } ${isActive ? STAGE_COLORS[stage] : 'bg-gray-300'}`}
                      title={t(STAGE_LABELS[stage])}
                    >
                      {idx + 1}
                    </button>
                    <span className="text-xs mt-1 text-center text-gray-600">{t(STAGE_LABELS[stage])}</span>
                    {idx < STAGE_ORDER.length - 1 && (
                      <div className={`h-1 w-full mt-2 -mb-2 ${idx < currentStageIndex ? 'bg-blue-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            {(isAdmin || currentStageIndex < STAGE_ORDER.length - 1) && (
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={stageNote}
                  onChange={e => setStageNote(e.target.value)}
                  placeholder={t('cars.stage_note_placeholder')}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            )}
          </div>

          {stageLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">{t('cars.stage_log')}</h2>
              <div className="space-y-3">
                {stageLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${STAGE_COLORS[log.stage] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{t(STAGE_LABELS[log.stage])}</span>
                        <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                      {log.evidence_url && (
                        <a href={log.evidence_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline inline-flex items-center gap-1 mt-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          {t('cars.view_evidence')}
                        </a>
                      )}
                      {!log.evidence_url && (
                        <button
                          onClick={() => handleEvidenceUpload(log.id)}
                          className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                        >
                          + {t('cars.upload_evidence')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(car.current_stage === 'shipping_prep' || car.current_stage === 'shipping') && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">{t('cars.customer_info')}</h2>
              {customer ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <InfoRow label={t('cars.customer_name')} value={`${customer.first_name} ${customer.last_name}`} />
                  <InfoRow label={t('cars.national_id')} value={customer.national_id} />
                  <InfoRow label={t('cars.phone')} value={customer.phone} />
                  <InfoRow label={t('cars.email')} value={customer.email} />
                  <InfoRow label={t('cars.address')} value={customer.address} />
                  <InfoRow label={t('cars.postal_code')} value={customer.postal_code} />
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t('cars.no_customer')}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2 text-sm text-gray-600">
            <p><span className="text-gray-400">{t('cars.created_by')}:</span> {getUserName(car.created_by)}</p>
            <p><span className="text-gray-400">{t('cars.created_at')}:</span> {new Date(car.created_at).toLocaleString()}</p>
            <p><span className="text-gray-400">{t('cars.updated_by')}:</span> {getUserName(car.updated_by)}</p>
            <p><span className="text-gray-400">{t('cars.updated_at')}:</span> {new Date(car.updated_at).toLocaleString()}</p>
            {car.confirmed_by && (
              <p><span className="text-gray-400">{t('cars.confirmed_by')}:</span> {getUserName(car.confirmed_by)}</p>
            )}
            {car.has_pending_edit && (
              <div className="flex items-center gap-1 text-yellow-700 bg-yellow-50 p-2 rounded-lg mt-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                {t('cars.pending_edit_info')}
              </div>
            )}
          </div>

          {editRequests.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <h2 className="text-lg font-semibold text-gray-800">{t('cars.edit_requests')}</h2>
              {editRequests.map(er => (
                <div key={er.id} className="text-sm p-3 bg-gray-50 rounded-lg space-y-1">
                  <p className="font-medium">{er.reason}</p>
                  <p className={`text-xs ${
                    er.status === 'pending' ? 'text-yellow-600' :
                    er.status === 'approved' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {er.status}
                  </p>
                  {er.review_notes && <p className="text-xs text-gray-500">{er.review_notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {activeTab === 'fees' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">{t('cars.fees')}</h2>
            {fees ? (
              <div className="space-y-2 text-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cars.payment_breakdown')}</p>
                <EditableFeeRow label={t('cars.deposit')} value={fees.deposit} canEdit={canEditFees} onSave={v => handleFeeUpdate('deposit', v)} />
                <EditableFeeRow label={t('cars.second_payment')} value={fees.second_payment} canEdit={canEditFees} onSave={v => handleFeeUpdate('second_payment', v)} />
                <div className={`flex justify-between text-xs font-semibold ${paymentDiff === 0 ? 'text-green-600' : 'text-red-500'}`}>
                  <span>{t('cars.initial_price')}</span>
                  <span>{car.initial_price.toLocaleString('de-DE')} KRW {paymentDiff !== 0 && `(${paymentDiff > 0 ? '-' : '+'}${Math.abs(paymentDiff)})`}</span>
                </div>
                <hr className="border-gray-200" />

                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cars.additional_fees')}</p>
                <EditableFeeRow label={t('cars.transport_fee_1')} value={fees.transport_fee_1} canEdit={canEditFees} onSave={v => handleFeeUpdate('transport_fee_1', v)} />
                <EditableFeeRow label={t('cars.transport_fee_2')} value={fees.transport_fee_2} canEdit={canEditFees} onSave={v => handleFeeUpdate('transport_fee_2', v)} />
                <EditableFeeRow label={t('cars.other_fees')} value={fees.other_fees} canEdit={canEditFees} onSave={v => handleFeeUpdate('other_fees', v)} />
                <EditableFeeRow label={t('cars.file_fees')} value={fees.file_fees} canEdit={canEditFees} onSave={v => handleFeeUpdate('file_fees', v)} />
                <EditableFeeRow label={t('cars.shipping_fees')} value={fees.shipping_fees} canEdit={canEditFees} onSave={v => handleFeeUpdate('shipping_fees', v)} />
                <hr className="border-gray-200" />

                <div className="flex justify-between font-bold text-base">
                  <span>{t('cars.total_price')}</span>
                  <span className="text-blue-600">{totalPrice.toLocaleString('de-DE')} KRW</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">{t('cars.no_fees')}</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-800">{t('cars.fee_history')}</h2>
            {carLogs.length === 0 ? (
              <p className="text-sm text-gray-400">{t('cars.no_fee_changes')}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {carLogs.filter(l => l.table_name === 'car_fees').sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(log => (
                  <div key={log.id} className="text-xs p-3 bg-gray-50 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">{getUserName(log.user_id)}</span>
                      <span className="text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    {log.old_data && log.new_data && (
                      <div className="text-gray-500 space-y-0.5 mt-1">
                        {Object.keys(log.new_data as object).filter(k => k !== 'car_id' && k !== 'id' && k !== 'created_at' && k !== 'updated_by').map(k => {
                          const oldV = (log.old_data as any)?.[k]
                          const newV = (log.new_data as any)[k]
                          if (oldV === newV) return null
                          return (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-gray-400">{t(`cars.${k}`)}:</span>
                              <span className="text-red-500 line-through">{oldV?.toLocaleString('de-DE')} KRW</span>
                              <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              <span className="text-green-600">{newV?.toLocaleString('de-DE')} KRW</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <p className="font-medium text-gray-800">{value}</p>
    </div>
  )
}

function EditableFeeRow({ label, value, canEdit, onSave }: { label: string; value: number; canEdit?: boolean; onSave?: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const handleSave = () => {
    const num = Math.max(0, Number(editValue) || 0)
    onSave?.(num)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditValue(String(value))
    setEditing(false)
  }

  if (editing && canEdit) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-gray-500 text-sm">{label}</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleCancel}
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          className="w-28 text-right px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    )
  }

  return (
    <div
      ref={displayRef}
      className="flex justify-between cursor-default"
      onDoubleClick={() => { if (canEdit) { setEditValue(String(value)); setEditing(true) } }}
    >
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value.toLocaleString('de-DE')} KRW</span>
    </div>
  )
}
