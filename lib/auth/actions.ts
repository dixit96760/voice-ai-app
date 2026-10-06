"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { signUpSchema, signInSchema, resetPasswordSchema, passwordSchema } from "@/lib/validation/auth";
import { ensureProfile, getCurrentBusiness } from "./session";
import { AUTH_CONFIG_ERROR, getTrustedAppOrigin, isSupabaseAuthConfigured } from "./config";
import { recordAuthSecurityEvent } from "./audit";
import { recordCurrentDevice } from "./devices";
import { revokeSessions } from "./session-revocation";
import { assertRateLimit } from "@/lib/security/rate-limiter";
import { getCurrentProfile, getCurrentUser } from "./session";
import { getSafeRedirectPath } from "./redirect";

async function getAuthRateLimitError(
  scope: "signup" | "login" | "reset",
  email: string
): Promise<string | null> {
  const requestHeaders = headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `auth:${scope}:${email.toLowerCase()}:${ip}`;
  const limits = {
    signup: { capacity: 5, refill: 5 / 3600 },
    login: { capacity: 10, refill: 10 / 60 },
    reset: { capacity: 5, refill: 5 / 3600 },
  } as const;
  const limit = limits[scope];
  const result = await assertRateLimit(key, limit.capacity, limit.refill);

  if (!result.allowed) {
    return `Too many ${scope} attempts. Please try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`;
  }

  return null;
}

export interface AuthActionResult {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  message?: string;
}

function getAuthErrorMessage(message: string): string {
  if (/fetch failed|failed to fetch|network error/i.test(message)) {
    return "Unable to reach the authentication service. Check your connection and try again.";
  }

  return message;
}

export async function signInWithEmail(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };
  const requestedRedirect = getSafeRedirectPath(formData.get("redirectTo"));

  const validation = signInSchema.safeParse(rawData);
  if (!validation.success) {
    const errorMap: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      errorMap[field] = issue.message;
    }
    return {
      error: "Please correct the errors in the form.",
      fieldErrors: errorMap,
    };
  }

  const rateLimitError = await getAuthRateLimitError("login", validation.data.email);
  if (rateLimitError) {
    await recordAuthSecurityEvent({
      eventType: "PASSWORD_LOGIN",
      outcome: "FAILURE",
      metadata: { reason: "RATE_LIMIT" },
    });
    return { error: rateLimitError };
  }

  if (!isSupabaseAuthConfigured()) {
    return { error: AUTH_CONFIG_ERROR };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: validation.data.email,
    password: validation.data.password,
  });

  if (error) {
    await recordAuthSecurityEvent({
      eventType: "PASSWORD_LOGIN",
      outcome: "FAILURE",
      metadata: { reason: "INVALID_CREDENTIALS" },
    });

    // Provide user-friendly message without leaking system details
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Invalid email or password. Please check your credentials and try again." };
    }
    return { error: getAuthErrorMessage(error.message) };
  }

  if (authData.user) {
    if (authData.user.email && authData.user.email_confirmed_at === null) {
      await revokeSessions("local");
      return { error: "Please verify your email address before signing in." };
    }

    await ensureProfile(authData.user);
    await recordCurrentDevice(authData.user.id);
    const profile = await getCurrentProfile();
    if (profile?.account_status && profile.account_status !== "ACTIVE") {
      await recordAuthSecurityEvent({
        userId: authData.user.id,
        eventType: "ACCOUNT_ACCESS_BLOCKED",
        outcome: "FAILURE",
        metadata: { accountStatus: profile.account_status },
      });
      return {
        error:
          profile.account_status === "SUSPENDED"
            ? "This account is suspended. Contact your administrator."
            : "This account has been deactivated.",
      };
    }

    await recordAuthSecurityEvent({
      userId: authData.user.id,
      eventType: "PASSWORD_LOGIN",
      outcome: "SUCCESS",
    });

    const business = await getCurrentBusiness();
    if (!business) {
      redirect("/onboarding");
    }

    if (requestedRedirect && requestedRedirect !== "/onboarding") {
      redirect(requestedRedirect);
    }
  }

  redirect("/dashboard");
}

