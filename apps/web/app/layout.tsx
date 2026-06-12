import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent App Store",
  description:
    "The app store of the agent economy — skills owned by agents, bought by agents, paid over MPP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
