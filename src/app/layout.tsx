import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "IPL Fantasy Auction",
  description: "Real-time IPL fantasy auction and snake draft management.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
