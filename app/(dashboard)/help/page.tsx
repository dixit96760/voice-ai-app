import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  FileText,
  LifeBuoy,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const guides = [
  {
    icon: PhoneCall,
    title: "Launch your first campaign",
    description: "Prepare your audience, knowledge, AI behavior, and calling rules before going live.",
    href: "/campaigns/new",
    action: "Create campaign",
  },
  {
    icon: FileText,
    title: "Organize your contacts",
    description: "Import, clean, and review contacts before assigning them to a campaign.",
    href: "/contacts/import",
    action: "Import contacts",
  },
  {
    icon: ShieldCheck,
    title: "Understand DNC protection",
    description: "Learn how compliance flags keep ineligible contacts out of your calling queues.",
    href: "/contacts?filter=dnc",
    action: "View DNC list",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-10 text-background sm:px-10 sm:py-12">
        <div className="surface-grid absolute inset-0 opacity-10" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-background/15 bg-background/10 px-3 py-1.5 text-xs font-semibold text-background/80">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
            Help center
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How can we help?</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-background/65 sm:text-base">
            Find a quick starting point for campaigns, contacts, compliance, and daily voice
            operations.
          </p>
        </div>
      </section>

      <section aria-labelledby="quick-guides">
        <div className="mb-5">
          <p className="eyebrow">Quick guides</p>
          <h2 id="quick-guides" className="mt-2 text-2xl font-bold tracking-tight">
            Start with the essentials
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {guides.map(({ icon: Icon, title, description, href, action }) => (
            <Card key={title} className="group flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="leading-6">{description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button variant="ghost" asChild className="h-auto p-0 text-primary hover:bg-transparent hover:underline">
                  <Link href={href}>
                    {action}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Support options">
        <Card>
          <CardHeader>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-base">Product documentation</CardTitle>
            <CardDescription>
              Review setup guidance and recommended workflows for your voice operation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-5 text-muted-foreground">
              Documentation is being prepared for your workspace. If you need immediate help,
              contact your account administrator.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-base">Still need a hand?</CardTitle>
            <CardDescription>
              Capture the campaign name, contact number, and expected behavior when reporting an issue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-5 text-muted-foreground">
              For campaign-specific issues, open the campaign detail page and review its readiness and
              call history first.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
