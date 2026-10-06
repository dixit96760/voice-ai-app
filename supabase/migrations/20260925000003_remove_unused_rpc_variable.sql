-- Remove the remaining non-functional lint warning from the campaign launch RPC.

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
        SELECT pv.voice_minutes_limit
        INTO v_voice_minutes_limit
        FROM public.plan_versions pv
        WHERE pv.id = v_sub.plan_version_id;
    END IF;

    v_max_minutes := COALESCE(
        v_voice_minutes_limit,
        (v_sub.limits->>'voice_minutes')::int,
        500
    );

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

REVOKE ALL ON FUNCTION public.acquire_campaign_launch_and_quota(UUID, UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acquire_campaign_launch_and_quota(UUID, UUID, INT, INT) TO authenticated, service_role;
