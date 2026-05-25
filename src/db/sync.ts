import { localDB } from './local'
import {
  supabase,
  isSupabaseConfigured,
  fetchAllCars,
  fetchAllCarImages,
  fetchAllCarFees,
  fetchAllCarStages,
  fetchAllCustomers,
  fetchAllEditRequests,
  fetchAllNotifications,
  fetchAllUsers,
  createChangeLog,
} from './cloud'
import { useSyncStore } from '../stores/syncStore'
import type { Car, CarImage, CarFees, CarStageLog, Customer, EditRequest, Notification, User } from '../types'

const TABLE_ACTIONS: Record<string, (rows: any[]) => Promise<void>> = {
  cars: (rows) => localDB.upsertCars(rows as Car[]),
  car_images: (rows) => localDB.upsertCarImages(rows as CarImage[]),
  car_fees: (rows) => localDB.upsertCarFees(rows as CarFees[]),
  car_stages: (rows) => localDB.upsertCarStages(rows as CarStageLog[]),
  customers: (rows) => localDB.upsertCustomers(rows as Customer[]),
  edit_requests: (rows) => localDB.upsertEditRequests(rows as EditRequest[]),
  notifications: (rows) => localDB.upsertNotifications(rows as Notification[]),
  users: (rows) => localDB.upsertUsers(rows as User[]),
}

const BULK_FETCHERS: Record<string, () => Promise<{ data: any; error: any }>> = {
  cars: fetchAllCars,
  car_images: fetchAllCarImages,
  car_fees: fetchAllCarFees,
  car_stages: fetchAllCarStages,
  customers: fetchAllCustomers,
  edit_requests: fetchAllEditRequests,
  notifications: fetchAllNotifications,
  users: fetchAllUsers,
}

function resolveTableAction(table: string, row: any) {
  const fn = TABLE_ACTIONS[table]
  if (fn) return fn([row])
  return Promise.resolve()
}

async function resolveDelete(table: string, recordId: string) {
  switch (table) {
    case 'cars':
      await localDB.deleteCar(recordId)
      break
    case 'car_images':
      await localDB.carImages.delete(recordId)
      break
    case 'car_fees':
      await localDB.carFees.where('car_id').equals(recordId).delete()
      break
    case 'car_stages':
      await localDB.carStages.where('car_id').equals(recordId).delete()
      break
    case 'customers':
      await localDB.customers.delete(recordId)
      break
    case 'edit_requests':
      await localDB.editRequests.delete(recordId)
      break
    case 'notifications':
      await localDB.notifications.delete(recordId)
      break
    case 'users':
      await localDB.users.delete(recordId)
      break
  }
}

class SyncManager {
  private isSyncing = false
  private ready = false
  private lastSyncTimestamp: string | null = null
  private subscriptions: { unsubscribe: () => void }[] = []

  setReady(ready: boolean) {
    this.ready = ready
  }

  isReady(): boolean {
    return this.ready
  }

  getLastSyncTimestamp(): string | null {
    return this.lastSyncTimestamp
  }

  setLastSyncTimestamp(ts: string | null) {
    this.lastSyncTimestamp = ts
  }

  async pushChanges() {
    let entries: import('../db/local').SyncQueueEntry[] = []
    try {
      entries = await localDB.getUnsyncedEntries()
    } catch (err) {
      console.error('Error reading unsynced entries:', err instanceof Error ? err.message : JSON.stringify(err))
      return
    }
    if (entries.length === 0) {
      // Retry once after 2s in case DB was being initialized
      await new Promise(r => setTimeout(r, 2000))
      try {
        entries = await localDB.getUnsyncedEntries()
      } catch (err) {
        console.error('Error reading unsynced entries (retry):', err instanceof Error ? err.message : JSON.stringify(err))
        return
      }
      if (entries.length === 0) return
    }

    const syncedIds: string[] = []

    for (const entry of entries) {
      try {
        const changeLogEntry = await localDB.changeLog.get(entry.change_log_id)
        if (changeLogEntry && changeLogEntry.table_name !== 'change_log') {
          const { error } = await createChangeLog(changeLogEntry)
          if (error) {
            console.error('Failed to push change log entry:', JSON.stringify(error))
            continue
          }
        }

        const { table_name, record_id, operation } = entry
        const { error } = await this.applyToSupabase(table_name, record_id, operation, entry.change_log_id)
        if (error) {
          console.error(`Failed to push ${operation} on ${table_name}/${record_id}:`, JSON.stringify(error))
          continue
        }

        syncedIds.push(entry.id)
      } catch (err) {
        console.error(`Error processing sync entry ${entry.id}:`, err instanceof Error ? err.message : JSON.stringify(err))
      }
    }

    if (syncedIds.length > 0) {
      try {
        await localDB.deleteSynced(syncedIds)
      } catch (err) {
        console.error('Error deleting synced entries:', err instanceof Error ? err.message : JSON.stringify(err))
      }
    }
  }

