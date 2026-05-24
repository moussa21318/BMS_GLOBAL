import { useSyncStore, type SyncStatus } from '../stores/syncStore'
import { useTranslation } from 'react-i18next'

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  return `منذ ${Math.floor(hrs / 24)} يوم`
}

export function SyncIndicator() {
  const { t } = useTranslation()
  const { status, lastSyncAt, error } = useSyncStore()

  const config: Record<SyncStatus, { dot: string; labelKey: string; title: string }> = {
    idle: {
      dot: 'bg-gray-400',
      labelKey: 'common.sync_idle',
      title: '',
    },
    syncing: {
      dot: 'bg-blue-500 animate-pulse shadow-[0_0_6px_#3b82f6]',
      labelKey: 'common.sync_syncing',
      title: t('common.sync_syncing'),
    },
    success: {
      dot: 'bg-green-500 shadow-[0_0_6px_#22c55e]',
      labelKey: 'common.sync_success',
      title: lastSyncAt ? `آخر مزامنة: ${formatTimeAgo(lastSyncAt)}` : '',
    },
    error: {
      dot: 'bg-red-500 shadow-[0_0_6px_#ef4444]',
      labelKey: 'common.sync_error',
      title: error || t('common.sync_error'),
    },
  }

  const c = config[status]

  return (
    <div className="flex items-center gap-1.5 text-xs" title={c.title}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} />
      <span className={`hidden sm:inline ${
        status === 'success' ? 'text-green-700' :
        status === 'error' ? 'text-red-600' :
        status === 'syncing' ? 'text-blue-600' :
        'text-gray-400'
      }`}>
        {t(c.labelKey)}
        {lastSyncAt && status === 'success' && (
          <span className="text-gray-400 mr-1">({formatTimeAgo(lastSyncAt)})</span>
        )}
      </span>
    </div>
  )
}
