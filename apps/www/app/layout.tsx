import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/site-ui";
import { siteBrand } from "@/site";
import { SmoothScrollProvider } from "../components/ui/smooth-scroll-provider";

const socialImageUrl = new URL("/og-image.png", siteBrand.siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: new URL(siteBrand.siteUrl),
  applicationName: siteBrand.name,
  title: {
    default: `${siteBrand.name} — ${siteBrand.tagline}`,
    template: `%s — ${siteBrand.name}`,
  },
  description: siteBrand.description,
  alternates: {
    canonical: siteBrand.siteUrl,
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "en_NG",
    siteName: siteBrand.name,
    title: siteBrand.name,
    description: siteBrand.description,
    url: siteBrand.siteUrl,
    images: [{ url: socialImageUrl, width: 1731, height: 909, alt: `${siteBrand.name} platform preview` }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteBrand.name,
    description: siteBrand.description,
    images: [socialImageUrl],
  },
  icons: {
    icon: [{ url: "/melo-favicon.png", type: "image/png" }],
    shortcut: ["/melo-favicon.png"],
    apple: [{ url: "/apple-icon.png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-melo-paper text-melo-stone antialiased" suppressHydrationWarning>
        <SmoothScrollProvider>
          <SiteHeader />
          <main className="pb-24 sm:pb-0">{children}</main>
          <SiteFooter />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
