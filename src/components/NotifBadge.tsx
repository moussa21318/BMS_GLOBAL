import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { localDB } from '../db/local'

export function NotifBadge() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) { setCount(0); return }
    let cancelled = false
    const update = async () => {
      const c = await localDB.notifications
        .where({ user_id: user.id, is_read: false })
        .count()
      if (!cancelled) setCount(c)
    }
    update()
    const interval = setInterval(update, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user])

  if (count === 0) return null

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}
