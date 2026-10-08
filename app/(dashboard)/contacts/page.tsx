import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusiness } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  Users,
  UploadCloud,
  History,
  Search,
  ShieldAlert,
  PhoneOff,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AddContactButton,
  ContactDncToggle,
  ContactWrongNumberToggle,
} from "./contact-actions-client";

interface ContactsPageProps {
  searchParams: Promise<{
    q?: string;
    filter?: string;
  }>;
}

export default async function ContactsPage({ searchParams: searchParamsPromise }: ContactsPageProps) {
  const searchParams = await searchParamsPromise;
  const business = await getCurrentBusiness();
  if (!business) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const searchQuery = searchParams.q?.trim() || "";
  const filter = searchParams.filter || "all";

  // Build query
  let query = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (searchQuery) {
    query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`);
  }

  if (filter === "dnc") {
    query = query.eq("is_dnc", true);
  } else if (filter === "wrong_number") {
    query = query.eq("is_wrong_number", true);
  } else if (filter === "active") {
    query = query.eq("is_dnc", false).eq("is_wrong_number", false);
  }

  const { data: contacts, count: totalCount } = await query.limit(100);

  // Fetch summary metrics
  const { count: dncCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("is_dnc", true);

  const { count: wrongNumberCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("is_wrong_number", true);

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Contacts Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your customer database, clean phone lists, import contacts, and enforce DNC compliance.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild className="gap-1.5 h-9 text-xs">
            <Link href="/contacts/imports">
              <History className="h-4 w-4" />
              Import History
            </Link>
          </Button>

          <Button variant="outline" size="sm" asChild className="gap-1.5 h-9 text-xs">
            <Link href="/contacts/import">
              <UploadCloud className="h-4 w-4" />
              Import Contacts
            </Link>
          </Button>

          <AddContactButton />
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Directory</p>
            <p className="text-2xl font-bold mt-1">{totalCount || 0}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Do-Not-Call (DNC)</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{dncCount || 0}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Flagged Wrong Numbers</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{wrongNumberCount || 0}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
            <PhoneOff className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <form method="GET" action="/contacts" className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search contacts by name, phone, or city..."
            className="pl-9 h-9 text-xs"
          />
        </form>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            asChild
            className="h-8 text-xs"
          >
            <Link href={`/contacts?q=${encodeURIComponent(searchQuery)}`}>All</Link>
          </Button>
          <Button
            variant={filter === "active" ? "secondary" : "ghost"}
            size="sm"
            asChild
            className="h-8 text-xs"
          >
            <Link href={`/contacts?filter=active&q=${encodeURIComponent(searchQuery)}`}>
              Eligible
            </Link>
          </Button>
          <Button
            variant={filter === "dnc" ? "secondary" : "ghost"}
            size="sm"
            asChild
            className="h-8 text-xs"
          >
            <Link href={`/contacts?filter=dnc&q=${encodeURIComponent(searchQuery)}`}>DNC</Link>
          </Button>
          <Button
            variant={filter === "wrong_number" ? "secondary" : "ghost"}
            size="sm"
            asChild
            className="h-8 text-xs"
          >
            <Link href={`/contacts?filter=wrong_number&q=${encodeURIComponent(searchQuery)}`}>
              Wrong Numbers
            </Link>
          </Button>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-xs">Name</TableHead>
              <TableHead className="font-semibold text-xs">Phone (+91)</TableHead>
              <TableHead className="font-semibold text-xs">City</TableHead>
              <TableHead className="font-semibold text-xs">Tags</TableHead>
              <TableHead className="font-semibold text-xs">Compliance Status</TableHead>
              <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!contacts || contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                  No contacts found. Click &ldquo;Import Contacts&rdquo; or &ldquo;Add Contact&rdquo; to build your directory.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id} className="text-xs hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    <div>{contact.name}</div>
                    {contact.email && (
                      <span className="text-[11px] text-muted-foreground">{contact.email}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{contact.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.city || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {contact.is_dnc ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          DNC
                        </Badge>
                      ) : contact.is_wrong_number ? (
                        <Badge className="bg-amber-500/10 text-amber-700 border border-amber-300 text-[10px] gap-1">
                          <PhoneOff className="h-3 w-3" />
                          Wrong Number
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Eligible
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ContactDncToggle contactId={contact.id} isDnc={contact.is_dnc} />
                      <ContactWrongNumberToggle
                        contactId={contact.id}
                        isWrongNumber={contact.is_wrong_number}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
