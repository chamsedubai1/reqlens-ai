import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReqLens AI",
  description: "Domain-Aware Requirements Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
