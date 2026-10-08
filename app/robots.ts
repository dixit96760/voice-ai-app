import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://voice-ai-app-beryl.vercel.app");

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/pricing",
          "/privacy",
          "/terms",
          "/refund",
          "/contact",
          "/login",
          "/signup",
        ],
        disallow: [
          "/admin",
          "/dashboard",
          "/campaigns",
          "/campaigns/*",
          "/calls",
          "/calls/*",
          "/contacts",
          "/contacts/*",
          "/billing",
          "/settings",
          "/settings/*",
          "/usage",
          "/analytics",
          "/callbacks",
          "/help",
          "/onboarding",
          "/api/*",
          "/auth/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

