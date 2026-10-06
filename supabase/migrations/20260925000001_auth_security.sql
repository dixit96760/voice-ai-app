-- =============================================================================
-- Additive authentication, organization membership, and security foundations
-- =============================================================================
-- Supabase Auth remains the source of truth for:
--   auth.users, password hashing, refresh sessions, email verification,
--   password-reset tokens, OAuth identities, and MFA factors.
-- This migration intentionally does not duplicate those secrets in public tables.
-- =============================================================================

-- 1. Enumerations -----------------------------------------------------------------------------

DO $$
BEGIN
  CREATE TYPE public.account_status AS ENUM (
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'LOCKED',
    'DEACTIVATED',
    'DELETION_PENDING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.organization_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.organization_membership_status AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.organization_invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.api_key_status AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Account state on the existing profile ----------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Re-define the existing Auth provisioning trigger with a fixed search path.
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
    CASE
      WHEN NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NULL THEN 'PENDING_VERIFICATION'::public.account_status
      ELSE 'ACTIVE'::public.account_status
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
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

-- 3. Organizations and memberships -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status public.account_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  status public.organization_membership_status NOT NULL DEFAULT 'ACTIVE',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user
  ON public.organization_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization
  ON public.organization_members (organization_id, role);

-- Backfill every existing business without changing its owner or product data.
INSERT INTO public.organizations (business_id, name, created_by)
SELECT id, business_name, owner_id
FROM public.businesses
ON CONFLICT (business_id) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = NOW();

INSERT INTO public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at
)
SELECT o.id, b.owner_id, 'OWNER', 'ACTIVE', COALESCE(o.created_at, NOW())
FROM public.organizations o
JOIN public.businesses b ON b.id = o.business_id
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'OWNER',
    status = 'ACTIVE';

-- Keep new businesses compatible with the membership model without changing
-- the existing businesses.owner_id contract.
CREATE OR REPLACE FUNCTION public.handle_new_business_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id UUID;
BEGIN
  INSERT INTO public.organizations (business_id, name, created_by)
  VALUES (NEW.id, NEW.business_name, NEW.owner_id)
  ON CONFLICT (business_id) DO UPDATE
    SET name = EXCLUDED.name, updated_at = NOW()
  RETURNING id INTO v_organization_id;

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status, joined_at
  )
  VALUES (v_organization_id, NEW.owner_id, 'OWNER', 'ACTIVE', NOW())
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = 'OWNER', status = 'ACTIVE', updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_business_created_organization ON public.businesses;
CREATE TRIGGER on_business_created_organization
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_business_organization();

CREATE OR REPLACE FUNCTION public.protect_business_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NEW.owner_id <> OLD.owner_id THEN
    RAISE EXCEPTION 'Business ownership changes require a server-only transfer operation.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_business_owner ON public.businesses;
CREATE TRIGGER protect_business_owner
  BEFORE UPDATE OF owner_id ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.protect_business_owner();

