import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { localDB } from '../db/local'
import { isSupabaseConfigured } from '../db/cloud'
import { syncManager } from '../db/sync'
import type { User } from '../types'

const PW_PREFIX = 'bms_pw_'
const USER_KEY = 'bms_user'
const VERSION_KEY = 'bms_ver'
const APP_VERSION = '2'

function hash(pw: string): string {
  let h = 0
  for (let i = 0; i < pw.length; i++) h = ((h << 5) - h) + pw.charCodeAt(i)
  return 'h_' + Math.abs(h).toString(36)
}

function getPwHash(username: string): string | null {
  return localStorage.getItem(PW_PREFIX + username)
}

function setPwHash(username: string, password: string) {
  localStorage.setItem(PW_PREFIX + username, hash(password))
}

interface AuthContextType {
  user: User | null
  isAdmin: boolean
  login: (username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    ;(async () => {
      try {
        if (localStorage.getItem(VERSION_KEY) !== APP_VERSION) {
          const saved = localStorage.getItem(USER_KEY)
          const keys = Object.keys(localStorage)
          for (const k of keys) {
            if (k !== VERSION_KEY && !k.startsWith(PW_PREFIX)) {
              localStorage.removeItem(k)
            }
          }
          if (saved) localStorage.setItem(USER_KEY, saved)
          localStorage.setItem(VERSION_KEY, APP_VERSION)
          await localDB.delete()
          await localDB.open()
        }

        const existing = await localDB.users.toArray()
        if (existing.length === 0) {
          await localDB.users.add({
            id: 'admin-default-id',
            username: 'admin',
            role: 'admin',
            full_name: 'Admin',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        if (!getPwHash('admin')) {
          setPwHash('admin', 'admin')
        }

        let restored = false
        const savedId = localStorage.getItem(USER_KEY)
        if (savedId) {
          const u = await localDB.users.get(savedId)
          if (u && u.is_active) {
            setUser(u)
            restored = true
          }
        }
        if (!restored) {
          const anyUser = await localDB.users.where('is_active').equals(true).limit(1).first()
          if (anyUser) {
            setUser(anyUser)
            localStorage.setItem(USER_KEY, anyUser.id)
          }
        }

        if (isSupabaseConfigured()) {
          syncManager.setupRealtime()
          syncManager.sync()
        }
      } catch (e) {
        console.error('Auth init error:', e)
        const anyUser = await localDB.users.where('is_active').equals(true).limit(1).first().catch(() => null)
        if (anyUser) {
          setUser(anyUser)
          localStorage.setItem(USER_KEY, anyUser.id)
        }
      }
      setLoading(false)
    })()
  }, [])

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const all = await localDB.users.toArray()
      const found = all.find(u => u.username === username && u.is_active)
      if (!found) return 'اسم المستخدم أو كلمة المرور غير صحيحة'

      if (!getPwHash(username)) setPwHash(username, password)
      else if (getPwHash(username) !== hash(password)) return 'اسم المستخدم أو كلمة المرور غير صحيحة'

      setUser(found)
      localStorage.setItem(USER_KEY, found.id)

      if (isSupabaseConfigured()) {
        syncManager.sync()
      }
      return null
    } catch {
      return 'اسم المستخدم أو كلمة المرور غير صحيحة'
    }
  }

  const logout = async () => {
    syncManager.cleanup()
    setUser(null)
    localStorage.removeItem(USER_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: user?.role === 'admin', login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
