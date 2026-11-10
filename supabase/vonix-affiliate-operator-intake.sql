-- Vonix Hair Afiliadas only. Owner-controlled emergency collection switch.
-- This table is never exposed to anon/authenticated clients.
CREATE TABLE IF NOT EXISTS public.vonix_affiliate_operator_intake (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  owner_acknowledged_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vonix_affiliate_operator_intake ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vonix_affiliate_operator_intake FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vonix_affiliate_operator_intake TO service_role;
INSERT INTO public.vonix_affiliate_operator_intake (singleton, enabled)
VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;
-- The controller must explicitly turn enabled ON after verified consent notice,
-- Supabase readback, rate-limit and encryption tests; can turn OFF immediately.
-- UPDATE public.vonix_affiliate_operator_intake
-- SET enabled=false, updated_at=now() WHERE singleton=true;