-- Prevent role escalation and removal of the last active owner.
CREATE OR REPLACE FUNCTION public.protect_organization_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.role = 'OWNER'
     AND OLD.role <> 'OWNER'
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Owner promotion requires a dedicated server-only transfer operation.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Organization membership user_id is immutable.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'OWNER' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND role = 'OWNER'
      AND status = 'ACTIVE';
    IF v_owner_count > 0 THEN
      RAISE EXCEPTION 'An organization may have only one active owner.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.role = 'OWNER'
     AND (NEW.role <> 'OWNER' OR (OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE')) THEN
    SELECT count(*) INTO v_owner_count
    FROM public.organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'OWNER'
      AND status = 'ACTIVE';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'The last active organization owner cannot be demoted.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'OWNER' AND OLD.status = 'ACTIVE' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'OWNER'
      AND status = 'ACTIVE';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'The last active organization owner cannot be removed.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_organization_owner_membership ON public.organization_members;
CREATE TRIGGER protect_organization_owner_membership
  BEFORE INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_organization_owner();

-- 4. Invitations -------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.organization_role NOT NULL DEFAULT 'MEMBER',
  status public.organization_invitation_status NOT NULL DEFAULT 'PENDING',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_invitations_no_owner CHECK (role <> 'OWNER')
);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_pending_email
  ON public.organization_invitations (organization_id, LOWER(email), status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_invitations
    WHERE status = 'PENDING'
    GROUP BY organization_id, LOWER(email)
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_invitations_pending_email_unique
      ON public.organization_invitations (organization_id, LOWER(email))
      WHERE status = 'PENDING';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expiry
  ON public.organization_invitations (expires_at)
  WHERE status = 'PENDING';

-- 5. Devices and API keys ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  label TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_auth_devices_user_active
  ON public.auth_devices (user_id, last_seen_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  status public.api_key_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_organization
  ON public.api_keys (organization_id, status);

-- 6. Role permissions and auth audit events ---------------------------------------------------

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.organization_role NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS public.auth_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'SUCCESS',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_user
  ON public.auth_security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_organization
  ON public.auth_security_events (organization_id, created_at DESC);

-- Extend the existing application audit log without removing legacy columns.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'SUCCESS';

-- Extend existing webhook receipts with verification metadata.
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS signature_valid BOOLEAN,
  ADD COLUMN IF NOT EXISTS signature_provider TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';

-- 7. Default role permissions ------------------------------------------------------------------

INSERT INTO public.role_permissions (role, permission) VALUES
  ('OWNER', 'organization:read'),
  ('OWNER', 'organization:manage'),
  ('OWNER', 'members:read'),
  ('OWNER', 'members:manage'),
  ('OWNER', 'campaigns:read'),
  ('OWNER', 'campaigns:write'),
  ('OWNER', 'contacts:read'),
  ('OWNER', 'contacts:write'),
  ('OWNER', 'calls:read'),
  ('OWNER', 'calls:write'),
  ('OWNER', 'analytics:read'),
  ('OWNER', 'billing:read'),
  ('OWNER', 'billing:manage'),
  ('OWNER', 'settings:manage'),
  ('OWNER', 'api_keys:manage'),
  ('OWNER', 'audit:read'),
  ('ADMIN', 'organization:read'),
  ('ADMIN', 'organization:manage'),
  ('ADMIN', 'members:read'),
  ('ADMIN', 'members:manage'),
  ('ADMIN', 'campaigns:read'),
  ('ADMIN', 'campaigns:write'),
  ('ADMIN', 'contacts:read'),
  ('ADMIN', 'contacts:write'),
  ('ADMIN', 'calls:read'),
  ('ADMIN', 'calls:write'),
  ('ADMIN', 'analytics:read'),
  ('ADMIN', 'billing:read'),
  ('ADMIN', 'settings:manage'),
  ('ADMIN', 'audit:read'),
  ('MEMBER', 'organization:read'),
  ('MEMBER', 'members:read'),
  ('MEMBER', 'campaigns:read'),
  ('MEMBER', 'campaigns:write'),
  ('MEMBER', 'contacts:read'),
  ('MEMBER', 'contacts:write'),
  ('MEMBER', 'calls:read'),
  ('MEMBER', 'calls:write'),
  ('MEMBER', 'analytics:read'),
  ('VIEWER', 'organization:read'),
  ('VIEWER', 'members:read'),
  ('VIEWER', 'campaigns:read'),
  ('VIEWER', 'contacts:read'),
  ('VIEWER', 'calls:read'),
  ('VIEWER', 'analytics:read')
ON CONFLICT (role, permission) DO NOTHING;

-- 8. Shared authorization helpers ---------------------------------------------------------------
-- These functions are SECURITY DEFINER so RLS on organization_members cannot
-- recursively block policy evaluation. They never return secrets.

CREATE OR REPLACE FUNCTION public.auth_user_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.account_status = 'ACTIVE'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_business_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.businesses b
  JOIN public.organizations o ON o.business_id = b.id
  WHERE b.owner_id = auth.uid()
    AND o.status = 'ACTIVE'
    AND public.auth_user_is_active()

  UNION

  SELECT o.business_id
  FROM public.organizations o
  JOIN public.organization_members m ON m.organization_id = o.id
  WHERE m.user_id = auth.uid()
    AND m.status = 'ACTIVE'
    AND o.status = 'ACTIVE'
    AND public.auth_user_is_active();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.businesses b
  JOIN public.organizations o ON o.business_id = b.id
  WHERE b.owner_id = auth.uid()
    AND o.status = 'ACTIVE'
    AND public.auth_user_is_active()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.organizations o
  WHERE o.business_id IN (SELECT business_id FROM public.auth_user_business_ids() AS allowed(business_id))
    AND o.status = 'ACTIVE';
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role_for_business(p_business_id UUID)
RETURNS public.organization_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN b.owner_id = auth.uid() AND o.status = 'ACTIVE' AND m.status = 'ACTIVE'
      THEN 'OWNER'::public.organization_role
    WHEN m.status = 'ACTIVE' AND o.status = 'ACTIVE'
      THEN m.role
    ELSE NULL
  END
  FROM public.businesses b
  JOIN public.organizations o ON o.business_id = b.id
  LEFT JOIN public.organization_members m
    ON m.organization_id = o.id AND m.user_id = auth.uid()
  WHERE b.id = p_business_id
    AND public.auth_user_is_active()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_read_business(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_business_id IN (SELECT business_id FROM public.auth_user_business_ids() AS allowed(business_id));
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_write_business(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_can_read_business(p_business_id)
     AND public.auth_user_role_for_business(p_business_id) IN ('OWNER', 'ADMIN', 'MEMBER');
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_administer_business(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_can_read_business(p_business_id)
     AND public.auth_user_role_for_business(p_business_id) IN ('OWNER', 'ADMIN');
$$;

REVOKE ALL ON FUNCTION public.auth_user_is_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_business_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_business_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_organization_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_role_for_business(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_can_read_business(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_can_write_business(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_can_administer_business(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auth_user_is_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_business_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_business_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_organization_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_role_for_business(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_can_read_business(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_can_write_business(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_user_can_administer_business(UUID) TO authenticated, service_role;

-- 9. RLS for new security tables ---------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;
-- Rate-limit buckets are service-role infrastructure; no authenticated policies.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM public.auth_user_organization_ids() AS allowed(organization_id)));

DROP POLICY IF EXISTS organizations_admin_update ON public.organizations;
CREATE POLICY organizations_admin_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_administer_business(business_id))
  WITH CHECK (public.auth_user_can_administer_business(business_id));

DROP POLICY IF EXISTS organization_members_read ON public.organization_members;
CREATE POLICY organization_members_read ON public.organization_members
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.auth_user_organization_ids() AS allowed(organization_id)));

DROP POLICY IF EXISTS organization_members_admin_write ON public.organization_members;
CREATE POLICY organization_members_admin_write ON public.organization_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_can_administer_business(o.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_can_administer_business(o.business_id)
    )
  );

DROP POLICY IF EXISTS organization_invitations_read ON public.organization_invitations;
CREATE POLICY organization_invitations_read ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_can_administer_business(o.business_id)
    )
  );

DROP POLICY IF EXISTS organization_invitations_admin_write ON public.organization_invitations;
CREATE POLICY organization_invitations_admin_write ON public.organization_invitations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_can_administer_business(o.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_can_administer_business(o.business_id)
    )
  );

DROP POLICY IF EXISTS auth_devices_owner_access ON public.auth_devices;
CREATE POLICY auth_devices_owner_access ON public.auth_devices
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.auth_user_is_active())
  WITH CHECK (user_id = auth.uid() AND public.auth_user_is_active());

DROP POLICY IF EXISTS api_keys_admin_read ON public.api_keys;
CREATE POLICY api_keys_admin_read ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_role_for_business(o.business_id) = 'OWNER'
    )
  );

DROP POLICY IF EXISTS api_keys_admin_write ON public.api_keys;
CREATE POLICY api_keys_admin_write ON public.api_keys
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_role_for_business(o.business_id) = 'OWNER'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_role_for_business(o.business_id) = 'OWNER'
    )
  );

