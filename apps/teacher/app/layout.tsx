import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "@/lib/ConvexClientProvider";

export const metadata: Metadata = {
  title: "Teacher Portal - Exam Recording",
  description: "Teacher-side exam score entry for school management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="pb-32 antialiased">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
