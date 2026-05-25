-- Migration: Drop FK constraints and change UUID columns to TEXT
-- Root cause: app uses local auth with arbitrary user IDs (not real UUIDs)
-- FK constraints prevent sync from pushing data referencing non-existent users

-- 1. Drop ALL foreign key constraints referencing public.users(id)
ALTER TABLE public.cars DROP CONSTRAINT IF EXISTS cars_created_by_fkey;
ALTER TABLE public.cars DROP CONSTRAINT IF EXISTS cars_updated_by_fkey;
ALTER TABLE public.cars DROP CONSTRAINT IF EXISTS cars_confirmed_by_fkey;

ALTER TABLE public.car_images DROP CONSTRAINT IF EXISTS car_images_created_by_fkey;

ALTER TABLE public.car_fees DROP CONSTRAINT IF EXISTS car_fees_created_by_fkey;
ALTER TABLE public.car_fees DROP CONSTRAINT IF EXISTS car_fees_updated_by_fkey;

ALTER TABLE public.car_stages DROP CONSTRAINT IF EXISTS car_stages_moved_by_fkey;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_created_by_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_updated_by_fkey;

ALTER TABLE public.edit_requests DROP CONSTRAINT IF EXISTS edit_requests_requested_by_fkey;
ALTER TABLE public.edit_requests DROP CONSTRAINT IF EXISTS edit_requests_reviewed_by_fkey;

ALTER TABLE public.change_log DROP CONSTRAINT IF EXISTS change_log_user_id_fkey;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_created_by_fkey;

-- 2. Drop FK constraints referencing public.cars(id)
ALTER TABLE public.car_images DROP CONSTRAINT IF EXISTS car_images_car_id_fkey;
ALTER TABLE public.car_fees DROP CONSTRAINT IF EXISTS car_fees_car_id_fkey;
ALTER TABLE public.car_stages DROP CONSTRAINT IF EXISTS car_stages_car_id_fkey;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_car_id_fkey;
ALTER TABLE public.edit_requests DROP CONSTRAINT IF EXISTS edit_requests_car_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_car_id_fkey;

-- 3. Change all user-reference columns from UUID to TEXT
ALTER TABLE public.cars ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.cars ALTER COLUMN updated_by TYPE TEXT;
ALTER TABLE public.cars ALTER COLUMN confirmed_by TYPE TEXT;
ALTER TABLE public.car_images ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.car_fees ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.car_fees ALTER COLUMN updated_by TYPE TEXT;
ALTER TABLE public.car_stages ALTER COLUMN moved_by TYPE TEXT;
ALTER TABLE public.customers ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.customers ALTER COLUMN updated_by TYPE TEXT;
ALTER TABLE public.edit_requests ALTER COLUMN requested_by TYPE TEXT;
ALTER TABLE public.edit_requests ALTER COLUMN reviewed_by TYPE TEXT;
ALTER TABLE public.change_log ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.change_log ALTER COLUMN record_id TYPE TEXT;
ALTER TABLE public.notifications ALTER COLUMN user_id TYPE TEXT;
ALTER TABLE public.notifications ALTER COLUMN created_by TYPE TEXT;

-- 4. Change car_id references to TEXT
ALTER TABLE public.car_images ALTER COLUMN car_id TYPE TEXT;
ALTER TABLE public.car_fees ALTER COLUMN car_id TYPE TEXT;
ALTER TABLE public.car_stages ALTER COLUMN car_id TYPE TEXT;
ALTER TABLE public.customers ALTER COLUMN car_id TYPE TEXT;
ALTER TABLE public.edit_requests ALTER COLUMN car_id TYPE TEXT;
ALTER TABLE public.notifications ALTER COLUMN car_id TYPE TEXT;

-- 5. Change all id columns to TEXT
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.cars ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.car_images ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.car_fees ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.car_stages ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.customers ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.edit_requests ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.change_log ALTER COLUMN id TYPE TEXT;
ALTER TABLE public.notifications ALTER COLUMN id TYPE TEXT;
