import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/auth/demo-mode";

interface DemoCredentials {
  email: string;
  password: string;
}

function getDemoCredentials(): DemoCredentials {
  const email = process.env.AUTH_DEMO_EMAIL?.trim();
  const password = process.env.AUTH_DEMO_PASSWORD;

  if (!isDemoMode() || !email || !password) {
    throw new Error("Local demo mode is not configured.");
  }

  return { email, password };
}

export async function prepareDemoEnvironment(): Promise<{ email: string }> {
  const { email, password } = getDemoCredentials();
  const admin = createAdminClient();

  const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  let user = listedUsers.users.find((candidate) => candidate.email === email);

  if (user) {
    const { data: updated, error: updateError } =
      await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
    if (updateError) throw updateError;
    user = updated.user ?? user;
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Local Demo User" },
    });
    if (createError) throw createError;
    user = created.user;
  }

  if (!user) throw new Error("Unable to create the local demo user.");

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: "Local Demo User",
      account_status: "ACTIVE",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  const { data: existingBusiness } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  let businessId = existingBusiness?.id;
  if (!businessId) {
    const { data: createdBusiness, error: businessError } = await admin
      .from("businesses")
      .insert({
        owner_id: user.id,
        business_name: "Local Demo Business",
        business_type: "Demo",
        description: "Local development workspace",
        country: "India",
        timezone: "Asia/Kolkata",
      })
      .select("id")
      .single();
    if (businessError) throw businessError;
    businessId = createdBusiness.id;
  }

  const { error: subscriptionError } = await admin.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan_name: "STARTER",
      status: "TRIAL",
      billing_period: "MONTHLY",
      limits: { max_contacts: 5000, voice_minutes: 500 },
    },
    { onConflict: "business_id" }
  );
  if (subscriptionError) throw subscriptionError;

  return { email };
}

export async function signInDemoUser(): Promise<void> {
  const { email, password } = getDemoCredentials();
  await prepareDemoEnvironment();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}
