import { createClient } from '@supabase/supabase-js'

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

// ── Helpers ─────────────────────────────────────────────────────

function client() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

async function fetchAll(table: string) {
  const { data, error } = await client().from(table).select('*')
  return { data, error }
}

async function upsertRecord(table: string, record: any) {
  const { data, error } = await client().from(table).upsert(record).select()
  return { data, error }
}

async function deleteRecord(table: string, id: string) {
  const { error } = await client().from(table).delete().eq('id', id)
  return { error }
}

// ── CRUD per table ──────────────────────────────────────────────

export async function fetchAllCars() {
  return fetchAll('cars')
}

export async function fetchAllCarImages() {
  return fetchAll('car_images')
}

export async function fetchAllCarFees() {
  return fetchAll('car_fees')
}

export async function fetchAllCarStages() {
  return fetchAll('car_stages')
}

export async function fetchAllCustomers() {
  return fetchAll('customers')
}

export async function fetchAllEditRequests() {
  return fetchAll('edit_requests')
}

export async function fetchAllNotifications() {
  return fetchAll('notifications')
}

export async function fetchAllUsers() {
  return fetchAll('users')
}

export async function upsertCar(car: any) {
  return upsertRecord('cars', car)
}

export async function upsertCarImage(image: any) {
  return upsertRecord('car_images', image)
}

export async function upsertCarFees(fees: any) {
  return upsertRecord('car_fees', fees)
}

export async function upsertCarStage(stage: any) {
  return upsertRecord('car_stages', stage)
}

export async function upsertCustomer(customer: any) {
  return upsertRecord('customers', customer)
}

export async function upsertEditRequest(request: any) {
  return upsertRecord('edit_requests', request)
}

export async function upsertNotification(notification: any) {
  return upsertRecord('notifications', notification)
}

export async function upsertUser(user: any) {
  return upsertRecord('users', user)
}

export async function deleteCarImage(id: string) {
  return deleteRecord('car_images', id)
}

// ── Change Log ──────────────────────────────────────────────────

export async function createChangeLog(entry: {
  id: string
  table_name: string
  record_id: string
  operation: 'insert' | 'update' | 'delete'
  old_data: any
  new_data: any
  user_id: string
  timestamp: string
}) {
  const { data, error } = await client().from('change_log').upsert(entry).select()
  return { data, error }
}

// ── Storage ─────────────────────────────────────────────────────

const BUCKET = 'car-images'

export async function uploadImage(file: File, path: string) {
  const { data, error } = await client().storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  return { data, error }
}

export function getPublicUrl(path: string) {
  const { data } = client().storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteImage(path: string) {
  const { error } = await client().storage.from(BUCKET).remove([path])
  return { error }
}
