# Sarvam AI (Voice Agents) Integration

How this platform talks to Sarvam for outbound calling, and what you must configure
before a campaign can dial real numbers.

References (current as of integration):
- Voice Agents API (auth + base URLs): https://docs.sarvam.ai/conversations/api/introduction
- Campaigns API: https://docs.sarvam.ai/conversations/api/campaigns/create
- Stream cohort: https://docs.sarvam.ai/conversations/api/campaigns/cohorts/stream
- Campaign lifecycle: https://docs.sarvam.ai/conversations/deploy/campaigns/campaign-lifecycle
- Webhook payload: https://docs.sarvam.ai/conversations/api/campaigns/webhooks/webhook-payload
- Voice Agents console: https://indus.sarvam.ai/samvaad

## 0. Two different Sarvam keys (important)

| Surface | Host | Auth header | Key |
| --- | --- | --- | --- |
| Model APIs (STT, TTS, translation) | `https://api.sarvam.ai` | `api-subscription-key` | `SARVAM_API_KEY` |
| Voice Agents (campaigns, cohorts, deployments) | `https://apps.sarvam.ai` | `X-API-Key` | `SARVAM_VOICE_AGENTS_API_KEY` |

The two keys have different formats and are **not interchangeable**. A Model API key sent
to the scheduling API fails with `401 Invalid API key format`. The client sends both
headers (`X-API-Key` and `api-subscription-key`) using the Voice Agents key, so a single
Voice Agents key works for every Voice Agents service.

Voice Agents base URLs by service: deployments `https://apps.sarvam.ai/api/app-authoring`,
campaigns/cohorts `https://apps.sarvam.ai/api/scheduling`, instant outbound
`https://apps.sarvam.ai/api/outbounds`, analytics/boards `https://apps.sarvam.ai/api`.

## 1. Architecture

```
Campaign launch (lib/telephony/launch-service.ts)
  ├─ validateCampaignReadiness        (readiness gate)
  ├─ quotaService.acquireCampaignLaunchAndQuota
  ├─ buildSarvamAgentConfig           (prompt + output variables, local)
  ├─ SarvamVoiceProvider.createCampaign → POST .../campaigns
  └─ SarvamVoiceProvider.streamCohort  → POST .../campaigns/{id}/cohorts/stream

Call attempt completes
  └─ POST /api/webhooks/sarvam/campaign
       ├─ verifySarvamWebhook          (HMAC or shared token)
       ├─ normalizeCampaignWebhook     (payload → domain entities)
       └─ processCampaignWebhook       (calls, transcripts, DNC, analytics)
```

Provider code lives in `lib/providers/sarvam/`:
| File | Responsibility |
| --- | --- |
| `config.ts` | Env resolution, org/workspace scope, validation, diagnostics snapshot |
| `client.ts` | Server-only HTTP client (timeout, retry, error normalization) + mock mode |
| `campaign.ts` | Domain → Sarvam scheduling API payload mapping, lifecycle actions |
| `cohort.ts` | Contact filtering, cohort batching (max 1,000/request), cohort status |
| `webhooks.ts` | Webhook payload normalization |
| `webhook-auth.ts` | Inbound callback verification |
| `agent.ts` | Local prompt/output-variable generation |
| `recordings.ts` | Recording lookup (best effort) |

## 2. Required configuration

Set these in `.env.local` (local) and in the deployment platform's environment.

| Variable | Required | Where to get it |
| --- | --- | --- |
| `SARVAM_VOICE_AGENTS_API_KEY` | Yes | Voice Agents → Settings → API Key (sent as `X-API-Key`) |
| `SARVAM_BASE_URL` | No | Defaults to `https://apps.sarvam.ai` |
| `SARVAM_ORG_ID` | Yes | Voice Agents dashboard URL or Settings |
| `SARVAM_WORKSPACE_ID` | Yes | Voice Agents dashboard URL or Settings |
| `SARVAM_AGENT_APP_ID` | Yes* | Agent `app_id` of a **committed** agent |
| `SARVAM_AGENT_APP_VERSION` | Yes* | Committed agent version, e.g. `1` |
| `SARVAM_CONNECTION_ID` | Yes* | Phone Numbers → your telephony connection id |
| `SARVAM_DIALER_PHONE_NUMBERS` | No* | E.164 numbers owned by that connection, comma separated |
| `SARVAM_WEBHOOK_TOKEN` | Yes | Any random string; appended to the webhook URL |
| `SARVAM_API_KEY` | No | Model API key, only for STT/TTS/translation calls |

\* Can be overridden per campaign. `campaign_versions.sarvam_agent_id` /
`sarvam_agent_version_id` and `phone_numbers.provider_connection_id` take precedence
over the environment defaults.

Only numbers registered with the Sarvam telephony connection can place calls. When
`SARVAM_DIALER_PHONE_NUMBERS` is set it is used as the dialer pool; otherwise the
business's stored phone number is used, with any other numbers on the same connection
forming the rotation pool.

