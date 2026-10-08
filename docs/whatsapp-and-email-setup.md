# WhatsApp details and Gmail email setup

These two steps need your own accounts and passwords, so they are done by you.
Never paste the tokens or passwords into chat.

## 1. WhatsApp: send business details when a customer asks

When a customer asks for details during a call, the voice agent calls the app,
and the app sends them a WhatsApp message with your business and offer details.
Until WhatsApp is configured, the request is still recorded and the agent tells
the customer your team will follow up.

### a. Create the WhatsApp app (Meta)

1. Go to <https://developers.facebook.com/apps>, click **Create app**, choose
   **Other → Business**, and add the **WhatsApp** product.
2. In **WhatsApp → API Setup** you get a free **test number**. Note its
   **Phone number ID**. To send from your own number, click **Add phone number**
   (that number must not be in use on the regular WhatsApp app).
3. The test number can only message up to 5 numbers you add under **To**. Add
   your own mobile there for testing. Complete **Business verification** in Meta
   Business Settings to message anyone.

### b. Create a permanent access token

1. Open <https://business.facebook.com/settings> → **Users → System users** →
   **Add** (role: Admin).
2. **Assign assets** → your app → full control.
3. **Generate new token** → choose your app → tick
   `whatsapp_business_messaging` and `whatsapp_business_management` →
   expiry **Never**. Copy the token.

### c. Create the message template

In **WhatsApp Manager → Message templates → Create template**:

- **Category:** Marketing
- **Name:** `business_details`
- **Language:** English (`en`)
- **Body** (exactly four variables, in this order):

  ```
  Hi {{1}}, thank you for speaking with {{2}}. Here are the details you asked for: {{3}} Contact us: {{4}}
  ```

  Sample values for review: `Deekshith`, `Dixit Institutions`,
  `1-month Python course for Rs 199 with 5 projects.`, `Phone: +91 98765 43210`.

Submit it. Approval usually takes from a few minutes to a day.

Add a payment method in WhatsApp Manager; Meta charges per marketing message.

### d. Add the settings to Vercel

Vercel → project **voice-ai-app** → **Settings → Environment Variables**, add
(type **Sensitive**, environments Production and Preview):

| Name | Value |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | the token from step b |
| `WHATSAPP_PHONE_NUMBER_ID` | the Phone number ID from step a |
| `WHATSAPP_TEMPLATE_NAME` | `business_details` (optional, this is the default) |
| `WHATSAPP_TEMPLATE_LANGUAGE` | `en` (optional, this is the default) |

Then **Deployments → ⋯ → Redeploy**.

What the customer receives is built from your business profile (description,
website, phone, email) and the campaign (offering, pitch, approved facts), so
keep those filled in under **Settings → Business**.

## 2. Gmail for sign-up and password-reset emails

1. Turn on **2-Step Verification**: <https://myaccount.google.com/security>.
2. Create an app password: <https://myaccount.google.com/apppasswords>, name it
   `Supabase`, and copy the 16-character password.
3. Supabase → project **sarvam voice agent** → **Authentication → Emails →
   SMTP Settings** → **Enable custom SMTP**:
   - Host: `smtp.gmail.com`
   - Port: `465`
   - Username: your Gmail address
   - Password: the app password
   - Sender email: your Gmail address
   - Sender name: your business name
   - **Save**
4. **Authentication → Rate Limits**: set emails per hour to `30`.
5. **Authentication → URL Configuration → Redirect URLs**: make sure
   `https://voice-ai-app-beryl.vercel.app/**` is listed.
6. **Authentication → Sign In / Providers → Email**: switch **Confirm email**
   back **on**.

Gmail allows about 500 emails a day, which is plenty to start.
