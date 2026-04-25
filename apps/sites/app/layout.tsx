import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[color:var(--school-background)] text-[color:var(--school-ink)] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
