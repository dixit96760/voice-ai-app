import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The page you&apos;re looking for may have moved or no longer exists.
        </p>
        <Button asChild className="mt-7">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
      </div>
    </main>
  );
}
