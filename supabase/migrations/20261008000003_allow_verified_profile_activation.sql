-- ==============================================================================
-- Migration: 20261008000003_allow_verified_profile_activation.sql
-- Description: Lets a confirmed email activate a pending profile.
--
-- protect_profile_security_fields rejects every account_status change that
-- does not come from the service role. When Supabase Auth confirms an email
-- it updates auth.users, and handle_new_user then moves the profile from
-- PENDING_VERIFICATION to ACTIVE; that runs on the Auth server's connection,
-- not as service_role, so the guard aborted the whole confirmation.
--
-- The guard now allows exactly that one transition, and only when the user's
-- email is confirmed in auth.users. Every other security-field change is still
-- rejected.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Profiles cannot be deleted directly. Use the account deletion workflow.';
  END IF;

  IF NEW.id <> OLD.id
     OR NEW.account_status <> OLD.account_status
     OR NEW.account_status_changed_at <> OLD.account_status_changed_at THEN
    -- A confirmed email may activate a pending account, nothing else.
    IF NEW.id = OLD.id
       AND OLD.account_status = 'PENDING_VERIFICATION'
       AND NEW.account_status = 'ACTIVE'
       AND EXISTS (
         SELECT 1 FROM auth.users u
         WHERE u.id = NEW.id AND u.email_confirmed_at IS NOT NULL
       ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Profile security fields are managed by the server.';
  END IF;

  RETURN NEW;
END;
$$;
