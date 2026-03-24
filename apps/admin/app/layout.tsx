import type { ReactNode } from "react";
import "./globals.css";
import { ConvexClientProvider } from "@/ConvexClientProvider";

export const metadata = {
  title: "OS/SCHOOL Admin",
  description: "School Management System - Admin Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
