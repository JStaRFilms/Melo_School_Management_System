import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/AuthProvider";
import { ConvexClientProvider } from "@/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { AppToaster } from "@school/shared/toast";
import { getToken } from "@/auth-server";

export const metadata = {
  title: "OS/SCHOOL Admin",
  description: "School Management System - Admin Portal",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 min-h-screen" suppressHydrationWarning>
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
