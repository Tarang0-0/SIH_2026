export default function Loading() {
  return (
    <div className="page-grid bg-[#061521] text-slate-50 min-h-screen flex flex-col font-sans items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex items-center justify-center">
        <div className="w-[80%] h-[80%] rounded-full bg-cyan-900/10 blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-6"></div>
        <div className="text-cyan-400 font-bold tracking-widest text-sm uppercase animate-pulse">
          Connecting to Namaste Rail Network...
        </div>
        <div className="text-slate-500 text-xs mt-3 font-mono">
          Authenticating telemetry streams
        </div>
      </div>
    </div>
  );
}
