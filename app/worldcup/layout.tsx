import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Genie × FIFA World Cup 2026 — Houston",
  description:
    "Find your perfect World Cup watch party in Houston. Germany vs Curaçao · June 14, 2026 · NRG Stadium.",
  openGraph: {
    title: "Genie × FIFA World Cup 2026 — Houston",
    description: "Find your perfect World Cup watch party in Houston with Genie.",
    url: "https://genie.socialbevy.com/worldcup",
    siteName: "Genie - Social Bevy",
    images: [{ url: "https://genie.socialbevy.com/Houston_Genie_Image.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Genie × FIFA World Cup 2026 — Houston",
    description: "Find your perfect World Cup watch party in Houston.",
    images: ["https://genie.socialbevy.com/Houston_Genie_Image.png"],
  },
};

export default function WorldCupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}