import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../db/cloud'
import type { Notification } from '../types'

export function NotificationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      const { data: all } = await fetchNotifications(user.id)
      if (!cancelled && all) setNotifications(all)
    }
    load()
    const interval = setInterval(load, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAsRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllAsRead = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleClick = (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id)
    if (notif.car_id) navigate(`/cars/${notif.car_id}`)
  }

  if (!notifications.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <span className="text-5xl mb-4">🔔</span>
        <p>{t('notification.no_notifications')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('notification.title')}</h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            {t('notification.mark_all_read')}
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {notifications.map(notif => (
          <li key={notif.id} onClick={() => handleClick(notif)}
            className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
              notif.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500'
            }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${notif.is_read ? 'text-gray-900' : 'text-gray-900 font-semibold'}`}>
                {notif.title}
              </p>
              {notif.body && (
                <p className={`text-sm mt-0.5 ${notif.is_read ? 'text-gray-500' : 'text-gray-600'}`}>{notif.body}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
            </div>
            {!notif.is_read && <span className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />}
          </li>
        ))}
      </ul>
    </div>
  )
}
