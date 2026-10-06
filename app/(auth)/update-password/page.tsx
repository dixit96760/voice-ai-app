"use client";

import { ShieldCheck } from "lucide-react";
import PasswordChangeForm from "@/app/(dashboard)/settings/security/password-change-form";

export default function UpdatePasswordPage() {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your recovery link is active. Set a new password to finish securing your account.
        </p>
      </div>
      <PasswordChangeForm requireCurrentPassword={false} />
    </div>
  );
}