export async function signUpWithEmail(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    fullName: formData.get("fullName") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const validation = signUpSchema.safeParse(rawData);
  if (!validation.success) {
    const errorMap: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      errorMap[field] = issue.message;
    }
    return {
      error: "Please correct the errors below.",
      fieldErrors: errorMap,
    };
  }

  const rateLimitError = await getAuthRateLimitError("signup", validation.data.email);
  if (rateLimitError) {
    await recordAuthSecurityEvent({
      eventType: "EMAIL_SIGNUP",
      outcome: "FAILURE",
      metadata: { reason: "RATE_LIMIT" },
    });
    return { error: rateLimitError };
  }

  if (!isSupabaseAuthConfigured()) {
    return { error: AUTH_CONFIG_ERROR };
  }

  const origin = getTrustedAppOrigin();
  if (!origin) {
    return { error: AUTH_CONFIG_ERROR };
  }
  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      data: {
        full_name: validation.data.fullName,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    await recordAuthSecurityEvent({
      eventType: "EMAIL_SIGNUP",
      outcome: "FAILURE",
      metadata: { reason: "SIGNUP_ERROR" },
    });

    if (error.message.includes("User already registered")) {
      return {
        success: true,
        message: "If an account can be created for this email, follow the verification instructions.",
      };
    }
    return { error: getAuthErrorMessage(error.message) };
  }

  // If Supabase has email confirmation disabled or user session was immediately established
  if (authData.session && authData.user) {
    if (authData.user.email && authData.user.email_confirmed_at === null) {
      await revokeSessions("local");
      return {
        success: true,
        message: "Account registered! Check your email to verify your address before signing in.",
      };
    }

    await ensureProfile(authData.user);
    await recordCurrentDevice(authData.user.id);
    const profile = await getCurrentProfile();
    if (profile?.account_status && profile.account_status !== "ACTIVE") {
      return {
        error:
          profile.account_status === "SUSPENDED"
            ? "This account is suspended. Contact your administrator."
            : "This account has been deactivated.",
      };
    }

    await recordAuthSecurityEvent({
      userId: authData.user.id,
      eventType: "EMAIL_SIGNUP",
      outcome: "SUCCESS",
      metadata: { sessionEstablished: true },
    });

    const business = await getCurrentBusiness();
    if (!business) {
      redirect("/onboarding");
    }
    redirect("/dashboard");
  }

  return {
    success: true,
    message: "Account registered! If confirmation is enabled, check your email for the verification link.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await recordAuthSecurityEvent({
      userId: user.id,
      eventType: "LOGOUT",
      outcome: "SUCCESS",
      metadata: { scope: "global" },
    });
  }

  await revokeSessions("global");
  redirect("/login");
}

export async function resetPassword(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email") as string,
  };

  const validation = resetPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: validation.error.issues[0]?.message || "Invalid email address." };
  }

  const rateLimitError = await getAuthRateLimitError("reset", validation.data.email);
  if (rateLimitError) {
    return { error: rateLimitError };
  }

  if (!isSupabaseAuthConfigured()) {
    return { error: AUTH_CONFIG_ERROR };
  }

  const origin = getTrustedAppOrigin();
  if (!origin) {
    return { error: AUTH_CONFIG_ERROR };
  }
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
    redirectTo: `${origin}/auth/callback?next=/update-password&type=recovery`,
  });

  if (error) {
    await recordAuthSecurityEvent({
      eventType: "PASSWORD_RESET_REQUEST",
      outcome: "FAILURE",
      metadata: { reason: "SEND_ERROR" },
    });
    return { error: getAuthErrorMessage(error.message) };
  }

  await recordAuthSecurityEvent({
    eventType: "PASSWORD_RESET_REQUEST",
    outcome: "SUCCESS",
  });

  return {
    success: true,
    message: "Password reset instructions have been sent to your email.",
  };
}

export async function updatePassword(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const currentPassword = formData.get("currentPassword") as string;
  const isRecoverySession = cookies().get("auth_recovery")?.value === "1";

  if (!isRecoverySession && !currentPassword) {
    return { error: "Enter your current password to confirm this change." };
  }

  const passwordValidation = passwordSchema.safeParse(newPassword);
  if (!passwordValidation.success) {
    return { error: passwordValidation.error.issues[0]?.message || "Invalid password." };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Your recovery session has expired. Request a new reset link." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  if (!isRecoverySession) {
    if (!currentUser.email) {
      return { error: "Password changes are managed by your identity provider." };
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: currentPassword,
    });
    if (reauthError) {
      await recordAuthSecurityEvent({
        userId: currentUser.id,
        eventType: "PASSWORD_REAUTH",
        outcome: "FAILURE",
      });
      return { error: "Current password is incorrect." };
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    await recordAuthSecurityEvent({
      userId: currentUser.id,
      eventType: "PASSWORD_UPDATE",
      outcome: "FAILURE",
    });
    return { error: error.message };
  }

  await recordAuthSecurityEvent({
    userId: currentUser.id,
    eventType: "PASSWORD_UPDATE",
    outcome: "SUCCESS",
  });

  // A password change invalidates all existing refresh sessions. This also
  // clears the short-lived recovery marker after a successful reset.
  await revokeSessions("global");
  cookies().delete("auth_recovery");

  return {
    success: true,
    message: "Your password has been successfully updated. Please sign in again.",
  };
}
