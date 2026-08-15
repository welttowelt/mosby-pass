import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mosby Pass | Private event admission",
  description:
    "Pay with shielded STRK and enter without exposing your public wallet. Powered by STRK20 on Starknet.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
