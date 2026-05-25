export type CarStage = 'deposit' | 'purchase' | 'parking' | 'shipping_prep' | 'shipping'
export type UserRole = 'admin' | 'employee'
export type EditRequestStatus = 'pending' | 'approved' | 'rejected'
export type NotificationType = 'car_added' | 'car_updated' | 'car_deleted' | 'edit_requested' | 'edit_approved' | 'edit_rejected' | 'stage_changed' | 'car_confirmed'
export type Lang = 'ar' | 'fr' | 'en'

export interface User {
  id: string
  username: string
  role: UserRole
  full_name: string
  is_active: boolean
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Car {
  id: string
  name: string
  model_year: number
  serial_number: string | null
  license_plate: string | null
  seller_number: string
  owner_name: string
  initial_price: number
  notes: string
  current_stage: CarStage
  confirmed: boolean
  has_pending_edit: boolean
  created_by: string
  updated_by: string
  confirmed_by: string | null
  created_at: string
  updated_at: string
}

export interface CarImage {
  id: string
  car_id: string
  storage_path: string
  order_index: number
  created_by: string
  created_at: string
}

export interface CarFees {
  id: string
  car_id: string
  deposit: number
  second_payment: number
  transport_fee_1: number
  transport_fee_2: number
  other_fees: number
  file_fees: number
  shipping_fees: number
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface CarStageLog {
  id: string
  car_id: string
  stage: CarStage
  evidence_url: string | null
  notes: string
  moved_by: string
  created_at: string
}

export interface Customer {
  id: string
  car_id: string
  first_name: string
  last_name: string
  national_id: string
  address: string
  postal_code: string
  phone: string
  email: string
  id_image_path: string | null
  car_document_path: string | null
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

export interface EditRequest {
  id: string
  car_id: string
  requested_by: string
  old_data: any
  new_data: any
  reason: string
  status: EditRequestStatus
  reviewed_by: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export interface ChangeLog {
  id: string
  table_name: string
  record_id: string
  operation: 'insert' | 'update' | 'delete'
  old_data: any
  new_data: any
  user_id: string
  timestamp: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  car_id: string | null
  is_read: boolean
  created_by: string
  created_at: string
}

export interface CarFormData {
  name: string
  model_year: number
  serial_number: string
  license_plate: string
  seller_number: string
  owner_name: string
  initial_price: number
  notes: string
}

export interface CustomerFormData {
  first_name: string
  last_name: string
  national_id: string
  address: string
  postal_code: string
  phone: string
  email: string
}

export interface CarFeesFormData {
  deposit: number
  second_payment: number
  transport_fee_1: number
  transport_fee_2: number
  other_fees: number
  file_fees: number
  shipping_fees: number
}

export const STAGE_LABELS: Record<CarStage, string> = {
  deposit: 'stages.deposit',
  purchase: 'stages.purchase',
  parking: 'stages.parking',
  shipping_prep: 'stages.shipping_prep',
  shipping: 'stages.shipping',
}

export const STAGE_ORDER: CarStage[] = ['deposit', 'purchase', 'parking', 'shipping_prep', 'shipping']

export const MODEL_YEARS = [2026, 2025, 2024, 2023, 2022, 2021]
