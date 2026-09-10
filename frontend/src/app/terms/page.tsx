'use client';

import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useLanguage } from '../components/LanguageContext';

export default function TermsPage() {
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
            <li className="text-slate-900 dark:text-white font-semibold">{t('terms_title', 'Terms & Conditions')}</li>
          </ol>
        </nav>

        <header className="border-b border-sky-200/80 dark:border-sky-900/60 pb-8 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>SIH 2026 Academic & Research Prototype</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            {t('terms_title', 'Terms & Conditions')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t('last_updated', 'Last Updated: September 10, 2026 • Effective Date: September 10, 2026')}
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              1. Acceptance of Terms & Nature of the Service
            </h2>
            <p>
              By accessing, browsing, or utilizing the <strong>Namaste Rail</strong> website, API, or dashboards, you acknowledge and agree to be bound by these Terms and Conditions.
            </p>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs sm:text-sm text-amber-900 dark:text-amber-300/90 leading-relaxed">
              <strong>Crucial Disclaimer:</strong> Namaste Rail is an innovative software prototype built for the <strong>Smart India Hackathon (SIH 2026)</strong> under the Ministry of Railways / CRIS theme. It provides machine learning-driven statistical estimates of railway transit times. It is <strong>not</strong> an official railway signaling system or an authoritative government communication channel.
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              2. Probabilistic Estimations & Disclaimer of Warranties
            </h2>
            <p>
              All arrival times, delay forecasts, and confidence intervals displayed on this platform are generated via gradient-boosted decision trees (XGBoost) and empirical uncertainty models. You expressly understand and agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>
                <strong>No Arrival Guarantees:</strong> Railway operations in India are subject to unexpected real-time conditions including signal failures, track maintenance blocks, severe weather, freight priority dispatching, and emergency safety interventions.
              </li>
              <li>
                <strong>Confidence Intervals ($P_{10} - P_{90}$):</strong> Predictions represent statistical bounds, where $P_{10}$ reflects an optimistic clear-track scenario and $P_{90}$ reflects a high-congestion scenario. They are not deterministic commitments.
              </li>
              <li>
                <strong>Official Verification Mandatory:</strong> For flight connections, medical appointments, or time-sensitive commitments, passengers must always consult official railway platforms (e.g. NTES, 139 helpline, or station platform announcements).
              </li>
              <li>
                <strong>&quot;As-Is&quot; Provision:</strong> The service is provided strictly on an &quot;as-is&quot; and &quot;as-available&quot; basis without warranties of any kind, whether express, statutory, or implied.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              3. Intellectual Property, Trademarks & Non-Affiliation
            </h2>
            <p>
              We respect government intellectual property and maintain strict institutional transparency:
            </p>
            <div className="bg-slate-100 dark:bg-slate-800/60 p-4 rounded-xl space-y-2 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              <p>
                <strong>Trademark Notice:</strong> <em>Indian Railways, IRCTC, NTES, CRIS (Centre for Railway Information Systems), and RTIS (Real-Time Train Information System)</em> are registered trademarks and property of the Ministry of Railways, Government of India.
              </p>
              <p>
                <strong>Non-Affiliation:</strong> Namaste Rail is an independent, non-commercial hackathon submission and research project. It is <strong>not affiliated with, sponsored by, authorized by, or endorsed by</strong> the Ministry of Railways, IRCTC, or CRIS.
              </p>
              <p>
                <strong>Software License:</strong> The software, predictive pipelines, and UI source code are made available under the <strong>MIT License</strong>. You are free to inspect, audit, and modify the code in accordance with the license.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              4. Acceptable Use Policy
            </h2>
            <p>Users of the website and public APIs agree to comply with the following acceptable use rules:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>Do not attempt denial-of-service attacks, port scanning, or malicious socket flooding.</li>
              <li>Adhere to the rate limit of 120 requests per minute per IP address.</li>
              <li>Do not scrape personal data or attempt reverse-engineering of private backend keys.</li>
              <li>Do not impersonate railway control room officers or submit fabricated operational incident reports.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              5. Limitation of Liability
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              To the maximum extent permitted by applicable Indian law (including the <em>Information Technology Act, 2000</em>), neither the developers, student contributors, nor associated institutions shall be liable for any direct, indirect, incidental, special, consequential, or punitive damages resulting from:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>Missed train departures, missed transit connections, or hotel/flight rebooking expenses.</li>
              <li>Inaccuracies, omissions, or outages in upstream third-party weather or telemetry feeds.</li>
              <li>Platform downtime, maintenance interruptions, or rate-limiting enforcement.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              6. Governing Law & Dispute Resolution
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              These Terms and Conditions shall be governed by and construed in accordance with the laws of the <strong>Republic of India</strong>. Any dispute, claim, or controversy arising out of or relating to these terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>New Delhi, India</strong>.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              7. Contact for Legal Inquiries
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              If you have any questions or notice any intellectual property concerns regarding these Terms, please contact our team lead at <code>legal@namaste-rail.internal</code> or open an issue on the public project repository.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