DROP POLICY IF EXISTS role_permissions_authenticated_read ON public.role_permissions;
CREATE POLICY role_permissions_authenticated_read ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS auth_security_events_user_read ON public.auth_security_events;
CREATE POLICY auth_security_events_user_read ON public.auth_security_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND public.auth_user_can_administer_business(o.business_id)
    )
  );

DROP POLICY IF EXISTS auth_security_events_user_insert ON public.auth_security_events;
CREATE POLICY auth_security_events_user_insert ON public.auth_security_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.auth_user_is_active());

-- 10. Existing application tables: additive member read/write policies ---------------------------
-- Existing owner policies remain in place for backward compatibility. These policies add
-- organization-member access without granting viewer write access.

DROP POLICY IF EXISTS businesses_owner_policy ON public.businesses;
CREATE POLICY businesses_owner_insert ON public.businesses
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.auth_user_is_active());

DROP POLICY IF EXISTS businesses_owner_delete ON public.businesses;
CREATE POLICY businesses_owner_delete ON public.businesses
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.auth_user_is_active());

DROP POLICY IF EXISTS businesses_member_read ON public.businesses;
CREATE POLICY businesses_member_read ON public.businesses
  FOR SELECT TO authenticated
  USING (id IN (SELECT business_id FROM public.auth_user_business_ids() AS allowed(business_id)));

