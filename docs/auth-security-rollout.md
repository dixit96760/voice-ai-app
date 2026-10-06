# Authentication and authorization rollout

This application uses Supabase Auth as the credential/session authority. Password hashes, refresh sessions, OAuth identities, email/phone verification, recovery tokens, and MFA factors remain in Supabase's `auth` schema. The public migration adds application-level organizations, memberships, roles, account state, invitations, device metadata, API keys, and audit events without copying credentials into public tables.

## Required environment

Set these values in the deployment environment (do not commit them):

```text
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AUTH_API_KEY_PEPPER=<long-random-secret-at-least-32-characters>
SARVAM_WEBHOOK_SECRET=<provider-webhook-secret>
RAZORPAY_WEBHOOK_SECRET=<provider-webhook-secret>
```

`SARVAM_MOCK_MODE` and `RAZORPAY_MOCK_MODE` must be `false` in production. Never use placeholder or mock secrets in a deployed environment.

## Database rollout

1. Take a database backup/snapshot and run the preflight checks for existing business rows and duplicate invitations.
2. Link the CLI to the intended project: `npx supabase link --project-ref <project-ref>`.
3. Review the pending migration, then apply it with `npx supabase db push`.
4. Regenerate `lib/supabase/types.ts` from the linked project.
5. Configure the Supabase Auth Site URL and exact redirect allowlist for:
   - `/auth/callback`
   - `/auth/verify`
   - `/update-password`
6. Configure the Google provider and email/SMS/MFA settings in Supabase Auth if those existing flows are enabled.
7. Run the unit suite, then test the RLS matrix with two real test users before enabling membership access.

The new migration is additive and backfills one organization and an OWNER membership for every existing business. Existing `businesses.owner_id` data is retained for compatibility.

## Security behavior

- API routes return JSON `401`/`403` responses instead of redirecting browsers.
- User/session authorization is repeated in server actions; middleware is not the only boundary.
- Viewer/member/admin/owner permissions are enforced in application helpers and RLS.
- Billing, usage, quota, webhook, and audit writes are service-role-only unless explicitly needed for onboarding.
- Password recovery uses a short-lived HttpOnly recovery marker and cannot browse the dashboard before password update.
- Password changes require the current password outside recovery and revoke existing sessions afterward.
- API keys are shown once, stored only as HMAC hashes, scoped, expiring/revocable, and never returned in list responses.
- Sarvam and Razorpay webhooks verify raw-body signatures before parsing or using a service-role client.
- Auth events are recorded without storing passwords, access tokens, refresh tokens, or OAuth secrets.

## Verification

Run:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

For database validation, use a local Supabase instance or a linked staging project. At minimum test anonymous, owner, member, viewer, suspended member, cross-tenant user, and service-role principals against every business-scoped table and privileged RPC.
