import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailETA — Dynamic Train ETA Forecast Engine",
  description: "SIH 2026 Problem Statement 26028: Explainable section-level ETA forecasting for Indian Railways coaching trains.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050b14] text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
