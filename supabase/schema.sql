-- BMS Global - Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (independent of Supabase Auth — local auth only)
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cars table
CREATE TABLE public.cars (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  model_year SMALLINT NOT NULL CHECK (model_year >= 2021 AND model_year <= 2026),
  serial_number TEXT,
  license_plate TEXT,
  seller_number TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  initial_price BIGINT NOT NULL,
  notes TEXT DEFAULT '',
  current_stage TEXT NOT NULL DEFAULT 'deposit' CHECK (current_stage IN ('deposit','purchase','parking','shipping_prep','shipping')),
  confirmed BOOLEAN DEFAULT false,
  has_pending_edit BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_by UUID NOT NULL REFERENCES public.users(id),
  confirmed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT car_identifier CHECK (serial_number IS NOT NULL OR license_plate IS NOT NULL)
);

-- Car images
CREATE TABLE public.car_images (
  id UUID PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  order_index INT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car fees
CREATE TABLE public.car_fees (
  id UUID PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE UNIQUE,
  deposit BIGINT NOT NULL,
  second_payment BIGINT NOT NULL,
  transport_fee_1 BIGINT DEFAULT 0,
  transport_fee_2 BIGINT DEFAULT 0,
  other_fees BIGINT DEFAULT 0,
  file_fees BIGINT DEFAULT 0,
  shipping_fees BIGINT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Car stages progression log
CREATE TABLE public.car_stages (
  id UUID PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('deposit','purchase','parking','shipping_prep','shipping')),
  evidence_url TEXT,
  notes TEXT DEFAULT '',
  moved_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (end buyer)
CREATE TABLE public.customers (
  id UUID PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  national_id TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  id_image_path TEXT,
  car_document_path TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edit requests (employee changes after confirmation)
CREATE TABLE public.edit_requests (
  id UUID PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id),
  old_data JSONB NOT NULL,
  new_data JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Change log (sync backbone)
CREATE TABLE public.change_log (
  id UUID PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID NOT NULL REFERENCES public.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  car_id UUID REFERENCES public.cars(id),
  is_read BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cars_created_by ON public.cars(created_by);
CREATE INDEX idx_cars_current_stage ON public.cars(current_stage);
CREATE INDEX idx_car_images_car_id ON public.car_images(car_id);
CREATE INDEX idx_car_stages_car_id ON public.car_stages(car_id);
CREATE INDEX idx_edit_requests_car_id ON public.edit_requests(car_id);
CREATE INDEX idx_edit_requests_status ON public.edit_requests(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_change_log_timestamp ON public.change_log(timestamp);
CREATE INDEX idx_customers_car_id ON public.customers(car_id);

-- Disable Row Level Security (app manages auth locally)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Storage bucket for car images
INSERT INTO storage.buckets (id, name, public) VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to car-images bucket
CREATE POLICY "public_read_car_images" ON storage.objects FOR SELECT USING (bucket_id = 'car-images');
CREATE POLICY "public_insert_car_images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'car-images');
CREATE POLICY "public_delete_car_images" ON storage.objects FOR DELETE USING (bucket_id = 'car-images');
