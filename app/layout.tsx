import type { Metadata } from "next";
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

// ---------- SITE METADATA (FOR LINK PREVIEWS) ----------
export const metadata: Metadata = {
  title: "Genie – Your Social Concierge",
  description:
    "Ask Genie, she’ll find your vibe — brunches, happy hours, lounges, patios, and more.",
  
  metadataBase: new URL("https://genie.socialbevy.com"),

  openGraph: {
    title: "Genie – Your Social Concierge",
    description:
      "Ask Genie, she’ll find your vibe.",
    url: "https://genie.socialbevy.com",
    siteName: "Genie · Social Bevy",
    images: [
      {
        url: "https://genie.socialbevy.com/genie-profile-pic.png",
        width: 1024,
        height: 1024,
        alt: "Genie – Your Social Concierge",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Genie – Your AI-Powered Social Concierge",
    description:
      "Tell Genie your vibe and she’ll instantly pull the perfect Houston spots for you.",
    images: ["https://genie.socialbevy.com/genie-profile-pic.png"],
  },
};
// --------------------------------------------------------

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

