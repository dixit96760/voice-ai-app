import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/telephony/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const header = req.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Background jobs: complete finished campaigns, redial due callbacks, and
 * empty the 30-day recycle bin. Triggered every few minutes by Supabase
 * pg_cron (and daily by Vercel Cron as a backup), both sending
 * `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const report = await runScheduledJobs();
  if (report.errors.length > 0) {
    console.error("Scheduled jobs reported errors:", report.errors);
  }
  return NextResponse.json(report);
}

export const GET = handle;
export const POST = handle;
