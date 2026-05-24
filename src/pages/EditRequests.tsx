import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { localDB } from '../db/local'
import { useAuth } from '../auth/AuthContext'
import type { EditRequest, Car } from '../types'

type FilterStatus = 'pending' | 'approved' | 'rejected'

export function EditRequests() {
  const { t } = useTranslation()
  const { user, isAdmin } = useAuth()

  const [requests, setRequests] = useState<EditRequest[]>([])
  const [cars, setCars] = useState<Record<string, Car>>({})
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      const all = await localDB.editRequests.toArray()
      const carIds = [...new Set(all.map(r => r.car_id))]
      const carMap: Record<string, Car> = {}
      for (const id of carIds) {
        const c = await localDB.cars.get(id)
        if (c) carMap[id] = c
      }
      setCars(carMap)
      setRequests(all)
    }
    load()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">{t('common.no_data')}</p>
      </div>
    )
  }

  const filtered = requests
    .filter(r => r.status === filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const handleReview = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessing(prev => ({ ...prev, [id]: true }))
    try {
      await localDB.updateEditRequest(id, {
        status: decision,
        reviewed_by: user!.id!,
        review_notes: reviewNotes[id] ?? '',
      })

      if (decision === 'approved') {
        const req = requests.find(r => r.id === id)
        if (req) {
          await localDB.updateCar(req.car_id, req.new_data as any)
        }
      }

      setRequests(prev =>
        prev.map(r => r.id === id ? { ...r, status: decision, reviewed_by: user!.id! } : r)
      )
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }))
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">{t('edit_request.title')}</h1>

      <div className="mb-6 flex gap-2">
        {(['pending', 'approved', 'rejected'] as FilterStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
              filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {t(`edit_request.${s}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-gray-400">{t('edit_request.no_requests')}</p>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => {
            const car = cars[req.car_id]
            return (
              <div key={req.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {car ? car.name : t('common.no_data')}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {t('edit_request.status')}: <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[req.status]}`}>{t(`edit_request.${req.status}`)}</span>
                    </p>
                  </div>
                </div>

                {req.reason && (
                  <p className="mb-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <span className="font-medium text-gray-800">{t('edit_request.reason')}:</span> {req.reason}
                  </p>
                )}

                <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 font-medium text-gray-600">{t('edit_request.old_value')}</th>
                        <th className="px-4 py-2 font-medium text-gray-600">{t('edit_request.new_value')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(req.new_data || {}).map(([key, value]) => {
                        const oldVal = req.old_data?.[key]
                        return (
                          <tr key={key}>
                            <td className="px-4 py-2 text-gray-500">{oldVal != null ? String(oldVal) : '—'}</td>
                            <td className="px-4 py-2 font-medium text-blue-700">{value != null ? String(value) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {req.status === 'pending' && (
                  <div className="space-y-3">
                    <textarea
                      placeholder={t('edit_request.review_notes')}
                      value={reviewNotes[req.id!] ?? ''}
                      onChange={e => setReviewNotes(prev => ({ ...prev, [req.id!]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(req.id!, 'approved')} disabled={processing[req.id!]}
                        className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                        {t('edit_request.approve')}
                      </button>
                      <button onClick={() => handleReview(req.id!, 'rejected')} disabled={processing[req.id!]}
                        className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                        {t('edit_request.reject')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