DROP POLICY IF EXISTS businesses_admin_update ON public.businesses;
CREATE POLICY businesses_admin_update ON public.businesses
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_administer_business(id))
  WITH CHECK (public.auth_user_can_administer_business(id));

DROP POLICY IF EXISTS phone_numbers_member_read ON public.phone_numbers;
CREATE POLICY phone_numbers_member_read ON public.phone_numbers
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS phone_numbers_member_write ON public.phone_numbers;
CREATE POLICY phone_numbers_member_write ON public.phone_numbers
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS campaigns_member_read ON public.campaigns;
CREATE POLICY campaigns_member_read ON public.campaigns
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS campaigns_member_write ON public.campaigns;
CREATE POLICY campaigns_member_write ON public.campaigns
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS contacts_member_read ON public.contacts;
CREATE POLICY contacts_member_read ON public.contacts
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS contacts_member_write ON public.contacts;
CREATE POLICY contacts_member_write ON public.contacts
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS dnc_numbers_member_read ON public.dnc_numbers;
CREATE POLICY dnc_numbers_member_read ON public.dnc_numbers
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS dnc_numbers_member_write ON public.dnc_numbers;
CREATE POLICY dnc_numbers_member_write ON public.dnc_numbers
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS calls_member_read ON public.calls;
CREATE POLICY calls_member_read ON public.calls
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS calls_member_write ON public.calls;
CREATE POLICY calls_member_write ON public.calls
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS callbacks_member_read ON public.callbacks;
CREATE POLICY callbacks_member_read ON public.callbacks
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS callbacks_member_write ON public.callbacks;
CREATE POLICY callbacks_member_write ON public.callbacks
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS usage_events_member_read ON public.usage_events;
CREATE POLICY usage_events_member_read ON public.usage_events
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS subscriptions_member_read ON public.subscriptions;
CREATE POLICY subscriptions_member_read ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

-- Nested operational resources inherit access from their parent business/campaign.
DROP POLICY IF EXISTS campaign_sources_member_read ON public.campaign_sources;
CREATE POLICY campaign_sources_member_read ON public.campaign_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_read_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS campaign_sources_member_write ON public.campaign_sources;
CREATE POLICY campaign_sources_member_write ON public.campaign_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_write_business(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_write_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS campaign_versions_member_read ON public.campaign_versions;
CREATE POLICY campaign_versions_member_read ON public.campaign_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_read_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS campaign_versions_member_write ON public.campaign_versions;
CREATE POLICY campaign_versions_member_write ON public.campaign_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_write_business(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_write_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS campaign_contacts_member_read ON public.campaign_contacts;
CREATE POLICY campaign_contacts_member_read ON public.campaign_contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_read_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS campaign_contacts_member_write ON public.campaign_contacts;
CREATE POLICY campaign_contacts_member_write ON public.campaign_contacts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_write_business(c.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND public.auth_user_can_write_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS call_attempts_member_read ON public.call_attempts;
CREATE POLICY call_attempts_member_read ON public.call_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_contacts cc
      JOIN public.campaigns c ON c.id = cc.campaign_id
      WHERE cc.id = campaign_contact_id
        AND public.auth_user_can_read_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS call_transcripts_member_read ON public.call_transcripts;
CREATE POLICY call_transcripts_member_read ON public.call_transcripts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id AND public.auth_user_can_read_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS call_recordings_member_read ON public.call_recordings;
CREATE POLICY call_recordings_member_read ON public.call_recordings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id AND public.auth_user_can_read_business(c.business_id)
    )
  );

DROP POLICY IF EXISTS call_analysis_member_read ON public.call_analysis;
CREATE POLICY call_analysis_member_read ON public.call_analysis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.id = call_id AND public.auth_user_can_read_business(c.business_id)
    )
  );

-- 11. Storage policies use business membership rather than owner-only checks ---------------------

