import { createClient } from '@supabase/supabase-js'
import type {
  Car, CarImage, CarFees, CarStageLog, Customer,
  EditRequest, ChangeLog, Notification, User,
} from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isSupabaseConfigured = () => supabase !== null

export async function checkConnection(): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('users').select('id').limit(1)
    return !error
  } catch {
    return false
  }
}

// ── Helper ─────────────────────────────────────────────────────

async function handleResponse<T>(promise: Promise<{ data: any; error: any }>): Promise<{ data: T | null; error: any }> {
  const { data, error } = await promise
  if (error) console.error('Supabase error:', JSON.stringify(error))
  return { data: data as T | null, error }
}

// ── Change Log ─────────────────────────────────────────────────

export async function createChangeLogEntry(entry: Omit<ChangeLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) {
  if (!supabase) return { data: null, error: { message: 'Supabase not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const record = {
    id: entry.id || crypto.randomUUID(),
    table_name: entry.table_name,
    record_id: entry.record_id,
    operation: entry.operation,
    old_data: entry.old_data || null,
    new_data: entry.new_data || null,
    user_id: entry.user_id || '',
    timestamp: entry.timestamp || new Date().toISOString(),
  }
  return handleResponse(supabase.from('change_log').insert(record).select().single())
}

// ── Users ──────────────────────────────────────────────────────

export async function fetchAllUsers() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<User[]>(supabase.from('users').select('*'))
}

export async function fetchUser(id: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<User>(supabase.from('users').select('*').eq('id', id).maybeSingle())
}

export async function fetchUserByUsername(username: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<User>(supabase.from('users').select('*').eq('username', username).maybeSingle())
}

export async function insertUser(user: User) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data, error } = await handleResponse<User>(supabase.from('users').insert(user).select().single())
  if (!error) {
    await createChangeLogEntry({
      table_name: 'users', record_id: user.id, operation: 'insert',
      old_data: null, new_data: user, user_id: user.id,
    })
  }
  return { data, error }
}

export async function updateUser(id: string, changes: Partial<User>) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data: oldData } = await fetchUser(id)
  const { data, error } = await handleResponse<User>(supabase.from('users').update(changes).eq('id', id).select().single())
  if (!error && data) {
    await createChangeLogEntry({
      table_name: 'users', record_id: id, operation: 'update',
      old_data: oldData, new_data: data,       user_id: id,
    })
  }
  return { data, error }
}

export async function deleteUser(id: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data: oldData } = await fetchUser(id)
  const { data, error } = await handleResponse(supabase.from('users').delete().eq('id', id))
  if (!error && oldData) {
    await createChangeLogEntry({
      table_name: 'users', record_id: id, operation: 'delete',
      old_data: oldData, new_data: null, user_id: oldData.id,
    })
  }
  return { data, error }
}

// ── Cars ───────────────────────────────────────────────────────

export async function fetchAllCars() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Car[]>(supabase.from('cars').select('*').order('updated_at', { ascending: false }))
}

export async function fetchCar(id: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Car>(supabase.from('cars').select('*').eq('id', id).maybeSingle())
}

export async function fetchCarsByStage(stage: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Car[]>(supabase.from('cars').select('*').eq('current_stage', stage))
}

export async function fetchCarsByCreator(userId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Car[]>(supabase.from('cars').select('*').eq('created_by', userId))
}

export async function fetchPendingCars() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Car[]>(supabase.from('cars').select('*').eq('has_pending_edit', true))
}

export async function fetchConfirmedCars() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Car[]>(supabase.from('cars').select('*').eq('confirmed', true))
}

export async function insertCar(car: Car) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data, error } = await handleResponse<Car>(supabase.from('cars').insert(car).select().single())
  if (!error) {
    await createChangeLogEntry({
      table_name: 'cars', record_id: car.id, operation: 'insert',
      old_data: null, new_data: car, user_id: car.created_by,
    })
  }
  return { data, error }
}

export async function updateCar(id: string, changes: Partial<Car>) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data: oldData } = await fetchCar(id)
  const { data, error } = await handleResponse<Car>(supabase.from('cars').update(changes).eq('id', id).select().single())
  if (!error && data) {
    await createChangeLogEntry({
      table_name: 'cars', record_id: id, operation: 'update',
      old_data: oldData, new_data: data,       user_id: changes.updated_by || (oldData?.created_by) || '',
    })
  }
  return { data, error }
}

export async function deleteCar(id: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data: oldData } = await fetchCar(id)
  const { data, error } = await handleResponse(supabase.from('cars').delete().eq('id', id))
  if (!error && oldData) {
    await createChangeLogEntry({
      table_name: 'cars', record_id: id, operation: 'delete',
      old_data: oldData, new_data: null, user_id: '',
    })
  }
  return { data, error }
}

// ── Car Images ─────────────────────────────────────────────────

export async function fetchCarImages(carId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<CarImage[]>(supabase.from('car_images').select('*').eq('car_id', carId).order('order_index'))
}

