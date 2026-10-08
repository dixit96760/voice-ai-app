# Deploying to Vercel

Follow these steps in order. Steps marked **(you)** need your own accounts or
passwords; everything else can be done for you in the project.

## 1. Update the database (you)

The latest code needs migration
`supabase/migrations/20261008000001_webhook_idempotency_and_calling_hours.sql`.
Without it, every Sarvam call result will fail to save.

Easiest way: open your Supabase project → **SQL Editor** → **New query**, paste
the whole contents of that file, and click **Run**. It should finish with
"Success. No rows returned".

## 2. Put the code on GitHub (you)

Vercel deploys from a GitHub repository and redeploys automatically on every push.

1. Sign in at <https://github.com> and click **New repository**.
2. Name it (for example `voice-ai-app`), choose **Private**, and do **not** add a
   README, .gitignore or license. Click **Create repository**.
3. In the project terminal, run the two commands GitHub shows under
   "push an existing repository", which look like:

   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/voice-ai-app.git
   ```

   ```bash
   git push -u origin main
   ```

`.env.local` is in `.gitignore`, so your secret keys are **not** uploaded.

## 3. Create the Vercel project (you)

1. Sign in at <https://vercel.com> with your GitHub account.
2. Click **Add New → Project**, pick your repository, and click **Import**.
3. Leave the framework as **Next.js** and the build settings as they are.
4. Before clicking Deploy, open **Environment Variables** and add the values
   from step 4.

## 4. Environment variables

Copy each value from your `.env.local` unless the table says otherwise.

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env.local` (secret) |
| `AUTH_API_KEY_PEPPER` | a new random value, see below (secret) |
| `SARVAM_VOICE_AGENTS_API_KEY` | from `.env.local` (secret) |
| `SARVAM_API_KEY` | from `.env.local` (secret) |
| `SARVAM_BASE_URL` | from `.env.local` |
| `SARVAM_ORG_ID` | from `.env.local` |
| `SARVAM_WORKSPACE_ID` | from `.env.local` |
| `SARVAM_AGENT_APP_ID` | from `.env.local` |
| `SARVAM_AGENT_APP_VERSION` | from `.env.local` |
| `SARVAM_CONNECTION_ID` | from `.env.local` |
| `SARVAM_DIALER_PHONE_NUMBERS` | `+917971413948` |
| `SARVAM_ATTEMPTS_PER_SECOND` | from `.env.local` |
| `SARVAM_CAMPAIGN_TTL_DAYS` | from `.env.local` |
| `SARVAM_COHORT_VARIABLES` | from `.env.local` |
| `SARVAM_WEBHOOK_TOKEN` | from `.env.local` (secret) |
| `SARVAM_MOCK_MODE` | `false` |

Do **not** add these:

- `AUTH_DEMO_MODE`, `AUTH_DEMO_EMAIL`, `AUTH_DEMO_PASSWORD`: demo sign-in is
  for your computer only.
- `NEXT_PUBLIC_APP_URL`: leave it out for the first deploy. The app then uses
  the Vercel address automatically. Add it later if you connect your own domain
  (for example `https://yourdomain.com`), then redeploy.
- Razorpay variables: billing stays switched off until you set up Razorpay.

To create `AUTH_API_KEY_PEPPER`, run this in the terminal and paste the output
into Vercel:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then click **Deploy**. When it finishes, Vercel shows your address, for example
`https://voice-ai-app.vercel.app`.

## 5. Tell Supabase about the new address (you)

Otherwise sign-up confirmation and password-reset emails link back to
`localhost`.

In Supabase → **Authentication** → **URL Configuration**:

- **Site URL**: your Vercel address, for example `https://voice-ai-app.vercel.app`
- **Redirect URLs**: add `https://voice-ai-app.vercel.app/**`

Keep `http://localhost:3000/**` in the list so local development still works.

## 6. Check it works

1. Open your Vercel address and sign up or log in with a real account.
2. Go to **Settings → Integrations** and click the Sarvam check. It should
   report the connection as reachable.
3. Create a campaign with one contact (your own mobile number), mark it ready,
   and launch it inside the 09:00-21:00 IST window.
4. After the call ends, the call should appear under **Calls** with its
   transcript within a minute or two. If it does not, check Vercel → your
   project → **Logs** for `/api/webhooks/sarvam/campaign`.
