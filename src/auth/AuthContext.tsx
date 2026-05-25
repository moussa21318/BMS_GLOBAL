import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, isSupabaseConfigured } from '../db/cloud'
import { hash, verify } from '../utils/hash'
import type { User } from '../types'

const USER_KEY = 'bms_user'

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
        if (!isSupabaseConfigured()) {
          setLoading(false)
          return
        }

        const { count } = await supabase!.from('users').select('*', { count: 'exact', head: true })
        if (count === 0) {
          const adminUser: User = {
            id: crypto.randomUUID(),
            username: 'admin',
            role: 'admin',
            full_name: 'Admin',
            is_active: true,
            password_hash: await hash('admin'),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          await supabase!.from('users').insert(adminUser)
        }

        const savedId = localStorage.getItem(USER_KEY)
        if (savedId) {
          const { data, error } = await supabase!.from('users').select('*').eq('id', savedId).maybeSingle()
          if (!error && data && data.is_active) {
            setUser(data as User)
          } else {
            localStorage.removeItem(USER_KEY)
          }
        }
      } catch (e) {
        console.error('Auth init error:', e instanceof Error ? e.message : JSON.stringify(e))
        localStorage.removeItem(USER_KEY)
      }
      setLoading(false)
    })()
  }, [])

  const login = async (username: string, password: string): Promise<string | null> => {
    if (!isSupabaseConfigured() || !supabase) return t('auth.wrong_credentials')

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle()

      if (error || !data || !data.is_active) return t('auth.wrong_credentials')

      const u = data as User
      const ok = await verify(password, u.password_hash)
      if (!ok) return t('auth.wrong_credentials')

      setUser(u)
      localStorage.setItem(USER_KEY, u.id)
      return null
    } catch (err) {
      console.error('login error:', err instanceof Error ? err.message : JSON.stringify(err))
      return t('auth.wrong_credentials')
    }
  }

  const logout = async () => {
    setUser(null)
    localStorage.removeItem(USER_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin: user?.role === 'admin', login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
