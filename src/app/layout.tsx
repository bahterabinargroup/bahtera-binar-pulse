import type { Metadata, Viewport } from "next";
import { Lora } from "next/font/google";
import { EmailLinkHandler } from "@/components/EmailLinkHandler";
import "./globals.css";

const lora = Lora({ variable: "--font-lora", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Daily Report · Bahtera Binar Group",
  description: "Laporan harian karyawan Bahtera Binar Group",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#012C4E",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${lora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <EmailLinkHandler />
        {children}
      </body>
    </html>
  );
}
