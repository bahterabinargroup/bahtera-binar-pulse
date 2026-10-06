import type { Metadata, Viewport } from "next";
import { EmailLinkHandler } from "@/components/EmailLinkHandler";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Report",
  description: "Laporan harian karyawan",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <EmailLinkHandler />
        {children}
      </body>
    </html>
  );
}