DROP POLICY IF EXISTS "Authenticated users can upload business logo" ON storage.objects;
CREATE POLICY "Authenticated users can upload business logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'business-logos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT business_id::text FROM public.auth_user_business_ids() AS allowed(business_id)
      WHERE public.auth_user_can_write_business(allowed.business_id)
    )
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND public.auth_user_can_write_business(
        (SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1)
      )
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can update their business logo" ON storage.objects;
CREATE POLICY "Authenticated users can update their business logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'business-logos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT business_id::text FROM public.auth_user_business_ids() AS allowed(business_id)
      WHERE public.auth_user_can_write_business(allowed.business_id)
    )
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND public.auth_user_can_write_business(
        (SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1)
      )
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can read their business logo" ON storage.objects;
CREATE POLICY "Authenticated users can read their business logo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT business_id::text FROM public.auth_user_business_ids() AS allowed(business_id)
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload contact imports" ON storage.objects;
CREATE POLICY "Authenticated users can upload contact imports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contact-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT business_id::text FROM public.auth_user_business_ids() AS allowed(business_id)
      WHERE public.auth_user_can_write_business(allowed.business_id)
    )
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND public.auth_user_can_write_business(
        (SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1)
      )
    )
  )
);

DROP POLICY IF EXISTS "Authenticated users can read contact imports" ON storage.objects;
CREATE POLICY "Authenticated users can read contact imports"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contact-imports'
  AND (storage.foldername(name))[1] IN (
    SELECT business_id::text FROM public.auth_user_business_ids() AS allowed(business_id)
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete contact imports" ON storage.objects;
CREATE POLICY "Authenticated users can delete contact imports"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contact-imports'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT business_id::text FROM public.auth_user_business_ids() AS allowed(business_id)
      WHERE public.auth_user_can_write_business(allowed.business_id)
    )
    OR (
      (storage.foldername(name))[1] = auth.uid()::text
      AND public.auth_user_can_write_business(
        (SELECT id FROM public.businesses WHERE owner_id = auth.uid() LIMIT 1)
      )
    )
  )
);

-- 11a. Tenant-consistency guards for service-role and administrative writes ---------------
CREATE OR REPLACE FUNCTION public.validate_campaign_contact_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_campaign_business UUID;
  v_contact_business UUID;
BEGIN
  SELECT business_id INTO v_campaign_business FROM public.campaigns WHERE id = NEW.campaign_id;
  SELECT business_id INTO v_contact_business FROM public.contacts WHERE id = NEW.contact_id;
  IF v_campaign_business IS NULL OR v_contact_business IS NULL OR v_campaign_business <> v_contact_business THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: campaign and contact must belong to the same business';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_campaign_contact_tenant ON public.campaign_contacts;
CREATE TRIGGER validate_campaign_contact_tenant
  BEFORE INSERT OR UPDATE ON public.campaign_contacts
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_contact_tenant();

CREATE OR REPLACE FUNCTION public.validate_campaign_active_version_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.active_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.campaign_versions
    WHERE id = NEW.active_version_id AND campaign_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: active campaign version must belong to the campaign';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_campaign_active_version_tenant ON public.campaigns;
CREATE TRIGGER validate_campaign_active_version_tenant
  BEFORE INSERT OR UPDATE OF active_version_id ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_campaign_active_version_tenant();

CREATE OR REPLACE FUNCTION public.validate_call_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_business UUID;
  v_campaign_business UUID;
  v_contact_business UUID;
  v_campaign_contact_campaign UUID;
  v_campaign_contact_contact UUID;
BEGIN
  SELECT business_id INTO v_contact_business FROM public.contacts WHERE id = NEW.contact_id;
  IF v_contact_business IS NULL OR v_contact_business <> NEW.business_id THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: call contact must belong to the call business';
  END IF;

  IF NEW.campaign_id IS NOT NULL THEN
    SELECT business_id INTO v_campaign_business FROM public.campaigns WHERE id = NEW.campaign_id;
    IF v_campaign_business IS NULL OR v_campaign_business <> NEW.business_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: call campaign must belong to the call business';
    END IF;
  END IF;

  IF NEW.campaign_contact_id IS NOT NULL THEN
    SELECT campaign_id, contact_id
      INTO v_campaign_contact_campaign, v_campaign_contact_contact
    FROM public.campaign_contacts
    WHERE id = NEW.campaign_contact_id;
    IF v_campaign_contact_campaign IS NULL
       OR v_campaign_contact_contact <> NEW.contact_id
       OR (NEW.campaign_id IS NOT NULL AND v_campaign_contact_campaign <> NEW.campaign_id) THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: call campaign contact is inconsistent';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_call_tenant ON public.calls;
