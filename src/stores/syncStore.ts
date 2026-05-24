import { create } from 'zustand'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncState {
  status: SyncStatus
  lastSyncAt: string | null
  error: string | null
  setStatus: (status: SyncStatus) => void
  setLastSyncAt: (ts: string | null) => void
  setError: (error: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  error: null,
  setStatus: (status) => set({ status, error: status === 'error' ? null : null }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  setError: (error) => set({ error }),
}))
