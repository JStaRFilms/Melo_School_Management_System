import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";
import { ConvexClientProvider } from "@/lib/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { AppToaster } from "@school/shared/toast";
import { getToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Teacher Portal",
  description: "Teacher workspace for planning, assessment, and enrollment workflows",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialToken = hasConvexAuthEnv() ? await getToken().catch(() => null) : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
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
