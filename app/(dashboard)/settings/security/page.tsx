import React from "react";
import { requireAuth } from "@/lib/auth/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, KeyRound, LogOut, Smartphone } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import PasswordChangeForm from "./password-change-form";

export default async function SecuritySettingsPage() {
  const user = await requireAuth();

  const authProvider = user.app_metadata?.provider || "Email";
  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }) + " IST"
    : "Active Session";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Account & Security Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your login credentials, session security, and access methods.
        </p>
      </div>

      {/* Session Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">Active Authentication Session</CardTitle>
          </div>
          <CardDescription>
            Current authenticated session details and login mechanism
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground font-medium">Signed in as</p>
              <p className="text-sm font-semibold mt-1 truncate">{user.email || user.phone}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground font-medium">Auth Provider</p>
              <p className="text-sm font-semibold mt-1 capitalize">{authProvider}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground font-medium">Last Authenticated</p>
              <p className="text-sm font-semibold mt-1">{lastSignIn}</p>
            </div>
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Sign Out of All Sessions</p>
              <p className="text-xs text-muted-foreground">
                Revokes your active sessions and signs you out on this device.
              </p>
            </div>
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit" className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Card (only relevant for email accounts) */}
      {authProvider === "email" ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-bold">Change Password</CardTitle>
            </div>
            <CardDescription>
              Update your account password with at least 8 characters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg font-bold">Password management</CardTitle>
            </div>
            <CardDescription>
              This account signs in through {authProvider}. Password changes are managed by your identity provider.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Two-factor / OTP info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-bold">SMS OTP Login</CardTitle>
          </div>
          <CardDescription>
            Direct verification via Indian mobile number (+91)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            You can sign in anytime using SMS OTP without remembering your password.
            Mobile numbers are verified via one-time passcodes and secured against brute-force attempts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