Optional tuning:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SARVAM_ATTEMPTS_PER_SECOND` | `1` | Dial rate when a campaign does not set one (0.1–500) |
| `SARVAM_CAMPAIGN_TTL_DAYS` | `7` | `end_timestamp` = start + N days (max 30) |
| `SARVAM_COHORT_VARIABLES` | `customer_name` | Comma-separated agent variable names allowed in cohorts |
| `SARVAM_MOCK_MODE` | `false` | `true` = deterministic offline provider, no network calls |
| `SARVAM_WEBHOOK_SECRET` | – | If Sarvam provides a signing secret, HMAC is enforced instead of the token |
| `SARVAM_WEBHOOK_CONFIG_IN_APP_CONFIG` | `false` | Sends `webhook_config` nested in `app_config` instead of top level |

## 3. One-time setup in the Sarvam console

1. **Create and commit an agent** — Voice Agents → Build → Agents. The campaign API
   references an existing agent; it does not create one. Commit a version so it can be
   dialed.
2. **Connect telephony** — Deploy → Phone Numbers. Either bring your own provider
   (Exotel, Twilio, Smartflo, Pulse, Intalk, Vobiz) or rent numbers from Sarvam. Copy the
   `connection_id` and the number in E.164 format.
3. **Set `app_variables`** on the agent to match what you stream per contact. Sarvam
   rejects cohorts containing variables the agent does not declare, so keep
   `SARVAM_COHORT_VARIABLES` and the agent configuration in sync. Values available from
   our contact record: `customer_name`, `contact_name`, `city`, `business_name`,
   `offering_type`.
4. **Set output variables** used by the webhook normalizer: `call_outcome`,
   `interest_level`, `dnc_requested`, `wrong_number`, `callback_requested`,
   `callback_datetime`, `customer_questions`, `objections`, `next_action`, `notes`.

## 4. Verifying the connection

```bash
# configuration snapshot + live call (no Supabase or Next.js needed)
npm run sarvam:check

# validate just the key against the scheduling API (dummy org/workspace)
npm run sarvam:check -- --probe-auth

# from inside the app (requires a signed-in user)
curl http://localhost:3000/api/integrations/sarvam/status
curl "http://localhost:3000/api/integrations/sarvam/status?verify=1"
```

`npm run sarvam:check` reports which variables are missing, then calls
`GET .../campaigns?limit=5`. It never prints the API key. `--probe-auth` tells you
whether the configured key is a Voice Agents key ("Invalid API key format" means it is
not) before you fill in the org/workspace ids.

The in-app endpoints return the same snapshot plus `live.reachable`. `missing` lists
unset variables and `hints` explains each one. `live.reachable: false` means Sarvam
rejected the key or the org/workspace ids. The same information is shown in the UI at
**Settings → Integrations**.

## 5. Webhooks

Campaign callbacks arrive at:

```
{NEXT_PUBLIC_APP_URL}/api/webhooks/sarvam/campaign?token={SARVAM_WEBHOOK_TOKEN}
```

- Sarvam does not document a signature header for campaign callbacks, so the shared
  token is the primary verification mechanism (timing-safe comparison).
- If `SARVAM_WEBHOOK_SECRET` is set, HMAC-SHA256 verification is enforced instead.
- With neither configured, callbacks are rejected (fail closed) except in
  `SARVAM_MOCK_MODE` outside production.
- The campaign is created with `webhook_config.metadata`
  (`platform`, `business_id`, `campaign_id`), which Sarvam echoes on every payload.
- `localhost` is not reachable from Sarvam. Use a public HTTPS URL (tunnel or deployed
  environment) and set `NEXT_PUBLIC_APP_URL` accordingly, otherwise no call results
  will be recorded.

## 6. Launch behaviour

1. Exactly one `RUNNING` campaign per business (enforced server-side).
2. Business must have a verified phone number.
3. Contacts are filtered: DNC, wrong number, inactive, or invalid phone → excluded and
   counted in `excluded_dnc_count`.
4. Campaign created on Sarvam (`sarvam_campaign_id` persisted for reuse).
5. Eligible contacts streamed in batches of 1,000 (`sarvam_cohort_id` persisted).
6. Local status → `RUNNING`, audit log written.

Pause/resume use `PUT .../campaigns/{id}/status` with `{action}`; `cancelCampaign` is
available but terminal. `getCohort` polls cohort processing
(`processing` → `completed` | `failed`) with record counts.

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Sarvam integration is not fully configured. Missing: …` | Set the listed variables; placeholders such as `mock-…` are rejected by design |
| 401 `Invalid API key format` | A Model API key is in `SARVAM_API_KEY`; add the Voice Agents key to `SARVAM_VOICE_AGENTS_API_KEY` |
| 401 `Invalid Bearer token` / `Provide a Bearer token or X-API-Key header` | Same root cause, or the key belongs to a different Sarvam account |
| 404 on the campaigns path | `SARVAM_BASE_URL` must be `https://apps.sarvam.ai` |
| 422 on campaign create | Agent version not committed, wrong `connection_id`, or phone number not owned by that connection |
| Cohort rejected, `Unknown app_variables` | Agent does not declare the streamed variables; align `SARVAM_COHORT_VARIABLES` |
| Campaign created but no results recorded | Webhook URL not publicly reachable, or token mismatch |
| `Database error creating new user` from Sarvam | Sarvam-side agent config issue; check the message in the app logs |
