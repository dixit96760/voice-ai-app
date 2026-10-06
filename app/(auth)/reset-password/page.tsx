"use client";

import React from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { resetPassword, type AuthActionResult } from "@/lib/auth/actions";
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
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending reset link...
        </>
      ) : (
        <>
          <Mail className="mr-2 h-4 w-4" />
          Send Reset Instructions
        </>
      )}
    </Button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState<AuthActionResult | null, FormData>(
    resetPassword,
    null
  );

  return (
    <Card className="rounded-2xl border-border/80 shadow-xl shadow-primary/5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl font-bold tracking-tight">
          Reset password
        </CardTitle>
        <CardDescription>
          Enter your registered work email to receive password reset instructions
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
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

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="owner@yourbusiness.com"
            />
          </div>

          <SubmitButton />
        </form>
      </CardContent>

      <CardFooter className="justify-center border-t p-4 text-sm text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex items-center font-medium text-primary hover:underline"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
