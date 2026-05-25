import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { changeLang } from '../i18n'
import { NotifBadge } from '../components/NotifBadge'
import { SyncIndicator } from '../components/SyncIndicator'
import { isSupabaseConfigured, checkConnection } from '../db/cloud'
import { syncManager } from '../db/sync'
import { useSyncStore } from '../stores/syncStore'

type Lang = 'ar' | 'fr' | 'en'

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', adminOnly: false },
  { path: '/cars', labelKey: 'nav.cars', adminOnly: false },
  { path: '/edit-requests', labelKey: 'nav.edit_requests', adminOnly: true },
  { path: '/users', labelKey: 'nav.users', adminOnly: true },
  { path: '/notifications', labelKey: 'nav.notifications', adminOnly: false },
]

export function MainLayout() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [connected, setConnected] = useState<'unknown' | 'connected' | 'disconnected' | 'not_configured'>('unknown')
  const syncStatus = useSyncStore((s) => s.status)
  const setSyncStatus = useSyncStore((s) => s.setStatus)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setConnected('not_configured')
      return
    }
    const check = async () => {
      const ok = await checkConnection()
      setConnected(ok ? 'connected' : 'disconnected')
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleSync = useCallback(async () => {
    if (syncStatus === 'syncing' || !isSupabaseConfigured()) return
    setSyncStatus('syncing')
    await syncManager.sync()
    const ok = await checkConnection()
    setConnected(ok ? 'connected' : 'disconnected')
  }, [syncStatus, setSyncStatus])

  const currentLang = i18n.language as Lang
  const isRtl = currentLang === 'ar'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 bottom-0 z-30 w-64 bg-gray-900 text-white transition-transform duration-300
          lg:static lg:translate-x-0
          ${isRtl ? 'right-0' : 'left-0'}
          ${sidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'}
          lg:block
        `}
      >
        <div className="flex items-center gap-2 px-6 h-16 border-b border-gray-700">
          <span className="text-2xl font-bold tracking-tight">BMS Global</span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null
            const active = isActive(item.path)
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className={`
                  w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isRtl ? 'text-right' : 'text-left'}
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                {t(item.labelKey)}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            {/* Left: hamburger + title */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Toggle sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-800 lg:hidden">BMS Global</h1>
            </div>

            {/* Right: indicator, sync, language, notifications, user */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Connection status + Sync indicator */}
              <SyncIndicator />

              {/* Connection dot (server reachability) */}
              <div className="hidden sm:flex items-center gap-1 text-xs" title={
                connected === 'connected' ? t('common.sync_connected') :
                connected === 'disconnected' ? t('common.sync_disconnected') :
                connected === 'not_configured' ? t('common.sync_disabled') : t('common.sync_checking')
              }>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    connected === 'connected' ? 'bg-green-500' :
                    connected === 'disconnected' ? 'bg-red-500' :
                    connected === 'not_configured' ? 'bg-gray-400' :
                    'bg-yellow-400 animate-pulse'
                  }`}
                />
              </div>

              {/* Sync button */}
              {isSupabaseConfigured() && (
                <button
                  onClick={handleSync}
                  disabled={syncStatus === 'syncing'}
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                  title={t('common.sync')}
                >
                  <svg
                    className={`w-5 h-5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              {/* Language switcher */}
               <select
                value={currentLang}
                onChange={(e) => changeLang(e.target.value as Lang)}
                className="text-xs sm:text-sm border border-gray-300 rounded-lg px-1.5 sm:px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[90px] sm:max-w-none"
              >
                <option value="ar">{t('lang.ar')}</option>
                <option value="fr">{t('lang.fr')}</option>
                <option value="en">{t('lang.en')}</option>
              </select>

              {/* Notification badge */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2 rounded-full text-gray-500 hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute -top-1 -right-1"><NotifBadge /></span>
              </button>

              {/* User info */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="font-medium max-w-[120px] truncate">{user?.full_name || user?.username || ''}</span>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">{t('auth.logout')}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
