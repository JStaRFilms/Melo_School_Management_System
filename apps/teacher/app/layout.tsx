import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthProvider";
import { ConvexClientProvider } from "@/lib/ConvexClientProvider";
import { hasConvexAuthEnv } from "@school/auth";
import { AppToaster } from "@school/shared/toast";
import { DepartureGuardProvider } from "@school/shared/drafts";
import { getToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Melo Teacher",
  description: "Melo - Teacher Workspace",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/melo-favicon.png", type: "image/png" }],
    shortcut: ["/melo-favicon.png"],
    apple: [{ url: "/apple-icon.png" }],
  },
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
            <DepartureGuardProvider>{children}</DepartureGuardProvider>
          </AuthProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
