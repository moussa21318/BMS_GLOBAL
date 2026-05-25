import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { STAGE_LABELS, STAGE_ORDER } from '../types'
import { fetchAllCars, fetchAllUsers, fetchPendingEditRequests, fetchChangeLogs, supabase } from '../db/cloud'
import type { Car, ChangeLog, EditRequest, Notification, User } from '../types'

const FEE_KEYS = ['deposit', 'second_payment', 'transport_fee_1', 'transport_fee_2', 'other_fees', 'file_fees', 'shipping_fees']

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [cars, setCars] = useState<Car[]>([])
  const [pendingRequests, setPendingRequests] = useState<EditRequest[]>([])
  const [unreadNotifs, setUnreadNotifs] = useState<Notification[]>([])
  const [recentLogs, setRecentLogs] = useState<ChangeLog[]>([])
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [{ data: allCars }, { data: allUsers }, { data: pendingReqs }, unreadRes, { data: logs }] = await Promise.all([
        fetchAllCars(),
        fetchAllUsers(),
        fetchPendingEditRequests(),
        supabase ? supabase.from('notifications').select('*').eq('is_read', false) : Promise.resolve({ data: null, error: null }),
        fetchChangeLogs(),
      ])
      const unread = unreadRes?.data
      if (allCars) setCars(allCars)
      if (allUsers) setUserMap(new Map(allUsers.map(u => [u.id, u])))
      if (pendingReqs) setPendingRequests(pendingReqs)
      if (unread) setUnreadNotifs(unread)
      if (logs) setRecentLogs(logs.slice(0, 5))
    } catch (e) {
      console.error('Dashboard load error:', e)
    }
  }

  const stageCounts = STAGE_ORDER.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    count: cars.filter(c => c.current_stage === stage).length,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-blue-600">{cars.length}</div>
          <div className="text-sm text-gray-500 mt-1">{t('dashboard.total_cars')}</div>
        </div>
        {isAdmin && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="text-3xl font-bold text-amber-600">{pendingRequests.length}</div>
            <div className="text-sm text-gray-500 mt-1">{t('dashboard.pending_requests')}</div>
          </div>
        )}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-green-600">{unreadNotifs.length}</div>
          <div className="text-sm text-gray-500 mt-1">{t('dashboard.unread_notifications')}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-purple-600">{cars.filter(c => c.confirmed).length}/{cars.length}</div>
          <div className="text-sm text-gray-500 mt-1">{t('cars.confirmed')}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('dashboard.cars_by_stage')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {stageCounts.map(({ stage, label, count }) => (
            <button key={stage} onClick={() => navigate(`/cars?stage=${stage}`)}
              className="p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-center">
              <div className="text-xl font-bold text-gray-800">{count}</div>
              <div className="text-xs text-gray-500 mt-1">{t(label)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{t('dashboard.recent_activity')}</h2>
            <button onClick={() => navigate('/activity-log')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {t('activity_log.view_all')}
            </button>
          </div>
          <div className="space-y-2">
              {recentLogs.map(log => {
              const user = log.user_id ? userMap.get(log.user_id) : undefined
              let feeDiff: string | null = null
              if (log.table_name === 'car_fees' && log.operation === 'update' && log.old_data && log.new_data) {
                const changes = FEE_KEYS.filter(k => JSON.stringify((log.old_data as any)[k]) !== JSON.stringify((log.new_data as any)[k]))
                feeDiff = changes.map(k => {
                  const oldV = ((log.old_data as any)[k] || 0).toLocaleString('de-DE')
                  const newV = ((log.new_data as any)[k] || 0).toLocaleString('de-DE')
                  return `${t(`cars.${k}`)}: ${oldV} → ${newV} KRW`
                }).join(', ')
              }
              return (
                <div key={log.id} className="text-sm text-gray-600 border-b border-gray-50 pb-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-gray-400 text-xs">{new Date(log.timestamp).toLocaleString()}</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-medium">{t(`activity_log.table_${log.table_name}`, log.table_name)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      log.operation === 'insert' ? 'bg-green-100 text-green-700' :
                      log.operation === 'update' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>{t(`activity_log.${log.operation}`)}</span>
                    {user && <span className="text-gray-400 text-xs">({user.full_name || user.username})</span>}
                  </div>
                  {feeDiff && <div className="text-xs text-gray-500 mt-0.5">{feeDiff}</div>}
                </div>
              )
            })}
            {recentLogs.length === 0 && <div className="text-sm text-gray-400">{t('common.no_data')}</div>}
          </div>
        </div>
        <div className="space-y-4">
          <button onClick={() => navigate('/cars/new')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition">
            {t('cars.add_car')}
          </button>
          <button onClick={() => navigate('/cars')}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl border border-gray-200 transition">
            {t('nav.cars')}
          </button>
        </div>
      </div>
    </div>
  )
}
