import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase, isSupabaseConfigured } from '../db/cloud'
import { hash } from '../utils/hash'
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

    const passwordHash = hash(password)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .maybeSingle()

      if (error || !data || !data.is_active) return t('auth.wrong_credentials')

      const u = data as User
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
    <AuthContext.Provider value={{ user, isAdmin: user?.role === 'admin', login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
