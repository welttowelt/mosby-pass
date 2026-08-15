import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOSBY PASS / PRIVATE EVENT ADMISSION",
  description:
    "Pay from shielded STRK. Your browser proves control of the event pass at the gate.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
