-- Add dealer to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dealer';

-- Remove remaining permissive policies on freight and payments
DROP POLICY IF EXISTS "Allow authenticated read" ON public.freight;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.freight;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.freight;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.freight;

DROP POLICY IF EXISTS "Allow authenticated read" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.payments;
DROP POLICY IF EXISTS "Allow authenticated delete" ON public.payments;