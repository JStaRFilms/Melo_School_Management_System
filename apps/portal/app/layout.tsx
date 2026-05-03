import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/AuthProvider";
import { ConvexClientProvider } from "@/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { AppToaster } from "@school/shared/toast";
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        <ConvexClientProvider initialToken={initialToken}>
          <AuthProvider>
            <AppToaster />
            {children}
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
