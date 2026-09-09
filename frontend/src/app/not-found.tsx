import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page-grid bg-[#061521] text-slate-50 min-h-screen flex flex-col font-sans selection:bg-cyan-500/30 items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center">
        <div className="w-[80%] h-[80%] rounded-full bg-cyan-900/10 blur-[120px]" />
      </div>

      <div className="glass-card max-w-lg w-full p-10 rounded-3xl text-center relative z-10 animate-fade-in-up border border-slate-800/80">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-gradient">
          404 - Track Not Found
        </h1>
        
        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          Looks like this train route doesn&apos;t exist or the page has been moved to another platform.
        </p>

        <Link 
          href="/" 
          className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 py-3.5 rounded-xl font-semibold transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Terminal
        </Link>
      </div>
    </div>
  );
}
