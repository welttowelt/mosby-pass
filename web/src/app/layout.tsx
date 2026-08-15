import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veilpass | Private creator membership",
  description:
    "Join a creator without linking your public wallet. Powered by STRK20 on Starknet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
