import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sarvamvoice.ai";

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

