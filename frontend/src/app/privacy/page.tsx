'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useLanguage } from '../components/LanguageContext';

export default function PrivacyPolicyPage() {
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
            <li className="text-slate-900 dark:text-white font-semibold">{t('privacy_title', 'Privacy Policy')}</li>
          </ol>
        </nav>

        <header className="border-b border-sky-200/80 dark:border-sky-900/60 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>DPDPA 2023 & GDPR Compliant</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            {t('privacy_title', 'Privacy Policy')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t('last_updated', 'Last Updated: September 10, 2026 • Effective Date: September 10, 2026')}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {/* Summary Callout */}
          <div className="p-5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800/80">
            <h2 className="text-base font-bold text-sky-900 dark:text-sky-200 mb-2">
              Our Privacy Commitment: Data Minimization First
            </h2>
            <p className="text-xs sm:text-sm text-sky-800 dark:text-sky-300/90">
              Namaste Rail is an open engineering prototype developed for the <strong>Smart India Hackathon (SIH 2026)</strong>. We adhere strictly to the principle of <strong>Data Minimization</strong> under India&apos;s <em>Digital Personal Data Protection Act (DPDPA), 2023</em> and the <em>General Data Protection Regulation (GDPR)</em>. We do not sell, rent, monetize, or track your personal data. You do not need to create an account or provide any personal information to look up train schedules or ETA predictions.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              1. Information We Do NOT Collect
            </h2>
            <p>
              To protect user privacy to the fullest extent, our public transit search engine operates without collecting:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>No names, email addresses, or account credentials.</li>
              <li>No passenger government IDs (Aadhaar, Passport, PAN) or PNR passenger lists.</li>
              <li>No background GPS or device location tracking.</li>
              <li>No payment, credit card, or banking transaction details.</li>
              <li>No third-party cross-site advertising or tracking identifiers.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              2. Information We Process
            </h2>
            <p>We process only the absolute minimum operational data necessary to deliver train arrival forecasts:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-800/60 font-semibold text-slate-900 dark:text-white">
                  <tr>
                    <th className="p-3">Data Category</th>
                    <th className="p-3">Purpose</th>
                    <th className="p-3">Legal Basis</th>
                    <th className="p-3">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <td className="p-3 font-mono font-medium">Train Number & Date</td>
                    <td className="p-3">Querying timetable routes and ML delay forecasts.</td>
                    <td className="p-3">User Request Execution</td>
                    <td className="p-3">In-memory caching (max 15 mins)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-medium">Client IP Address</td>
                    <td className="p-3">Denial-of-service prevention and API quota rate limiting (120 req/min).</td>
                    <td className="p-3">Legitimate Security Interest</td>
                    <td className="p-3">Sliding 60-second in-memory window; purged automatically</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-medium">Theme Preference</td>
                    <td className="p-3">Persisting light/dark mode selection in your browser.</td>
                    <td className="p-3">User Consent</td>
                    <td className="p-3">Local browser storage only; never transmitted to server</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-medium">Phone Number (Alerts only)</td>
                    <td className="p-3">Dispatching automated SMS/WhatsApp arrival alerts if voluntarily requested.</td>
                    <td className="p-3">Explicit Voluntary Consent</td>
                    <td className="p-3">Purged after journey completion; redacted in public logs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              3. Cookies and Local Storage
            </h2>
            <p>
              We do not use tracking, advertising, or profiling cookies. We only use browser <code>localStorage</code> for strictly functional preferences:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li><code>railpulse-theme</code>: Remembers whether you selected dark or light mode.</li>
              <li><code>railpulse-consent</code>: Remembers that you acknowledged our privacy and cookie notice.</li>
              <li><code>railpulse_admin_authenticated</code>: Session flag for authorized railway control room operators.</li>
            </ul>
            <p>
              For complete details, please read our dedicated <Link href="/cookies" className="text-sky-600 dark:text-sky-400 underline font-medium hover:text-sky-500">Cookie Policy</Link>.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              4. External Telemetry and Provider Integrations
            </h2>
            <p>
              To produce arrival predictions, our backend contacts authorized upstream data providers via secure, encrypted HTTPS channels:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li><strong>OpenWeatherMap API:</strong> Queries ambient weather for station coordinates to evaluate fog and precipitation impact. No user data is sent to OpenWeatherMap.</li>
              <li><strong>Official Railway Telemetry (RailRadar / IndianRailAPI):</strong> Queries official train live-running status and timetable stops. No personal data is transmitted.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              5. Your Rights Under DPDPA 2023 and GDPR
            </h2>
            <p>Under applicable data protection legislation, you possess the following rights:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li><strong>Right to Access:</strong> You may request confirmation of any data processed concerning you.</li>
              <li><strong>Right to Correction & Erasure:</strong> You may request deletion of any alert subscription or contact details.</li>
              <li><strong>Right to Withdraw Consent:</strong> You may withdraw consent for transit alerts at any time by unsubscribing.</li>
              <li><strong>Right to Grievance Redressal:</strong> You may file a concern directly with our Grievance Officer.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              6. Data Security Measures
            </h2>
            <p>
              We implement industry-standard security safeguards to protect all transit queries:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>Full Transport Layer Security (TLS 1.3) encryption across all endpoints.</li>
              <li>Automated redaction of subscriber phone numbers in API serialization layers.</li>
              <li>Rate limiting via token bucket algorithms to prevent brute-force attacks and abuse.</li>
              <li>No permanent public exposure of database connections or server secrets.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              7. Grievance Officer & Contact Information
            </h2>
            <p>
              In accordance with the <em>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</em> and the <em>Digital Personal Data Protection Act, 2023</em>, for any inquiries, privacy concerns, or data deletion requests, please contact:
            </p>
            <div className="bg-slate-100 dark:bg-slate-800/70 p-4 rounded-xl text-xs font-mono space-y-1 text-slate-700 dark:text-slate-300">
              <div><strong>Grievance & Privacy Officer:</strong> Technical Lead, Namaste Rail Project</div>
              <div><strong>Organization:</strong> Smart India Hackathon 2026 Team (SIH_202)</div>
              <div><strong>Email:</strong> privacy@namaste-rail.internal (or project repository issues)</div>
              <div><strong>Jurisdiction:</strong> New Delhi, India</div>
              <div><strong>Response Window:</strong> Within 48 hours for acknowledgment; 30 days for resolution</div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
