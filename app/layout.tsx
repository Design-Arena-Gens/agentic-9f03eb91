export const metadata = {
  title: "CCTV Standoff",
  description: "Low-angle CCTV-style scene with audio"
};

import "./globals.css";
import React from "react";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