export async function insertCarImage(image: CarImage) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<CarImage>(supabase.from('car_images').insert(image).select().single())
}

export async function deleteCarImage(id: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse(supabase.from('car_images').delete().eq('id', id))
}

export async function reorderCarImages(carId: string, orderedIds: string[]) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data: images } = await fetchCarImages(carId)
  if (!images) return { data: null, error: null }
  const updates = images.map(img => {
    const idx = orderedIds.indexOf(img.id)
    if (idx !== -1 && img.order_index !== idx) {
      return supabase.from('car_images').update({ order_index: idx }).eq('id', img.id)
    }
    return Promise.resolve({ data: null, error: null })
  })
  await Promise.all(updates)
  return { data: null, error: null }
}

// ── Car Fees ───────────────────────────────────────────────────

export async function fetchCarFees(carId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<CarFees>(supabase.from('car_fees').select('*').eq('car_id', carId).maybeSingle())
}

export async function upsertCarFees(fees: CarFees) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data: existing } = await fetchCarFees(fees.car_id)
  const { data, error } = await handleResponse<CarFees>(supabase.from('car_fees').upsert(fees).select().single())
  if (!error && data) {
    await createChangeLogEntry({
      table_name: 'car_fees', record_id: data.id, operation: existing ? 'update' : 'insert',
      old_data: existing, new_data: data, user_id: fees.updated_by || fees.created_by || '',
    })
  }
  return { data, error }
}

// ── Car Stage Log ──────────────────────────────────────────────

export async function fetchCarStageLogs(carId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<CarStageLog[]>(supabase.from('car_stages').select('*').eq('car_id', carId).order('created_at'))
}

export async function insertCarStageLog(log: CarStageLog) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<CarStageLog>(supabase.from('car_stages').insert(log).select().single())
}

export async function updateCarStageLog(id: string, changes: Partial<CarStageLog>) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<CarStageLog>(supabase.from('car_stages').update(changes).eq('id', id).select().single())
}

// ── Customers ──────────────────────────────────────────────────

export async function fetchCustomerByCar(carId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Customer>(supabase.from('customers').select('*').eq('car_id', carId).maybeSingle())
}

export async function insertCustomer(customer: Customer) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Customer>(supabase.from('customers').insert(customer).select().single())
}

export async function updateCustomer(id: string, changes: Partial<Customer>) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Customer>(supabase.from('customers').update(changes).eq('id', id).select().single())
}

// ── Edit Requests ──────────────────────────────────────────────

export async function fetchEditRequests() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<EditRequest[]>(supabase.from('edit_requests').select('*'))
}

export async function fetchEditRequestsByCar(carId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<EditRequest[]>(supabase.from('edit_requests').select('*').eq('car_id', carId))
}

export async function fetchPendingEditRequests() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<EditRequest[]>(supabase.from('edit_requests').select('*').eq('status', 'pending'))
}

export async function fetchEditRequestsByUser(userId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<EditRequest[]>(supabase.from('edit_requests').select('*').eq('requested_by', userId))
}

export async function insertEditRequest(request: EditRequest) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<EditRequest>(supabase.from('edit_requests').insert(request).select().single())
}

export async function updateEditRequest(id: string, changes: Partial<EditRequest>) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const reviewedAt = changes.status && changes.status !== 'pending' ? new Date().toISOString() : undefined
  const payload = reviewedAt ? { ...changes, reviewed_at: reviewedAt } : changes
  return handleResponse<EditRequest>(supabase.from('edit_requests').update(payload).eq('id', id).select().single())
}

// ── Change Log (read) ──────────────────────────────────────────

export async function fetchChangeLogs() {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<ChangeLog[]>(supabase.from('change_log').select('*').order('timestamp', { ascending: false }))
}

export async function fetchChangeLogsByTable(tableName: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<ChangeLog[]>(supabase.from('change_log').select('*').eq('table_name', tableName).order('timestamp', { ascending: false }))
}

// ── Notifications ──────────────────────────────────────────────

export async function fetchNotifications(userId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Notification[]>(supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }))
}

export async function fetchUnreadNotifications(userId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Notification[]>(supabase.from('notifications').select('*').eq('user_id', userId).eq('is_read', false))
}

export async function insertNotification(notification: Notification) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse<Notification>(supabase.from('notifications').insert(notification).select().single())
}

export async function markNotificationRead(id: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse(supabase.from('notifications').update({ is_read: true }).eq('id', id))
}

export async function markAllNotificationsRead(userId: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  return handleResponse(supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false))
}

// ── Storage ────────────────────────────────────────────────────

const BUCKET = 'car-images'

export async function uploadImage(file: File, path: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  return { data, error }
}

export function getPublicUrl(path: string) {
  if (!supabase) return ''
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteImage(path: string) {
  if (!supabase) return { data: null, error: { message: 'Not configured', details: '', hint: '', code: 'NOT_CONFIGURED' } }
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error }
}
