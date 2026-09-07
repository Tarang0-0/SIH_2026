import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RailPulse | Indian Railways Transit Intelligence & Telemetry",
  description: "Next-generation dynamic train arrival prediction, RTIS live GPS telemetry, and explainable delay diagnosis for Indian Railways.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#070b14] text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
