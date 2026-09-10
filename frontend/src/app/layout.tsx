import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeContext";
import { LanguageProvider } from "./components/LanguageContext";
import LanguageModal from "./components/LanguageModal";
import CookieConsent from "./components/CookieConsent";

export const metadata: Metadata = {
  title: "Namaste Rail | Indian Railways Transit Intelligence & Telemetry",
  description: "Next-generation dynamic train arrival prediction, RTIS live GPS telemetry, and explainable delay diagnosis for Indian Railways.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('railpulse-theme');
                  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                  var storedLang = localStorage.getItem('railpulse-lang');
                  if (storedLang === 'hi' || storedLang === 'en') {
                    document.documentElement.lang = storedLang;
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2.5 focus:bg-sky-600 focus:text-white focus:font-bold focus:shadow-2xl focus:rounded-xl focus:outline-2 focus:outline-white"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <LanguageModal />
            <CookieConsent />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
