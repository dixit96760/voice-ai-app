"use client";

import React, { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createManualContactAction,
  toggleContactDncAction,
  toggleContactWrongNumberAction,
} from "@/lib/contacts/actions";
import {
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  PhoneOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

export function AddContactButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending]);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    tags: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createManualContactAction({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        city: formData.city || undefined,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : [],
        notes: formData.notes || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to create contact.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
          setFormData({ name: "", phone: "", email: "", city: "", tags: "", notes: "" });
        }, 1000);
      }
    });
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="gap-1.5 h-9 text-xs">
        <UserPlus className="h-4 w-4" />
        Add Contact
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-contact-title"
        >
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 id="add-contact-title" className="flex items-center gap-2 text-lg font-semibold">
                <UserPlus className="h-5 w-5 text-primary" />
                Add New Contact
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(false)}
                aria-label="Close add contact dialog"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-emerald-500/10 p-3 text-xs text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Contact added successfully!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Rahul Verma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone">Indian Phone Number (+91) *</Label>
                <Input
                  id="phone"
                  placeholder="e.g. 9876543210 or +919876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g. Mumbai, Bengaluru"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. High Intent, Villa Buyer, Q3"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="gap-1.5">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function ContactDncToggle({
  contactId,
  isDnc,
}: {
  contactId: string;
  isDnc: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    if (
      isDnc &&
      !window.confirm(
        "Remove this contact from the DNC list? They may be contacted by future campaigns if eligible."
      )
    ) {
      return;
    }

    startTransition(async () => {
      await toggleContactDncAction(contactId, !isDnc);
    });
  };

  return (
    <Button
      variant={isDnc ? "destructive" : "ghost"}
      size="sm"
      className="h-7 px-2 text-[11px] gap-1"
      onClick={handleToggle}
      disabled={pending}
      title={isDnc ? "Remove from DNC" : "Add to DNC"}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isDnc ? (
        <>
          <ShieldAlert className="h-3 w-3" />
          DNC Active
        </>
      ) : (
        <>
          <ShieldCheck className="h-3 w-3 text-muted-foreground" />
          Mark DNC
        </>
      )}
    </Button>
  );
}

export function ContactWrongNumberToggle({
  contactId,
  isWrongNumber,
}: {
  contactId: string;
  isWrongNumber: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    if (
      isWrongNumber &&
      !window.confirm(
        "Clear the wrong-number flag? This contact may be included in future campaign eligibility checks."
      )
    ) {
      return;
    }

    startTransition(async () => {
      await toggleContactWrongNumberAction(contactId, !isWrongNumber);
    });
  };

  return (
    <Button
      variant={isWrongNumber ? "secondary" : "ghost"}
      size="sm"
      className={`h-7 px-2 text-[11px] gap-1 ${
        isWrongNumber ? "bg-amber-500/10 text-amber-700 border border-amber-300" : ""
      }`}
      onClick={handleToggle}
      disabled={pending}
      title={isWrongNumber ? "Clear Wrong Number Flag" : "Flag as Wrong Number"}
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <>
          <PhoneOff className="h-3 w-3" />
          {isWrongNumber ? "Wrong No." : "Flag Wrong"}
        </>
      )}
    </Button>
  );
}
