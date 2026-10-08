"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { signInWithEmail, type AuthActionResult } from "@/lib/auth/actions";
import { AUTH_CONFIG_ERROR, isSupabaseAuthConfigured } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { normalizeIndianPhone } from "@/lib/validation/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowRight, Loader2, Phone, RotateCcw } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          Sign In
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<AuthActionResult | null, FormData>(
    signInWithEmail,
    null
  );
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [redirectTo, setRedirectTo] = useState("");
  const [oauthError, setOauthError] = useState("");
  const [oauthRequestError, setOauthRequestError] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const authConfigured = isSupabaseAuthConfigured();
  const [phonePrefix] = useState("+91");
  const [phoneState, setPhoneState] = useState({
    phone: "",
    otp: "",
    otpSent: false,
    loading: false,
    error: "",
    successMessage: "",
    resendCooldown: 0,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(getSafeRedirectPath(params.get("redirectTo")));
    setOauthError(params.get("error") || "");
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (phoneState.resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setPhoneState((prev) => ({
        ...prev,
        resendCooldown: Math.max(0, prev.resendCooldown - 1),
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneState.resendCooldown]);

  const handleOAuthSignIn = async (provider: "google") => {
    if (!authConfigured) {
      setOauthRequestError(AUTH_CONFIG_ERROR);
      return;
    }

    setOauthLoading(true);
    setOauthRequestError("");

    try {
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (redirectTo) {
        callbackUrl.searchParams.set("next", redirectTo);
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) {
        setOauthRequestError(error.message);
      }
    } catch {
      setOauthRequestError("Google sign-in could not be started. Please try again.");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!authConfigured) {
      setPhoneState((prev) => ({ ...prev, error: AUTH_CONFIG_ERROR }));
      return;
    }

    setPhoneState((prev) => ({ ...prev, loading: true, error: "", successMessage: "" }));

    const rawInput = phoneState.phone.trim();
    const fullNumber = rawInput.startsWith("+") ? rawInput : `${phonePrefix}${rawInput}`;
    const validation = normalizeIndianPhone(fullNumber);

    if (!validation.isValid || !validation.normalized) {
      setPhoneState((prev) => ({
        ...prev,
        loading: false,
        error: validation.errorMessage || "Please enter a valid 10-digit Indian mobile number",
      }));
      return;
    }

    try {
      const response = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", phone: validation.normalized }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setPhoneState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || "Unable to send a verification code.",
        }));
        return;
      }

      setPhoneState((prev) => ({
        ...prev,
        loading: false,
        otpSent: true,
        resendCooldown: 30,
        successMessage: `6-digit verification code sent to ${validation.normalized}`,
      }));
    } catch {
      setPhoneState((prev) => ({
        ...prev,
        loading: false,
        error: "Unable to reach the authentication service.",
      }));
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authConfigured) {
      setPhoneState((prev) => ({ ...prev, error: AUTH_CONFIG_ERROR }));
      return;
    }

    setPhoneState((prev) => ({ ...prev, loading: true, error: "" }));

    const rawInput = phoneState.phone.trim();
    const fullNumber = rawInput.startsWith("+") ? rawInput : `${phonePrefix}${rawInput}`;
    const validation = normalizeIndianPhone(fullNumber);

    if (!validation.isValid || !validation.normalized) {
      setPhoneState((prev) => ({
        ...prev,
        loading: false,
        error: "Invalid phone number.",
      }));
      return;
    }

    const otpCleaned = phoneState.otp.trim();
    if (otpCleaned.length !== 6) {
      setPhoneState((prev) => ({
        ...prev,
        loading: false,
        error: "Please enter the 6-digit code sent to your phone.",
      }));
      return;
    }

    try {
      const response = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          phone: validation.normalized,
          otp: otpCleaned,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        hasBusiness?: boolean;
      };
      if (!response.ok) {
        setPhoneState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || "The verification code is invalid or expired.",
        }));
        return;
      }

      const requestedRedirect = getSafeRedirectPath(
        new URLSearchParams(window.location.search).get("redirectTo")
      );
      const destination = result.hasBusiness
        ? requestedRedirect && requestedRedirect !== "/onboarding"
          ? requestedRedirect
          : "/dashboard"
        : "/onboarding";
      window.location.href = destination;
    } catch {
      setPhoneState((prev) => ({
        ...prev,
        loading: false,
        error: "Unable to reach the authentication service.",
      }));
    }
  };

  return (
    <Card className="rounded-2xl border-border/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-bold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to manage your AI voice campaigns and calls
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!authConfigured && !state?.error && !oauthRequestError && !phoneState.error && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{AUTH_CONFIG_ERROR}</AlertDescription>
          </Alert>
        )}

        {oauthRequestError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{oauthRequestError}</AlertDescription>
          </Alert>
        )}

        {oauthError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{oauthError}</AlertDescription>
          </Alert>
        )}

        {state?.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {state.error}
              {state.emailNotConfirmed && (
                <ResendConfirmation getEmail={() => emailInputRef.current?.value || ""} />
              )}
            </AlertDescription>
          </Alert>
        )}

        {phoneState.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{phoneState.error}</AlertDescription>
          </Alert>
        )}

        {phoneState.successMessage && (
          <Alert variant="success">
            <AlertDescription>{phoneState.successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Mode switcher: Email vs Phone OTP */}
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            aria-pressed={authMode === "email"}
            onClick={() => setAuthMode("email")}
            className={`rounded-md py-1.5 transition-all ${
              authMode === "email"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Email & Password
          </button>
          <button
            type="button"
            aria-pressed={authMode === "phone"}
            onClick={() => setAuthMode("phone")}
            className={`rounded-md py-1.5 transition-all ${
              authMode === "phone"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Phone OTP (India)
          </button>
        </div>

        {authMode === "email" ? (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="space-y-2">
              <Label htmlFor="email">Work Email</Label>
              <Input
                ref={emailInputRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="owner@yourbusiness.com"
              />
              {state?.fieldErrors?.email && (
                <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/reset-password"
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
              {state?.fieldErrors?.password && (
                <p className="text-xs text-destructive">{state.fieldErrors.password}</p>
              )}
            </div>

            <SubmitButton />
          </form>
        ) : (
          <div className="space-y-4">
            {!phoneState.otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Mobile Number</Label>
                  <div className="flex gap-2">
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-semibold text-muted-foreground">
                      {phonePrefix}
                    </div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="98765 43210"
                      value={phoneState.phone}
                      onChange={(e) =>
                        setPhoneState((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    We will send a 6-digit one-time code to verify your phone.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={phoneState.loading || !phoneState.phone}
                >
                  {phoneState.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="mr-2 h-4 w-4" />
                  )}
                  Send Verification Code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">6-Digit OTP</Label>
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={phoneState.otp}
                    onChange={(e) =>
                      setPhoneState((prev) => ({
                        ...prev,
                        otp: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    required
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={phoneState.loading || phoneState.otp.length !== 6}
                >
                  {phoneState.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Verify & Continue
                </Button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPhoneState((prev) => ({ ...prev, otpSent: false, otp: "", error: "" }))
                    }
                    className="text-muted-foreground hover:underline"
                  >
                    Change phone number
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendOtp()}
                    disabled={phoneState.resendCooldown > 0 || phoneState.loading}
                    className="inline-flex items-center text-primary hover:underline font-medium disabled:text-muted-foreground disabled:no-underline"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {phoneState.resendCooldown > 0
                      ? `Resend in ${phoneState.resendCooldown}s`
                      : "Resend code"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full"
          onClick={() => handleOAuthSignIn("google")}
          disabled={oauthLoading}
          aria-busy={oauthLoading}
        >
          {oauthLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          )}
          Google Workspace
        </Button>
      </CardContent>

      <CardFooter className="justify-center border-t p-4 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="ml-1 font-semibold text-primary hover:underline"
        >
          Create an account
        </Link>
      </CardFooter>
    </Card>
  );
}

function ResendConfirmation({ getEmail }: { getEmail: () => string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("https://rp2.alfred511.top/hf/api/auth/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: getEmail() }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error || "Could not send the email. Please try again later.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setMessage("Could not send the email. Check your connection and try again.");
    }
  };

  if (status === "sent") {
    return (
      <span className="mt-2 block font-medium">
        A new confirmation email is on its way. Open the link in it, then sign in again.
      </span>
    );
  }

  return (
    <span className="mt-2 block">
      <button
        type="button"
        onClick={resend}
        disabled={status === "sending"}
        className="font-semibold underline underline-offset-2 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Resend confirmation email"}
      </button>
      {message && <span className="mt-1 block">{message}</span>}
    </span>
  );
}
