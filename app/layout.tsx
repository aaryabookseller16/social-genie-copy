import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displaySerif = Cormorant_Garamond({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Genie - Your Social Concierge",
  description:
    "Ask Genie and she'll find your vibe - brunches, happy hours, lounges, patios, and more.",
  metadataBase: new URL("https://genie.socialbevy.com"),
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Genie - Your Social Concierge",
    description: "Ask Genie and she'll find your vibe.",
    url: "https://genie.socialbevy.com",
    siteName: "Genie - Social Bevy",
    images: [
      {
        url: "https://genie.socialbevy.com/genie-profile-pic.png",
        width: 1024,
        height: 1024,
        alt: "Genie - Your Social Concierge",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genie - Your AI-Powered Social Concierge",
    description:
      "Tell Genie your vibe and she'll instantly pull the perfect Houston spots for you.",
    images: ["https://genie.socialbevy.com/genie-profile-pic.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0000" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
