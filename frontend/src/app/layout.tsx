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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#eef7ff] text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
