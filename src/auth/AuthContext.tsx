import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { localDB } from '../db/local'
import { isSupabaseConfigured, supabase } from '../db/cloud'
import { syncManager } from '../db/sync'
import type { User } from '../types'

const PW_PREFIX = 'bms_pw_'
const USER_KEY = 'bms_user'
const VERSION_KEY = 'bms_ver'
const APP_VERSION = '3'

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
  const { t } = useTranslation()
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

        let existing = await localDB.users.toArray()
        if (existing.length === 0) {
          const pwHash = hash('admin')
          await localDB.addUser({
            id: crypto.randomUUID(),
            username: 'admin',
            role: 'admin',
            full_name: 'Admin',
            is_active: true,
            password_hash: pwHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          setPwHash('admin', 'admin')
        } else {
          // Migrate existing users: add password_hash from localStorage if missing
          for (const u of existing) {
            if (!u.password_hash) {
              const pwHash = getPwHash(u.username)
              if (pwHash) {
                await localDB.users.put({ ...u, password_hash: pwHash } as any)
              }
            }
          }
          // Reload after migration
          existing = await localDB.users.toArray()
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
        console.error('Auth init error:', e instanceof Error ? e.message : JSON.stringify(e))
        try {
          await localDB.repairDatabase()
          const existing = await localDB.users.toArray()
          if (existing.length === 0) {
            const pwHash = hash('admin')
            await localDB.addUser({
              id: crypto.randomUUID(),
              username: 'admin',
              role: 'admin',
              full_name: 'Admin',
              is_active: true,
              password_hash: pwHash,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            setPwHash('admin', 'admin')
          }
          const anyUser = await localDB.users.where('is_active').equals(true).limit(1).first()
          if (anyUser) {
            setUser(anyUser)
            localStorage.setItem(USER_KEY, anyUser.id)
          }
        } catch (e2) {
          console.error('Auth init recovery failed:', e2 instanceof Error ? e2.message : JSON.stringify(e2))
        }
      }
      syncManager.setReady(true)
      setLoading(false)
    })()
  }, [])

  const checkPassword = async (username: string, passwordHash: string): Promise<User | null> => {
    // Level 1: localStorage fast check
    const storedHash = getPwHash(username)
    if (storedHash) {
      if (storedHash !== passwordHash) return null
      // Verify user exists in IndexedDB
      const u = await localDB.users.where('username').equals(username).first()
      if (u && u.is_active) return u
    }

    // Level 2: IndexedDB password_hash
    const users = await localDB.users.toArray()
    const u = users.find(u => u.username === username && u.is_active && u.password_hash === passwordHash)
    if (u) {
      setPwHash(username, passwordHash)
      return u
    }

    // Level 3: Supabase pull (if configured)
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle()
      if (!error && data && data.password_hash === passwordHash && data.is_active) {
        // Store in IndexedDB
        const syncedUser: User = {
          id: data.id,
          username: data.username,
          role: data.role,
          full_name: data.full_name || '',
          is_active: data.is_active,
          password_hash: data.password_hash || '',
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || new Date().toISOString(),
        }
        const exists = await localDB.users.get(syncedUser.id)
        if (!exists) {
          await localDB.addUser(syncedUser)
        } else {
          await localDB.users.put(syncedUser as any)
        }
        setPwHash(username, passwordHash)
        return syncedUser
      }
    }

    return null
  }

  const login = async (username: string, password: string): Promise<string | null> => {
    const passwordHash = hash(password)
    try {
      const u = await checkPassword(username, passwordHash)
      if (!u) return t('auth.wrong_credentials')

      setUser(u)
      localStorage.setItem(USER_KEY, u.id)

      if (isSupabaseConfigured()) {
        syncManager.sync()
      }
      return null
    } catch (err) {
      console.error('login error:', err instanceof Error ? err.message : JSON.stringify(err))
      try {
        await localDB.repairDatabase()
        const all = await localDB.users.toArray()
        if (all.length === 0) {
          const pwHash = hash('admin')
          await localDB.addUser({
            id: crypto.randomUUID(),
            username: 'admin',
            role: 'admin',
            full_name: 'Admin',
            is_active: true,
            password_hash: pwHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          setPwHash('admin', 'admin')
        }
        const u = await checkPassword(username, passwordHash)
        if (!u) return t('auth.wrong_credentials')
        setUser(u)
        localStorage.setItem(USER_KEY, u.id)
        if (isSupabaseConfigured()) syncManager.sync()
        return null
      } catch {
        return t('auth.wrong_credentials')
      }
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