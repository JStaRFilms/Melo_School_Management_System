import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/AuthProvider";
import { ConvexClientProvider } from "@/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { getToken } from "@/auth-server";

export const metadata: Metadata = {
  title: "Portal - Academic Dashboard",
  description: "Parent and student academic portal for the school management system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <ConvexClientProvider initialToken={initialToken}>
          <AuthProvider>{children}</AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