CREATE TRIGGER validate_call_tenant
  BEFORE INSERT OR UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.validate_call_tenant();

CREATE OR REPLACE FUNCTION public.validate_quota_reservation_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_campaign_business UUID;
  v_subscription_business UUID;
BEGIN
  SELECT business_id INTO v_campaign_business FROM public.campaigns WHERE id = NEW.campaign_id;
  IF v_campaign_business IS NULL OR v_campaign_business <> NEW.business_id THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: quota campaign must belong to the reservation business';
  END IF;
  IF NEW.subscription_id IS NOT NULL THEN
    SELECT business_id INTO v_subscription_business FROM public.subscriptions WHERE id = NEW.subscription_id;
    IF v_subscription_business IS NULL OR v_subscription_business <> NEW.business_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: quota subscription must belong to the reservation business';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_quota_reservation_tenant ON public.quota_reservations;
CREATE TRIGGER validate_quota_reservation_tenant
  BEFORE INSERT OR UPDATE ON public.quota_reservations
  FOR EACH ROW EXECUTE FUNCTION public.validate_quota_reservation_tenant();

-- 12. Make existing SECURITY DEFINER business RPCs membership-aware ------------------------------

CREATE OR REPLACE FUNCTION public.get_business_usage_aggregates(
    p_business_id UUID,
    p_from_date TIMESTAMPTZ DEFAULT NULL,
    p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    event_type TEXT,
    total_quantity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    IF auth.role() <> 'service_role'
       AND (auth.uid() IS NULL OR NOT public.auth_user_can_read_business(p_business_id)) THEN
        RAISE EXCEPTION 'Access denied: You are not a member of this business.';
    END IF;

    RETURN QUERY
    SELECT ue.event_type, COALESCE(SUM(ue.quantity), 0)
    FROM public.usage_events ue
    WHERE ue.business_id = p_business_id
      AND (p_from_date IS NULL OR ue.created_at >= p_from_date)
      AND (p_to_date IS NULL OR ue.created_at <= p_to_date)
    GROUP BY ue.event_type;
END;
$func$;

CREATE OR REPLACE FUNCTION public.acquire_campaign_launch_and_quota(
    p_business_id UUID,
    p_campaign_id UUID,
    p_estimated_calls INT,
    p_estimated_minutes INT
) RETURNS JSONB AS $$
DECLARE
    v_running_count INT;
    v_sub RECORD;
    v_voice_minutes_limit INT;
    v_outbound_calls_limit INT;
    v_used_minutes NUMERIC;
    v_reserved_minutes NUMERIC;
    v_max_minutes INT;
    v_total_commitment NUMERIC;
    v_reservation_id UUID;
BEGIN
    IF auth.role() <> 'service_role'
       AND (auth.uid() IS NULL OR NOT public.auth_user_can_write_business(p_business_id)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ACCESS_DENIED',
            'message', 'You do not have permission to launch campaigns for this business.'
        );
    END IF;

    -- Lock the tenant's campaign rows before counting. PostgreSQL does not
    -- allow FOR UPDATE on an aggregate query.
    PERFORM 1
    FROM public.campaigns
    WHERE business_id = p_business_id
      AND status = 'RUNNING'
      AND deleted_at IS NULL
    FOR UPDATE;

    SELECT count(*) INTO v_running_count
    FROM public.campaigns
    WHERE business_id = p_business_id
      AND status = 'RUNNING'
      AND deleted_at IS NULL;

    IF v_running_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'CAMPAIGN_CONCURRENCY_LIMIT_EXCEEDED',
            'message', 'Another campaign is currently RUNNING. Only 1 campaign may run per business concurrently.'
        );
    END IF;

    SELECT s.*
    INTO v_sub
    FROM public.subscriptions s
    WHERE s.business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SUBSCRIPTION_NOT_FOUND',
            'message', 'No subscription found for this business.'
        );
    END IF;

    IF v_sub.status NOT IN ('TRIAL', 'ACTIVE', 'PAST_DUE') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SUBSCRIPTION_INACTIVE',
            'message', 'Subscription status (' || v_sub.status || ') does not permit launching campaigns.'
        );
    END IF;

    IF v_sub.plan_version_id IS NOT NULL THEN
        SELECT pv.voice_minutes_limit, pv.outbound_calls_limit
        INTO v_voice_minutes_limit, v_outbound_calls_limit
        FROM public.plan_versions pv
        WHERE pv.id = v_sub.plan_version_id;
    END IF;

    v_max_minutes := COALESCE(v_voice_minutes_limit, (v_sub.limits->>'voice_minutes')::int, 500);

    SELECT COALESCE(SUM(quantity), 0) INTO v_used_minutes
    FROM public.usage_events
    WHERE business_id = p_business_id
      AND event_type = 'voice_minutes'
      AND created_at >= v_sub.current_period_start
      AND created_at <= v_sub.current_period_end;

    SELECT COALESCE(SUM(reserved_minutes), 0) INTO v_reserved_minutes
    FROM public.quota_reservations
    WHERE business_id = p_business_id
      AND status = 'ACTIVE'
      AND expires_at > now();

    v_total_commitment := v_used_minutes + v_reserved_minutes + p_estimated_minutes;

    IF v_max_minutes > 0 AND v_total_commitment > v_max_minutes THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'QUOTA_EXHAUSTED',
            'message', 'Insufficient remaining voice minutes.',
            'remaining_minutes', GREATEST(0, v_max_minutes - (v_used_minutes + v_reserved_minutes)),
            'requested_minutes', p_estimated_minutes
        );
    END IF;

    INSERT INTO public.quota_reservations (
        business_id, campaign_id, subscription_id,
        reserved_calls, reserved_minutes, status, expires_at
    ) VALUES (
        p_business_id, p_campaign_id, v_sub.id,
        p_estimated_calls, p_estimated_minutes, 'ACTIVE', now() + interval '4 hours'
    ) RETURNING id INTO v_reservation_id;

    UPDATE public.campaigns
    SET status = 'RUNNING', started_at = now(), updated_at = now()
    WHERE id = p_campaign_id AND business_id = p_business_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'allocated_minutes', p_estimated_minutes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.release_quota_reservation(
    p_reservation_id UUID,
    p_business_id UUID,
    p_commit BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
    v_new_status TEXT;
BEGIN
    IF auth.role() <> 'service_role'
       AND (auth.uid() IS NULL OR NOT public.auth_user_can_write_business(p_business_id)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ACCESS_DENIED',
            'message', 'You do not have permission to manage this quota reservation.'
        );
    END IF;

    v_new_status := CASE WHEN p_commit THEN 'COMMITTED' ELSE 'RELEASED' END;

    UPDATE public.quota_reservations
    SET status = v_new_status, updated_at = now()
    WHERE id = p_reservation_id
      AND business_id = p_business_id
      AND status = 'ACTIVE';

    RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Replace legacy owner-only/broad policies so suspended accounts cannot retain
-- privileged billing or audit writes.
DROP POLICY IF EXISTS subscriptions_business_policy ON public.subscriptions;
CREATE POLICY subscriptions_active_member_read ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

CREATE POLICY subscriptions_owner_insert ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_role_for_business(business_id) = 'OWNER');

