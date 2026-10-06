-- Bootstrap database extensions before any application table is created.
-- Supabase may install uuid-ossp in the `extensions` schema rather than the
-- migration role's search_path, so expose a public compatibility function when
-- necessary. This migration must remain earlier than 20260916000001.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_extension_schema TEXT;
BEGIN
  SELECT namespace.nspname
  INTO v_extension_schema
  FROM pg_catalog.pg_extension AS extension
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'uuid-ossp';

  IF v_extension_schema IS NOT NULL
     AND v_extension_schema <> 'public'
     AND to_regprocedure('public.uuid_generate_v4()') IS NULL THEN
    EXECUTE format(
      'CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE AS %L',
      format('SELECT %I.uuid_generate_v4()', v_extension_schema)
    );
  END IF;
END $$;
