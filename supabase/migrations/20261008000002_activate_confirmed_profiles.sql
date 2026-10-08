-- ==============================================================================
-- Migration: 20261008000002_activate_confirmed_profiles.sql
-- Description: Restores the PENDING_VERIFICATION -> ACTIVE transition when an
--              email is confirmed. 20260925000004 rewrote handle_new_user and
--              dropped it, so accounts created as PENDING_VERIFICATION stayed
--              blocked forever, even after confirming their email.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, phone, avatar_url, account_status, account_status_changed_at, updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
    'ACTIVE'::public.account_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
        THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    account_status = CASE
      WHEN public.profiles.account_status = 'PENDING_VERIFICATION' AND NEW.email_confirmed_at IS NOT NULL
        THEN 'ACTIVE'::public.account_status
      ELSE public.profiles.account_status
    END,
    account_status_changed_at = CASE
      WHEN public.profiles.account_status = 'PENDING_VERIFICATION' AND NEW.email_confirmed_at IS NOT NULL
        THEN NOW()
      ELSE public.profiles.account_status_changed_at
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Repair accounts that confirmed their email while the transition was missing.
UPDATE public.profiles p
SET account_status = 'ACTIVE'::public.account_status,
    account_status_changed_at = NOW(),
    updated_at = NOW()
FROM auth.users u
WHERE u.id = p.id
  AND p.account_status = 'PENDING_VERIFICATION'
  AND u.email_confirmed_at IS NOT NULL;
