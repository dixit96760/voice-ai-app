-- ==============================================================================
-- Development Seed Data: ABC Properties (Hyderabad, India)
-- ALL RECORDS MARKED EXPLICITLY AS DEMO DATA
-- ==============================================================================

DO $$
DECLARE
    demo_user_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    demo_biz_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    demo_phone_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    demo_camp_id UUID := '33333333-3333-3333-3333-333333333333'::uuid;
    demo_version_id UUID := '44444444-4444-4444-4444-444444444444'::uuid;
    contact1_id UUID := '55555555-5555-5555-5555-555555555501'::uuid;
    contact2_id UUID := '55555555-5555-5555-5555-555555555502'::uuid;
    contact3_id UUID := '55555555-5555-5555-5555-555555555503'::uuid;
    cc1_id UUID := '66666666-6666-6666-6666-666666666601'::uuid;
    cc2_id UUID := '66666666-6666-6666-6666-666666666602'::uuid;
    cc3_id UUID := '66666666-6666-6666-6666-666666666603'::uuid;
    call1_id UUID := '77777777-7777-7777-7777-777777777701'::uuid;
    call2_id UUID := '77777777-7777-7777-7777-777777777702'::uuid;
BEGIN

    -- 1. Demo User Profile
    INSERT INTO profiles (id, email, full_name, phone, created_at, updated_at)
    VALUES (
        demo_user_id,
        'demo.owner@abcproperties.in',
        'Ramesh Sharma (Demo)',
        '+919849012000',
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

    -- 2. Demo Business: ABC Properties
    INSERT INTO businesses (
        id, owner_id, business_name, business_type, description, 
        website, business_email, business_phone, address, city, state, country, timezone
    ) VALUES (
        demo_biz_id,
        demo_user_id,
        'ABC Properties (Demo)',
        'Real Estate Developer',
        'Premium residential builder with high-end luxury high-rise developments across Hyderabad Financial District.',
        'https://abcproperties.demo.in',
        'sales@abcproperties.demo.in',
        '+919849012345',
        'Plot 42, Financial District, Nanakramguda',
        'Hyderabad',
        'Telangana',
        'India',
        'Asia/Kolkata'
    ) ON CONFLICT (id) DO NOTHING;

    -- 3. Dedicated Telephony Phone Number (Sarvam abstraction)
    INSERT INTO phone_numbers (
        id, business_id, phone_number, provider, provider_connection_id, provider_metadata, status, is_default
    ) VALUES (
        demo_phone_id,
        demo_biz_id,
        '+914040001234',
        'sarvam',
        'sarvam_did_hyderabad_001',
        '{"caller_id_name": "ABC Properties Hyderabad", "sip_trunk": "sarvam_in_mum_01"}'::jsonb,
        'ACTIVE',
        true
    ) ON CONFLICT (id) DO NOTHING;

    -- 4. Demo Campaign: Gachibowli 3BHK Project
    INSERT INTO campaigns (
        id, business_id, name, description, offering_type, status,
        calling_start_time, calling_end_time, calling_days, timezone,
        max_attempts, retry_interval_minutes, max_call_duration_seconds, auto_complete
    ) VALUES (
        demo_camp_id,
        demo_biz_id,
        'Gachibowli 3BHK Project',
        'Outbound AI voice calling for pre-qualified buyers interested in premium 3BHK gated apartments near Gachibowli junction.',
        'Real Estate Residential',
        'RUNNING',
        '10:00:00',
        '18:30:00',
        '{1,2,3,4,5,6}',
        'Asia/Kolkata',
        3,
        60,
        300,
        true
    ) ON CONFLICT (id) DO NOTHING;

    -- 5. Campaign Version 1
    INSERT INTO campaign_versions (
        id, campaign_id, version_number, system_instructions,
        knowledge_snapshot, configuration, status, published_at
    ) VALUES (
        demo_version_id,
        demo_camp_id,
        1,
        'You are Priya, a courteous and professional sales assistant from ABC Properties calling regarding the newly launched Gachibowli 3BHK luxury apartments. Keep conversations concise, warm, and focused. Offer site visits, clarify pricing (starting from 1.35 Crores), and record callback requests accurately. Never invent non-approved discounts.',
        '{"pricing_starts": "1.35 Cr", "amenities": ["Infinity pool", "Clubhouse", "Tennis court"], "possession": "December 2026"}'::jsonb,
        '{"language": "en-IN", "allow_code_switching_telugu": true, "tone": "professional_warm"}'::jsonb,
        'ACTIVE',
        now()
    ) ON CONFLICT (id) DO NOTHING;

    -- Update campaign active_version_id
    UPDATE campaigns SET active_version_id = demo_version_id WHERE id = demo_camp_id;

    -- 6. Demo Contacts
    INSERT INTO contacts (
        id, business_id, name, phone, email, city, status, tags, custom_fields, is_dnc, is_wrong_number
    ) VALUES
    (
        contact1_id,
        demo_biz_id,
        'Sanjay Reddy (Demo Contact)',
        '+919849012345',
        'sanjay.reddy@demo.example.com',
        'Hyderabad',
        'ACTIVE',
        '{"warm_lead", "high_budget"}',
        '{"budget": "1.5 Cr", "preferred_floor": "Higher floors"}'::jsonb,
        false,
        false
    ),
    (
        contact2_id,
        demo_biz_id,
        'Pooja Verma (Demo Contact)',
        '+919988765432',
        'pooja.verma@demo.example.com',
        'Secunderabad',
        'ACTIVE',
        '{"callback_requested"}',
        '{"budget": "1.3 Cr", "unit_type": "3BHK West Facing"}'::jsonb,
        false,
        false
    ),
    (
        contact3_id,
        demo_biz_id,
        'Amit Patel (Demo Contact)',
        '+919123456789',
        'amit.patel@demo.example.com',
        'Hyderabad',
        'DNC',
        '{"dnc"}',
        '{}'::jsonb,
        true,
        false
    ) ON CONFLICT (id) DO NOTHING;

    -- 7. Campaign Contacts
    INSERT INTO campaign_contacts (
        id, campaign_id, contact_id, status, attempt_count, last_call_at
    ) VALUES
    (cc1_id, demo_camp_id, contact1_id, 'COMPLETED', 1, now() - INTERVAL '1 hour'),
    (cc2_id, demo_camp_id, contact2_id, 'CALLBACK', 1, now() - INTERVAL '2 hours'),
    (cc3_id, demo_camp_id, contact3_id, 'DO_NOT_CALL', 1, now() - INTERVAL '3 hours')
    ON CONFLICT (id) DO NOTHING;

    -- 8. Business-wide DNC entry for Amit Patel
    INSERT INTO dnc_numbers (business_id, phone_number, reason)
    VALUES (demo_biz_id, '+919123456789', 'customer_requested')
    ON CONFLICT (business_id, phone_number) DO NOTHING;

    -- 9. Call records
    INSERT INTO calls (
        id, business_id, campaign_id, campaign_contact_id, contact_id, direction,
        provider, provider_call_id, status, started_at, answered_at, ended_at,
        duration_seconds, outcome, interest_level, short_summary
    ) VALUES
    (
        call1_id,
        demo_biz_id,
        demo_camp_id,
        cc1_id,
        contact1_id,
        'OUTBOUND',
        'sarvam',
        'sarvam_call_live_001',
        'COMPLETED',
        now() - INTERVAL '60 minutes',
        now() - INTERVAL '59 minutes',
        now() - INTERVAL '56 minutes',
        184,
        'INTERESTED',
        'HIGH',
        'Customer Sanjay Reddy expressed strong interest in 3BHK East-facing units. Scheduled site visit for Saturday 11 AM.'
    ),
    (
        call2_id,
        demo_biz_id,
        demo_camp_id,
        cc2_id,
        contact2_id,
        'OUTBOUND',
        'sarvam',
        'sarvam_call_live_002',
        'COMPLETED',
        now() - INTERVAL '120 minutes',
        now() - INTERVAL '119 minutes',
        now() - INTERVAL '118 minutes',
        78,
        'CALLBACK',
        'MEDIUM',
        'Customer was driving and requested a callback tomorrow at 4:00 PM IST.'
    ) ON CONFLICT (id) DO NOTHING;

    -- 10. Call Transcripts
    INSERT INTO call_transcripts (call_id, transcript_text, language)
    VALUES (
        call1_id,
        'AI: Hello Sanjay garu, I am Priya from ABC Properties regarding the new Gachibowli 3BHK project.\nCustomer: Yes Priya, tell me about the sizes and pricing.\nAI: Our 3BHK units range from 1,850 to 2,200 sq.ft, starting at 1.35 Crores. We have an infinity pool and clubhouse.\nCustomer: That fits my budget. Can I visit this Saturday?\nAI: Absolutely, I will schedule a VIP site visit for Saturday at 11 AM. Thank you!',
        'en-IN'
    ) ON CONFLICT (call_id) DO NOTHING;

    -- 11. Call Analysis
    INSERT INTO call_analysis (
        call_id, short_summary, customer_intent, interest_level, questions_asked,
        requirements, objections, important_information, requested_follow_up,
        recommended_next_action, outcome
    ) VALUES (
        call1_id,
        'Customer Sanjay Reddy is interested in 3BHK units and confirmed Saturday site visit.',
        'Purchase consideration for family residence',
        'HIGH',
        ARRAY['What are the sq.ft sizes?', 'What is the starting price?'],
        ARRAY['1850-2200 sq.ft', 'Saturday 11 AM visit'],
        ARRAY[]::text[],
        ARRAY['Budget is around 1.5 Cr'],
        'Site visit scheduled for Saturday 11:00 AM IST',
        'Assign relationship manager to meet at site sales lounge',
        'INTERESTED'
    ) ON CONFLICT (call_id) DO NOTHING;

    -- 12. Callbacks
    INSERT INTO callbacks (
        business_id, campaign_id, contact_id, call_id,
        requested_at, scheduled_for, timezone, status, notes
    ) VALUES (
        demo_biz_id,
        demo_camp_id,
        contact2_id,
        call2_id,
        now() - INTERVAL '120 minutes',
        (now() + INTERVAL '1 day')::date + TIME '16:00:00',
        'Asia/Kolkata',
        'SCHEDULED',
        'Customer requested callback around 4 PM as they were in traffic during the initial call.'
    ) ON CONFLICT DO NOTHING;

    -- 13. Subscription Starter
    INSERT INTO subscriptions (
        business_id, plan_name, status, limits
    ) VALUES (
        demo_biz_id,
        'GROWTH_TIER',
        'ACTIVE',
        '{"max_contacts": 10000, "voice_minutes": 1500, "concurrent_calls": 5}'::jsonb
    ) ON CONFLICT (business_id) DO NOTHING;

END $$;
