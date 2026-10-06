-- ==============================================================================
-- Migration: 20260917000001_phase5_hardening.sql
-- Description: Hardening operational layer:
--              1. Private contact-imports storage bucket and RLS policies
--              2. Database RPC get_business_usage_aggregates for server-side usage totals
-- ==============================================================================

-- 1. Create private storage bucket for staged contact imports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-imports',
  'contact-imports',
  false,
  10485760, -- 10 MB
  ARRAY['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/json'];

-- Storage Policies for contact-imports
-- Isolated by business ID folder prefix: (storage.foldername(name))[1]
DROP POLICY IF EXISTS "Authenticated users can upload contact imports" ON storage.objects;
CREATE POLICY "Authenticated users can upload contact imports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contact-imports' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can read contact imports" ON storage.objects;
CREATE POLICY "Authenticated users can read contact imports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contact-imports' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can delete contact imports" ON storage.objects;
CREATE POLICY "Authenticated users can delete contact imports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contact-imports' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid()
  )
);

-- 2. Database RPC function for server-side usage event aggregation
CREATE OR REPLACE FUNCTION get_business_usage_aggregates(
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
    -- Verify ownership: authenticated user must own the business
    IF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM businesses 
            WHERE id = p_business_id AND owner_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Access denied: You do not own this business.';
        END IF;
    END IF;

    RETURN QUERY
    SELECT 
        ue.event_type,
        COALESCE(SUM(ue.quantity), 0) AS total_quantity
    FROM usage_events ue
    WHERE ue.business_id = p_business_id
      AND (p_from_date IS NULL OR ue.created_at >= p_from_date)
      AND (p_to_date IS NULL OR ue.created_at <= p_to_date)
    GROUP BY ue.event_type;
END;
$func$;