DROP POLICY IF EXISTS usage_events_business_policy ON public.usage_events;
CREATE POLICY usage_events_active_member_read ON public.usage_events
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS audit_logs_business_policy ON public.audit_logs;
CREATE POLICY audit_logs_active_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.auth_user_can_administer_business(business_id));

CREATE POLICY audit_logs_active_member_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_can_read_business(business_id)
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

DROP POLICY IF EXISTS subscription_history_business_policy ON public.subscription_history;
CREATE POLICY subscription_history_active_member_read ON public.subscription_history
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS quota_reservations_business_policy ON public.quota_reservations;
CREATE POLICY quota_reservations_active_member_read ON public.quota_reservations
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS payment_records_business_policy ON public.payment_records;
CREATE POLICY payment_records_active_member_read ON public.payment_records
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS refund_records_business_policy ON public.refund_records;
CREATE POLICY refund_records_active_member_read ON public.refund_records
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS invoices_business_policy ON public.invoices;
CREATE POLICY invoices_active_member_read ON public.invoices
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS billing_audit_logs_business_policy ON public.billing_audit_logs;
CREATE POLICY billing_audit_logs_active_admin_read ON public.billing_audit_logs
  FOR SELECT TO authenticated
  USING (public.auth_user_can_administer_business(business_id));

