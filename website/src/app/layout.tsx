import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Michael McGowan | Biotech CMC Consultant",
  description:
    "CMC strategy, cell & gene therapy manufacturing, and AI-powered workflows — from Pre-clinical through Phase 3. Veteran of Vertex, BMS, and Thermo Fisher.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