  private async applyToSupabase(
    table: string,
    recordId: string,
    operation: string,
    changeLogId: string,
  ): Promise<{ error: any }> {
    try {
      const changeLogEntry = await localDB.changeLog.get(changeLogId)
      if (!changeLogEntry) return { error: null }

      const { new_data } = changeLogEntry

      switch (operation) {
        case 'insert':
        case 'update': {
          if (!new_data) return { error: null }
          const { error, data } = await supabase!.from(table).upsert(new_data).select()
          if (error) {
            console.error(`applyToSupabase insert/update error on ${table}/${recordId}:`, JSON.stringify(error))
          }
          return { error }
        }
        case 'delete': {
          const { error } = await supabase!.from(table).delete().eq('id', recordId)
          if (error) {
            console.error(`applyToSupabase delete error on ${table}/${recordId}:`, JSON.stringify(error))
          }
          return { error }
        }
        default:
          return { error: null }
      }
    } catch (err) {
      console.error(`applyToSupabase exception on ${table}/${recordId}:`, err instanceof Error ? err.message : JSON.stringify(err))
      return { error: err }
    }
  }

  async pullChanges() {
    const tables = Object.keys(BULK_FETCHERS)
    for (const table of tables) {
      const fetchFn = BULK_FETCHERS[table]
      if (!fetchFn) continue
      try {
        const { data, error } = await fetchFn()
        if (error) {
          console.error(`Failed to pull ${table}:`, error instanceof Error ? error.message : JSON.stringify(error))
          continue
        }
        if (data && data.length > 0) {
          const upsertFn = TABLE_ACTIONS[table]
          if (upsertFn) {
            await upsertFn(data)
          }
        }
      } catch (err) {
        console.error(`Error pulling ${table}:`, err instanceof Error ? err.message : JSON.stringify(err))
      }
    }
  }

  async sync() {
    if (this.isSyncing) return
    this.isSyncing = true
    useSyncStore.getState().setStatus('syncing')
    try {
      await this.pushChanges()
      if (isSupabaseConfigured()) {
        await this.pullChanges()
      }
      this.lastSyncTimestamp = new Date().toISOString()
      useSyncStore.getState().setLastSyncAt(this.lastSyncTimestamp)
      useSyncStore.getState().setStatus('success')
    } catch (err) {
      console.error('Sync failed:', err instanceof Error ? err.message : JSON.stringify(err))
      useSyncStore.getState().setStatus('error')
      useSyncStore.getState().setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      this.isSyncing = false
    }
  }

  setupRealtime() {
    const channels = Object.keys(BULK_FETCHERS).map(table => {
      return supabase
        .channel(`sync-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          async (payload) => {
            try {
              await this.handleRealtimeEvent(table, payload)
            } catch (err) {
              console.error(`Realtime error on ${table}:`, err instanceof Error ? err.message : JSON.stringify(err))
            }
          },
        )
        .subscribe()
    })
    this.subscriptions = channels
  }

  private async handleRealtimeEvent(table: string, payload: any) {
    const eventType = payload.eventType as string
    const record = payload.new as Record<string, any> | null

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (record) {
          await resolveTableAction(table, record)
        }
        break
      case 'DELETE': {
        const oldRecord = payload.old as Record<string, any>
        if (oldRecord?.id) {
          await resolveDelete(table, oldRecord.id)
        }
        break
      }
    }
  }

  cleanup() {
    for (const sub of this.subscriptions) {
      sub.unsubscribe()
    }
    this.subscriptions = []
  }
}

export const syncManager = new SyncManager()

// Auto-sync: register callback so localDB triggers sync after each CRUD
localDB.setAutoSyncCallback(() => {
  if (syncManager.isReady() && isSupabaseConfigured()) {
    syncManager.sync()
  }
})
