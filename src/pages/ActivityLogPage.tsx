import { useState, useEffect, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { localDB } from '../db/local'
import type { ChangeLog, User } from '../types'

const FEE_KEYS = ['deposit', 'second_payment', 'transport_fee_1', 'transport_fee_2', 'other_fees', 'file_fees', 'shipping_fees']

export function ActivityLogPage() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<ChangeLog[]>([])
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [searchCarId, setSearchCarId] = useState('')

  useEffect(() => {
    ;(async () => {
      const [allLogs, allUsers] = await Promise.all([
        localDB.changeLog.orderBy('timestamp').reverse().toArray(),
        localDB.users.toArray(),
      ])
      setLogs(allLogs)
      setUserMap(new Map(allUsers.map(u => [u.id, u])))
      setLoading(false)
    })()
  }, [])

  const filteredLogs = logs.filter(log => !searchCarId || (log.car_id && log.car_id.toLowerCase().includes(searchCarId.toLowerCase())))

  if (loading) {
    return <div className="text-center py-12 text-gray-500">{t('common.loading')}</div>
  }

  if (filteredLogs.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('activity_log.title')}</h1>
        <div className="mb-4">
          <input
            type="text"
            value={searchCarId}
            onChange={e => setSearchCarId(e.target.value)}
            placeholder={t('activity_log.search_car_id')}
            className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📋</p>
          <p>{t('activity_log.no_data')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('activity_log.title')}</h1>

      <div className="mb-4">
        <input
          type="text"
          value={searchCarId}
          onChange={e => setSearchCarId(e.target.value)}
          placeholder={t('activity_log.search_car_id')}
          className="w-full sm:w-72 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('activity_log.time')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('activity_log.user')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('activity_log.table')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('common.actions')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('activity_log.car_id')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('common.details', 'التفاصيل')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map(log => {
                const user = log.user_id ? userMap.get(log.user_id) : undefined
                const isExpanded = expanded === log.id

                let feeChanges: { label: string; oldV: string; newV: string }[] | null = null
                if (log.table_name === 'car_fees' && log.operation === 'update' && log.old_data && log.new_data) {
                  feeChanges = FEE_KEYS
                    .filter(k => JSON.stringify((log.old_data as any)[k]) !== JSON.stringify((log.new_data as any)[k]))
                    .map(k => ({
                      label: t(`cars.${k}`),
                      oldV: ((log.old_data as any)[k] || 0).toLocaleString('de-DE'),
                      newV: ((log.new_data as any)[k] || 0).toLocaleString('de-DE'),
                    }))
                }

                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {user ? (user.full_name || user.username) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                          {t(`activity_log.table_${log.table_name}`, log.table_name)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.operation === 'insert' ? 'bg-green-100 text-green-700' :
                          log.operation === 'update' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {t(`activity_log.${log.operation}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 font-mono">{log.car_id ? log.car_id.substring(0, 8) + '…' : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {feeChanges && feeChanges.length > 0 && (
                          <button
                            onClick={() => setExpanded(isExpanded ? null : log.id)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                          >
                            {isExpanded ? t('common.hide') : t('common.show')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && feeChanges && feeChanges.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="space-y-1 text-xs text-gray-600">
                            {feeChanges.map((c, i) => (
                              <div key={i} className="flex gap-2">
                                <span className="font-medium min-w-[100px]">{c.label}:</span>
                                <span className="text-red-500 line-through">{c.oldV} KRW</span>
                                <span>→</span>
                                <span className="text-green-600 font-medium">{c.newV} KRW</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
