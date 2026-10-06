-- Keep Auth profile provisioning reliable for admin-created and locally
-- confirmed users. Supabase populates email_confirmed_at around the Auth
-- insert, so deriving a pending state inside the trigger can violate the
-- profile RLS insert policy during that transaction. The application still
-- verifies the Auth user's confirmation state at sign-in.

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
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
