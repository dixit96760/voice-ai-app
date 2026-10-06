import { NextResponse, type NextRequest } from "next/server";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { isDemoMode } from "@/lib/auth/demo-mode";
import { signInDemoUser } from "@/lib/auth/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode is disabled." }, { status: 404 });
  }

  try {
    await signInDemoUser();
    const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"));
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}${next || "/dashboard"}`);
  } catch (error) {
    console.error("Local demo sign-in failed:", error);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/login?error=Local+demo+mode+could+not+start`);
  }
}
