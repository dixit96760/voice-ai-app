import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const defaultAppUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://sarvamvoice.ai";

export const metadata: Metadata = {
  metadataBase: new URL(defaultAppUrl),
  title: {
    default: "Sarvam Voice AI | Outbound AI Calling for Indian Businesses",
    template: "%s | Sarvam Voice AI",
  },
  description:
    "Launch intelligent, compliant outbound voice campaigns in Hindi, Indian English, and regional languages with Sarvam Voice AI. Automated DNC protection, callbacks, and real-time transcripts.",
  applicationName: "Sarvam Voice AI",
  keywords: [
    "voice AI",
    "outbound calling",
    "telephony",
    "India",
    "Sarvam AI",
    "AI sales calls",
    "Hindi voice agent",
    "B2B cold calling software India",
    "TRAI compliant voice AI",
  ],
  authors: [{ name: "Sarvam Voice AI Team" }],
  creator: "Sarvam Voice AI",
  publisher: "Sarvam Voice AI",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Sarvam Voice AI",
    title: "Sarvam Voice AI | Outbound AI Calling for Indian Businesses",
    description:
      "Automate outbound phone calls with natural Indic-language voice AI, DNC compliance, and real-time transcripts.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sarvam Voice AI - B2B Outbound Telephony",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sarvam Voice AI | Outbound AI Calling for Indian Businesses",
    description:
      "Automate outbound phone calls with natural Indic-language voice AI, DNC compliance, and real-time transcripts.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
