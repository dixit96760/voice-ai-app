"use client";

import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updatePassword, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Updating Password...
        </>
      ) : (
        <>
          <KeyRound className="mr-2 h-4 w-4" />
          Update Password
        </>
      )}
    </Button>
  );
}

export default function PasswordChangeForm({
  requireCurrentPassword = true,
}: {
  requireCurrentPassword?: boolean;
}) {
  const [state, formAction] = useFormState<AuthActionResult | null, FormData>(
    updatePassword,
    null
  );

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.success && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {requireCurrentPassword && (
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Confirm your identity"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          placeholder="Minimum 8 characters"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          placeholder="Re-enter new password"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
