import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CAS Meal Wallet | ISB PGP Placements Food Spending Portal",
  description: "Mobile-first food spending wallet portal for ISB Career Advancement Services (CAS) PGP placements. Replacing meal tokens with auditable digital rupee wallets and vendor QR scanning.",
  applicationName: "CAS Meal Wallet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Meal Wallet",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2F6DB5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-gray-900 font-sans selection:bg-[#2F6DB5] selection:text-white">
        {children}
      </body>
    </html>
  );
}