-- Additional tenant-aware policies for operational and billing projections.
DROP POLICY IF EXISTS "Users can manage imports for their business" ON public.contact_imports;

DROP POLICY IF EXISTS contact_imports_member_read ON public.contact_imports;
CREATE POLICY contact_imports_member_read ON public.contact_imports
  FOR SELECT TO authenticated
  USING (public.auth_user_can_read_business(business_id));

DROP POLICY IF EXISTS contact_imports_member_write ON public.contact_imports;
CREATE POLICY contact_imports_member_write ON public.contact_imports
  FOR ALL TO authenticated
  USING (public.auth_user_can_write_business(business_id))
  WITH CHECK (public.auth_user_can_write_business(business_id));

DROP POLICY IF EXISTS profiles_organization_member_read ON public.profiles;
CREATE POLICY profiles_organization_member_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members viewer_member
      JOIN public.organization_members subject_member
        ON subject_member.organization_id = viewer_member.organization_id
      WHERE viewer_member.user_id = auth.uid()
        AND viewer_member.status = 'ACTIVE'
        AND subject_member.user_id = profiles.id
        AND subject_member.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS profiles_owner_policy ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND account_status = 'ACTIVE'
  );

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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
    RAISE EXCEPTION 'Profile security fields are managed by the server.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_security_fields ON public.profiles;
CREATE TRIGGER protect_profile_security_fields
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- Maintain timestamps for the additive security tables.
CREATE OR REPLACE FUNCTION public.touch_auth_security_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_organizations_updated_at ON public.organizations;
CREATE TRIGGER touch_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_auth_security_updated_at();

DROP TRIGGER IF EXISTS touch_organization_members_updated_at ON public.organization_members;
CREATE TRIGGER touch_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_auth_security_updated_at();

DROP TRIGGER IF EXISTS touch_organization_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER touch_organization_invitations_updated_at
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_auth_security_updated_at();

DROP TRIGGER IF EXISTS touch_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER touch_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_auth_security_updated_at();

-- Atomically accept an invitation after the authenticated user's email has
-- been checked against the invitation record.
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(
  p_token_hash TEXT,
  p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_invitation public.organization_invitations%ROWTYPE;
  v_user_email TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ACCESS_DENIED');
  END IF;

  SELECT email INTO v_user_email
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT * INTO v_invitation
  FROM public.organization_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_invitation.status <> 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_INVALID');
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.organization_invitations
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_EXPIRED');
  END IF;

  IF v_user_email IS NULL OR LOWER(v_user_email) <> LOWER(v_invitation.email) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_EMAIL_MISMATCH');
  END IF;

  INSERT INTO public.organization_members (
    organization_id, user_id, role, status, joined_at
  ) VALUES (
    v_invitation.organization_id, p_user_id, v_invitation.role, 'ACTIVE', NOW()
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'ACTIVE',
        joined_at = EXCLUDED.joined_at,
        updated_at = NOW();

  UPDATE public.organization_invitations
  SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_invitation.organization_id,
    'role', v_invitation.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Do not expose API-key hashes or invitation tokens to authenticated clients.
REVOKE ALL ON TABLE public.api_keys FROM anon, authenticated;
GRANT SELECT (
  id, organization_id, name, key_prefix, scopes, status, created_by,
  last_used_at, expires_at, revoked_at, created_at, updated_at
) ON public.api_keys TO authenticated;
GRANT UPDATE (status, revoked_at, updated_at) ON public.api_keys TO authenticated;

REVOKE ALL ON TABLE public.organization_invitations FROM anon, authenticated;
GRANT SELECT (id, organization_id, email, role, status, invited_by, expires_at, accepted_at, created_at, updated_at)
  ON public.organization_invitations TO authenticated;

-- Explicit client grants for the additive tables; RLS remains the authorization boundary.
REVOKE DELETE ON public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.auth_devices TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT ON public.auth_security_events TO authenticated;

-- 13. Restrict privileged function execution and rate-limit storage ---------------------
REVOKE ALL ON FUNCTION public.get_business_usage_aggregates(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acquire_campaign_launch_and_quota(UUID, UUID, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_quota_reservation(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_organization_invitation(TEXT, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_business_usage_aggregates(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acquire_campaign_launch_and_quota(UUID, UUID, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_quota_reservation(UUID, UUID, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, NUMERIC, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON TABLE public.rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO service_role;
