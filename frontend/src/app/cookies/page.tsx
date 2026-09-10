'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useLanguage } from '../components/LanguageContext';

export default function CookiePolicyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f7f9fc] dark:bg-transparent text-[#1e293b] dark:text-slate-100 flex flex-col font-sans selection:bg-sky-500/20">
      <Navbar />

      <main id="main-content" className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <li>
              <Link href="/" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">{t('nav_home', 'Home')}</Link>
            </li>
            <li><span aria-hidden="true">/</span></li>
            <li className="text-slate-900 dark:text-white font-semibold">{t('cookies_title', 'Cookie & Storage Policy')}</li>
          </ol>
        </nav>

        <header className="border-b border-sky-200/80 dark:border-sky-900/60 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Zero Tracking Cookies • Strictly Functional Storage</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            {t('cookies_title', 'Cookie & Storage Policy')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t('last_updated', 'Last Updated: September 10, 2026 • Effective Date: September 10, 2026')}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {/* Executive Summary */}
          <div className="p-5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80">
            <h2 className="text-base font-bold text-sky-900 dark:text-sky-200 mb-2">
              Summary: We Respect Your Digital Privacy
            </h2>
            <p className="text-xs sm:text-sm text-sky-800 dark:text-sky-300/90">
              RailTrackr does <strong>not</strong> use advertising cookies, marketing pixels, cross-site trackers, or third-party behavioral profiling mechanisms. We only store minimal, strictly functional preferences inside your browser&apos;s local storage (<code className="font-mono text-xs bg-sky-100 dark:bg-sky-900 px-1 py-0.5 rounded">localStorage</code>) to remember your chosen display theme and acknowledgement status.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              1. What Are Cookies and Local Storage?
            </h2>
            <p>
              Cookies and local browser storage are small text fragments stored directly on your computer or mobile device by websites you visit. While cookies are transmitted with every HTTP network request, client-side <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">localStorage</code> remains isolated strictly on your device and is never broadcast over the network to external advertisers.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              2. Complete Inventory of Client-Side Storage Keys
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Under our commitment to data transparency, below is an exhaustive list of every key written to your browser by RailTrackr:
            </p>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white">Key Name</th>
                    <th scope="col" className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white">Storage Mechanism</th>
                    <th scope="col" className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white">Purpose</th>
                    <th scope="col" className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white">Lifespan</th>
                    <th scope="col" className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sky-700 dark:text-sky-300">railpulse-theme</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">localStorage</td>
                    <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-400">Saves your preferred UI theme (&apos;light&apos; or &apos;dark&apos;) so your viewing preference persists across pages.</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Persistent until manually cleared</td>
                    <td className="px-4 py-3 font-sans text-emerald-700 dark:text-emerald-400 font-semibold">Strictly Functional</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sky-700 dark:text-sky-300">railpulse-consent</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">localStorage</td>
                    <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-400">Records that you acknowledged this privacy and cookie policy banner so you are not interrupted repeatedly.</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">1 year / persistent</td>
                    <td className="px-4 py-3 font-sans text-emerald-700 dark:text-emerald-400 font-semibold">Strictly Functional</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-sky-700 dark:text-sky-300">railpulse_admin_token</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">localStorage</td>
                    <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-400">Used solely in the operator control room to retain operator session authentication state.</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Until operator logs out / browser reset</td>
                    <td className="px-4 py-3 font-sans text-emerald-700 dark:text-emerald-400 font-semibold">Operational Security</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              3. Third-Party Analytics & Tracking Technologies
            </h2>
            <div className="rounded-xl p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm">
              <p className="font-semibold text-emerald-900 dark:text-emerald-200 mb-1">
                Zero Third-Party Advertising or Social Tracking:
              </p>
              <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300/90 pl-1">
                <li>No Google Analytics, Google Tag Manager, or Google DoubleClick.</li>
                <li>No Meta / Facebook Pixel or social remarketing widgets.</li>
                <li>No Hotjar, Clarity, or session screen-recording tools.</li>
                <li>No advertising networks, ad exchanges, or behavioral brokers.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              4. Legal Basis for Necessary Storage
            </h2>
            <p>
              Under the <em>Information Technology Act, 2000</em>, India&apos;s <em>Digital Personal Data Protection Act (DPDPA), 2023</em>, and Article 5(3) of the EU ePrivacy Directive, strictly technical storage necessary for transmitting a communication or providing an information society service requested by the user does not require marketing consent.
            </p>
            <p>
              Nevertheless, we display a clear banner upon your initial visit so you remain entirely in control and informed about our local storage practices.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              5. How to Control or Clear Stored Data
            </h2>
            <p>
              You can inspect, clear, or block local storage at any time using your browser&apos;s standard privacy settings:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 pl-2">
              <li>
                <strong>Google Chrome:</strong> Settings → Privacy & Security → Site Settings → On-device site data → See all site data → Search &quot;localhost&quot; or domain → Clear.
              </li>
              <li>
                <strong>Mozilla Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data → Clear Data.
              </li>
              <li>
                <strong>Apple Safari:</strong> Settings → Privacy → Manage Website Data → Remove.
              </li>
              <li>
                <strong>Microsoft Edge:</strong> Settings → Cookies and site permissions → Manage and delete cookies and site data.
              </li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Note: Clearing your local storage will simply reset your color theme to your system default and redisplay the policy notification banner on your subsequent visit.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              6. Related Privacy Resources
            </h2>
            <p>
              For complete details on our data protection commitments, technical safeguards, and grievance mechanisms, please review our companion policies:
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/privacy"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-100 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-semibold hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors"
              >
                <span>Read Privacy Policy (DPDPA 2023)</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/terms"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-100 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-semibold hover:bg-sky-200 dark:hover:bg-sky-900 transition-colors"
              >
                <span>Read Terms & Conditions</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
