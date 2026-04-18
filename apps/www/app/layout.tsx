import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/site-ui";
import { siteBrand } from "@/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteBrand.siteUrl),
  title: {
    default: `${siteBrand.name} — ${siteBrand.tagline}`,
    template: `%s — ${siteBrand.name}`,
  },
  description: siteBrand.description,
  openGraph: {
    type: "website",
    siteName: siteBrand.name,
    title: siteBrand.name,
    description: siteBrand.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteBrand.name,
    description: siteBrand.description,
  },
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-melo-paper text-melo-stone antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
