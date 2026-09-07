
{/* TopNavBar */}
<header className="bg-primary dark:bg-primary-container border-b border-outline-variant dark:border-outline z-20 relative">
<div className="flex justify-between items-center w-full px-margin-desktop max-w-container-max mx-auto h-16">
<div className="flex items-center gap-8">
<a className="text-headline-lg font-headline-lg font-bold text-on-primary dark:text-primary-fixed-dim" href="#">RailETA</a>
<nav className="hidden md:flex gap-6">
<a className="text-on-primary border-b-2 border-on-primary pb-1 font-bold text-label-caps font-label-caps uppercase tracking-wider transition-colors duration-200" href="#">Home</a>
<a className="text-on-primary-container dark:text-on-primary-fixed-variant hover:text-on-primary hover:bg-primary-container/50 text-label-caps font-label-caps uppercase tracking-wider transition-colors duration-200 py-1 px-2 rounded-DEFAULT" href="#">Live Trains</a>
<a className="text-on-primary-container dark:text-on-primary-fixed-variant hover:text-on-primary hover:bg-primary-container/50 text-label-caps font-label-caps uppercase tracking-wider transition-colors duration-200 py-1 px-2 rounded-DEFAULT" href="#">Simulation</a>
<a className="text-on-primary-container dark:text-on-primary-fixed-variant hover:text-on-primary hover:bg-primary-container/50 text-label-caps font-label-caps uppercase tracking-wider transition-colors duration-200 py-1 px-2 rounded-DEFAULT" href="#">Model Performance</a>
</nav>
</div>
<div className="flex items-center gap-4">
<button className="hidden md:flex items-center gap-2 bg-primary-container text-on-primary hover:opacity-80 scale-95 transition-all duration-200 px-4 py-2 rounded-DEFAULT text-label-caps font-label-caps uppercase">
                    Live System
                    <span className="material-symbols-outlined text-sm" data-icon="train">train</span>
</button>
<button className="md:hidden text-on-primary">
<span className="material-symbols-outlined">menu</span>
</button>
</div>
</div>
</header>
{/* Main Content */}
<main className="flex-grow">
{/* Hero & Search Section */}
<section className="relative w-full overflow-hidden min-h-[580px] lg:min-h-[640px] flex items-center justify-center py-16 md:py-24 border-b border-surface-border">
{/* Animated Background Layer */}
<div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
<img alt="Vande Bharat Express Train speeding along tracks" className="w-full h-full object-cover object-center animate-train-motion will-change-transform brightness-105 contrast-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAQ1KCXfrnSFgBQxSklbGlDJ_YznB9VFHzRTaQVngk0n5VKtnDzkIkFlYCgga2vIAXP8yt0D2YKYwiIUtOh1UPhVjrBRzs1y52_1RlW4lMz3x6ko8jH_qe_rN2CHJSsFIRWNVxuFg4g1ZQ6iuGjJXWgu0_mLQIWJgdhNxdTphPwXHii2iBT_hhyhYalb10E5U_tdf5LVhfM7u4G3fn3YFmezioGvSpaWI3dBLUz2sSliVWxiSI37B1o" />
{/* Subtle Speed Motion Blur Overlays */}
<div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
<div className="absolute -inset-x-20 top-1/4 h-2 bg-gradient-to-r from-transparent via-white to-transparent animate-speed-lines"></div>
<div className="absolute -inset-x-20 top-2/3 h-1 bg-gradient-to-r from-transparent via-sky-300 to-transparent animate-speed-lines-delayed"></div>
<div className="absolute -inset-x-20 top-1/2 h-1.5 bg-gradient-to-r from-transparent via-white to-transparent animate-speed-lines"></div>
</div>
{/* Dynamic Luminous Daylight Gradient Overlay (Clear, high-key, luminous with subtle dark tone at center bottom for text readability) */}
<div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/45 to-transparent"></div>
<div className="absolute inset-0 bg-gradient-to-r from-primary/70 via-transparent to-primary/40"></div>
<div className="absolute inset-0 bg-sky-950/20 mix-blend-color"></div>
</div>
{/* Hero Content (Centered with glassmorphism search) */}
<div className="relative z-10 w-full px-margin-desktop max-w-container-max mx-auto flex flex-col items-center text-center">
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-label-caps font-label-caps uppercase tracking-wider mb-6 shadow-sm">
<span className="inline-block w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
            Real-Time AI Train Intelligence
        </div>
<h1 className="text-display-eta font-display-eta text-white max-w-3xl drop-shadow-md text-3xl sm:text-4xl md:text-5xl lg:text-display-eta leading-tight">
            Know when your train will actually arrive.
        </h1>
<p className="text-body-lg font-body-lg text-slate-100 max-w-xl mt-4 drop-shadow">
            Dynamic, explainable ETA forecasts for Indian Railways trains using high-integrity machine learning models.
        </p>
{/* Centered High-Contrast Glass Search Form */}
<div className="w-full max-w-3xl mt-8 bg-surface-elevated/95 backdrop-blur-xl border border-white/70 shadow-2xl rounded-xl p-6 sm:p-7 text-left transition-all relative z-20">
  {/* Search Type Filter Tabs & Telemetry Precision Tag */}
  <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-surface-border/70 gap-3">
    <div className="inline-flex p-1 bg-surface-container rounded-lg gap-1 text-xs font-medium">
      <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-DEFAULT bg-surface-elevated text-primary shadow-sm font-bold tracking-wide transition-all">
        <span className="material-symbols-outlined text-sm text-status-info">directions_transit</span>
        Train No. / Name
      </button>
      <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-DEFAULT text-secondary hover:text-primary transition-all">
        <span className="material-symbols-outlined text-sm">swap_calls</span>
        Station to Station
      </button>
      <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-DEFAULT text-secondary hover:text-primary transition-all">
        <span className="material-symbols-outlined text-sm">radar</span>
        Live Sector Status
      </button>
    </div>
    <div className="inline-flex items-center gap-2 text-xs text-secondary bg-surface-container-low px-3 py-1 rounded-full border border-surface-border">
      <span className="material-symbols-outlined text-sm text-status-success">verified</span>
      <span className="">ML Reliability: <strong className="text-primary font-bold">94.8% (±4.2m)</strong></span>
    </div>
  </div>

  {/* Main Search Form Input Row */}
  <div className="relative flex flex-col sm:flex-row items-stretch gap-2.5">
    <div className="relative flex-grow flex items-center">
      <span className="material-symbols-outlined absolute left-3.5 text-secondary text-xl pointer-events-none">search</span>
      <input id="train-search" type="text" className="w-full bg-surface-container-lowest border border-outline-variant hover:border-primary/50 focus:border-primary rounded-lg pl-11 pr-24 py-3.5 text-body-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" placeholder="Enter train no. (e.g. 12951, 22436) or name (Rajdhani, Vande Bharat)..." value="12951" />
      <div className="absolute right-3 flex items-center gap-1.5">
        <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-data-mono font-bold bg-surface-container text-secondary border border-surface-border">⌘K</span>
        <button type="button" aria-label="Clear input" className="text-secondary hover:text-primary p-0.5 rounded transition-colors">
          <span className="material-symbols-outlined text-base">cancel</span>
        </button>
      </div>
    </div>
    <button type="button" className="bg-primary hover:bg-primary-container text-on-primary px-8 py-3.5 rounded-lg text-label-caps font-label-caps uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95 shrink-0">
      <span className="material-symbols-outlined text-base">speed</span>
      Track Live ETA
    </button>
  </div>

  {/* Rich Autocomplete / Live Match Telemetry Dropdown Card */}
  <div className="mt-3 bg-surface-container-lowest rounded-lg border border-surface-border p-2.5 shadow-sm divide-y divide-surface-border">
    {/* Result 1 (Active Focused Match) */}
    <div className="p-2.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-data-mono text-xs font-bold shrink-0">12951</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-body-sm text-primary">NDLS → MMCT</span>
            <span className="text-xs text-secondary font-medium">• Mumbai Rajdhani Express</span>
          </div>
          <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-status-success">near_me</span>
            Past Surat (ST) • Speed: <span className="font-data-mono font-medium text-on-surface">118 km/h</span> • Platform 1 Forecast
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/10 text-status-success text-[11px] font-bold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse"></span>
          ETA 19:42 (+14m)
        </span>
        <span className="text-label-caps text-[10px] font-bold text-secondary bg-surface-container px-2 py-1 rounded">96% Conf.</span>
      </div>
    </div>
    {/* Result 2 (Alternate Quick Query Match) */}
    <div className="p-2.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 opacity-90">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-surface-container text-secondary flex items-center justify-center font-data-mono text-xs font-bold shrink-0">22436</span>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-body-sm text-primary">NDLS → BSB</span>
            <span className="text-xs text-secondary font-medium">• Vande Bharat Express</span>
          </div>
          <p className="text-xs text-secondary mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] text-status-info">navigation</span>
            Approaching Kanpur Central (CNB) • Track Clear
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/10 text-status-success text-[11px] font-bold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
          On Schedule (14:08)
        </span>
        <span className="text-label-caps text-[10px] font-bold text-secondary bg-surface-container px-2 py-1 rounded">99% Conf.</span>
      </div>
    </div>
  </div>

  {/* Upgraded Trending Quick Filters with Status Dots */}
  <div className="mt-3.5 pt-3 border-t border-surface-border flex flex-wrap items-center gap-2 text-xs text-secondary">
    <span className="font-bold text-secondary uppercase text-[10px] tracking-wider flex items-center gap-1">
      <span className="material-symbols-outlined text-xs">trending_up</span>
      Trending Express:
    </span>
    <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-variant text-primary font-medium transition-colors border border-surface-border">
      <span className="w-1.5 h-1.5 rounded-full bg-status-warning"></span>
      <span className="">12951 Rajdhani</span>
      <span className="text-[10px] text-secondary font-data-mono">+14m</span>
    </button>
    <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-variant text-primary font-medium transition-colors border border-surface-border">
      <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
      <span className="">22436 Vande Bharat</span>
      <span className="text-[10px] text-status-success font-data-mono">On Time</span>
    </button>
    <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-variant text-primary font-medium transition-colors border border-surface-border">
      <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
      <span className="">12004 Shatabdi</span>
      <span className="text-[10px] text-status-success font-data-mono">On Time</span>
    </button>
    <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-variant text-primary font-medium transition-colors border border-surface-border">
      <span className="w-1.5 h-1.5 rounded-full bg-status-error"></span>
      <span className="">12809 Howrah Mail</span>
      <span className="text-[10px] text-status-error font-data-mono">+42m</span>
    </button>
  </div>
</div>
</div>
</section>
{/* Live Network Summary */}
<section className="bg-surface-container-lowest border-y border-surface-border py-6 shadow-sm">
  <div className="w-full px-margin-desktop max-w-container-max mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
    {/* Left Status Telemetry Info */}
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2.5 bg-status-success/10 border border-status-success/20 px-3 py-1.5 rounded-full">
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-success"></span>
        </div>
        <span className="text-label-caps font-label-caps text-primary uppercase font-bold tracking-widest">National Rail Telemetry Feed</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-secondary">
        <span className="material-symbols-outlined text-sm text-secondary">schedule</span>
        <span className="">Updated <strong className="text-primary font-data-mono">12s ago</strong> via CRIS/NTES Hub</span>
      </div>
    </div>

    {/* Right Live Numerical Metrics with Visual Ratio Bar */}
    <div className="flex flex-wrap items-center gap-6 sm:gap-10 w-full lg:w-auto justify-between lg:justify-end">
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg font-headline-lg font-bold text-primary">1,327</span>
          <span className="text-[10px] text-secondary font-semibold uppercase">Trains</span>
        </div>
        <span className="text-label-caps font-label-caps text-secondary uppercase text-[10px]">Active in Transit</span>
      </div>

      <div className="h-8 w-px bg-surface-border hidden sm:block"></div>

      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg font-headline-lg font-bold text-status-success">494</span>
          <span className="text-xs font-bold text-status-success">(37.2%)</span>
        </div>
        <span className="text-label-caps font-label-caps text-secondary uppercase text-[10px]">On Schedule (±5m)</span>
      </div>

      <div className="h-8 w-px bg-surface-border hidden sm:block"></div>

      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-headline-lg font-headline-lg font-bold text-status-error">833</span>
          <span className="text-xs font-bold text-status-error">(62.8%)</span>
        </div>
        <span className="text-label-caps font-label-caps text-secondary uppercase text-[10px]">Cascading Delay</span>
      </div>

      <div className="hidden md:flex flex-col w-36 gap-1">
        <div className="flex justify-between text-[10px] font-bold text-secondary uppercase">
          <span className="">Network Punctuality</span>
          <span className="text-primary font-data-mono">37%</span>
        </div>
        <div className="w-full h-2 bg-status-error/20 rounded-full overflow-hidden flex">
          <div className="bg-status-success h-full" style={{"width": "37.2%"}}></div>
          <div className="bg-status-warning h-full" style={{"width": "24.5%"}}></div>
          <div className="bg-status-error h-full" style={{"width": "38.3%"}}></div>
        </div>
      </div>
    </div>
  </div>
</section>
{/* How It Works & Popular Trains Bento */}
<section className="w-full px-margin-desktop max-w-container-max mx-auto py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-8">
{/* How It Works */}
<div className="lg:col-span-5 bg-surface-elevated border border-surface-border rounded-xl p-7 flex flex-col gap-6 shadow-sm">
  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-primary text-xl">memory</span>
      <h2 className="text-headline-md font-headline-md text-primary">How RailETA Works</h2>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-wider bg-surface-container text-secondary px-2 py-1 rounded">Pipelines v4.2</span>
  </div>
  <div className="flex flex-col gap-5 relative">
    <div className="absolute left-[13px] top-4 bottom-4 w-[2px] bg-surface-border"></div>
    
    {/* Step 1 */}
    <div className="flex gap-3.5 relative z-10">
      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
        <span className="text-[11px] font-bold text-on-primary font-data-mono">1</span>
      </div>
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-3 flex-grow">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-body-sm font-bold text-primary">Current State Ingestion</h3>
          <span className="text-[10px] font-bold text-status-info uppercase bg-status-info/10 px-1.5 py-0.5 rounded">NTES API</span>
        </div>
        <p className="text-body-sm text-secondary">Ingesting real-time GPS telemetry, section block occupation, and train speeds every 30s.</p>
      </div>
    </div>

    {/* Step 2 */}
    <div className="flex gap-3.5 relative z-10">
      <div className="w-7 h-7 rounded-full bg-surface-container border-2 border-primary flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-primary font-data-mono">2</span>
      </div>
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-3 flex-grow">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-body-sm font-bold text-primary">Historical Sector Dynamics</h3>
          <span className="text-[10px] font-bold text-secondary uppercase bg-surface-container px-1.5 py-0.5 rounded">5Y Dataset</span>
        </div>
        <p className="text-body-sm text-secondary">Cross-referencing historical bottlenecks, crossing conflicts, weather delays, and seasonal peak factors.</p>
      </div>
    </div>

    {/* Step 3 */}
    <div className="flex gap-3.5 relative z-10">
      <div className="w-7 h-7 rounded-full bg-surface-container border-2 border-primary flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-primary font-data-mono">3</span>
      </div>
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-3 flex-grow">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-body-sm font-bold text-primary">Gradient Boosting Engine</h3>
          <span className="text-[10px] font-bold text-status-success uppercase bg-status-success/10 px-1.5 py-0.5 rounded">LightGBM</span>
        </div>
        <p className="text-body-sm text-secondary">Modeling cascade networks with SHAP feature explainability to quantify delay factors.</p>
      </div>
    </div>

    {/* Step 4 */}
    <div className="flex gap-3.5 relative z-10">
      <div className="w-7 h-7 rounded-full bg-surface-container border-2 border-primary flex items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-primary font-data-mono">4</span>
      </div>
      <div className="bg-surface-container-lowest border border-surface-border rounded-lg p-3 flex-grow">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-body-sm font-bold text-primary">Dynamic ETA &amp; Bounds</h3>
          <span className="text-[10px] font-bold text-primary uppercase bg-primary-fixed px-1.5 py-0.5 rounded">High Confidence</span>
        </div>
        <p className="text-body-sm text-secondary">Providing minute-accurate arrival windows, platform forecasts, and reliability intervals.</p>
      </div>
    </div>
  </div>
</div>
{/* Popular Live Trains */}
<div className="lg:col-span-7 bg-surface-elevated border border-surface-border rounded-xl p-0 overflow-hidden flex flex-col shadow-sm">
  <div className="p-5 border-b border-surface-border bg-surface-container-lowest flex flex-wrap justify-between items-center gap-3">
    <div>
      <h2 className="text-headline-md font-headline-md text-primary flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-xl">train</span>
        Popular Live Trains
      </h2>
      <p className="text-xs text-secondary mt-0.5">Live predictive arrival times across high-frequency corridors</p>
    </div>
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-container text-xs text-secondary font-medium">
        <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
        Live Syncing
      </span>
    </div>
  </div>
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-surface-bright border-b border-surface-border">
          <th className="px-5 py-3.5 text-label-caps font-label-caps text-secondary uppercase font-bold">Train &amp; Route</th>
          <th className="px-5 py-3.5 text-label-caps font-label-caps text-secondary uppercase font-bold">Current Sector</th>
          <th className="px-5 py-3.5 text-label-caps font-label-caps text-secondary uppercase font-bold">AI Status</th>
          <th className="px-5 py-3.5 text-label-caps font-label-caps text-secondary uppercase font-bold text-right">Next ETA</th>
          <th className="px-4 py-3.5 text-label-caps font-label-caps text-secondary uppercase font-bold text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y border-surface-border">
        <tr className="hover:bg-surface-container-lowest transition-colors group">
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-data-mono font-bold text-xs bg-primary/10 text-primary px-2 py-1 rounded">12951</span>
              <div>
                <span className="font-bold text-body-sm text-primary block leading-tight">Mumbai Rajdhani</span>
                <span className="text-[11px] text-secondary font-medium">NDLS → MMCT (86% completed)</span>
              </div>
            </div>
          </td>
          <td className="px-5 py-3.5">
            <span className="text-body-sm font-medium text-on-surface block">Surat (ST)</span>
            <span className="text-[10px] text-secondary font-data-mono">Speed: 118 km/h</span>
          </td>
          <td className="px-5 py-3.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-error/10 text-status-error text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-status-error"></span>
              +14m Late
            </span>
          </td>
          <td className="px-5 py-3.5 text-right">
            <span className="text-body-lg font-data-mono font-bold text-primary block">19:42</span>
            <span className="text-[10px] text-secondary font-medium">Sched: 19:28</span>
          </td>
          <td className="px-4 py-3.5 text-center">
            <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs font-semibold transition-all">
              <span className="">Inspect</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </td>
        </tr>
        <tr className="hover:bg-surface-container-lowest transition-colors group">
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-data-mono font-bold text-xs bg-status-success/15 text-status-success px-2 py-1 rounded">12004</span>
              <div>
                <span className="font-bold text-body-sm text-primary block leading-tight">Shatabdi Express</span>
                <span className="text-[11px] text-secondary font-medium">NDLS → LKO (62% completed)</span>
              </div>
            </div>
          </td>
          <td className="px-5 py-3.5">
            <span className="text-body-sm font-medium text-on-surface block">Kanpur (CNB)</span>
            <span className="text-[10px] text-secondary font-data-mono">Speed: 104 km/h</span>
          </td>
          <td className="px-5 py-3.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-success/10 text-status-success text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
              On Time
            </span>
          </td>
          <td className="px-5 py-3.5 text-right">
            <span className="text-body-lg font-data-mono font-bold text-primary block">08:15</span>
            <span className="text-[10px] text-status-success font-medium">Target accurate</span>
          </td>
          <td className="px-4 py-3.5 text-center">
            <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs font-semibold transition-all">
              <span className="">Inspect</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </td>
        </tr>
        <tr className="hover:bg-surface-container-lowest transition-colors group">
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-data-mono font-bold text-xs bg-status-warning/15 text-status-warning px-2 py-1 rounded">12627</span>
              <div>
                <span className="font-bold text-body-sm text-primary block leading-tight">Karnataka Express</span>
                <span className="text-[11px] text-secondary font-medium">SBC → NDLS (44% completed)</span>
              </div>
            </div>
          </td>
          <td className="px-5 py-3.5">
            <span className="text-body-sm font-medium text-on-surface block">Itarsi (ET)</span>
            <span className="text-[10px] text-secondary font-data-mono">Speed: 92 km/h</span>
          </td>
          <td className="px-5 py-3.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-warning/10 text-status-warning text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-status-warning"></span>
              +4m Late
            </span>
          </td>
          <td className="px-5 py-3.5 text-right">
            <span className="text-body-lg font-data-mono font-bold text-primary block">14:30</span>
            <span className="text-[10px] text-secondary font-medium">Sched: 14:26</span>
          </td>
          <td className="px-4 py-3.5 text-center">
            <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs font-semibold transition-all">
              <span className="">Inspect</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </td>
        </tr>
        <tr className="hover:bg-surface-container-lowest transition-colors group">
          <td className="px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="font-data-mono font-bold text-xs bg-status-error/15 text-status-error px-2 py-1 rounded">12809</span>
              <div>
                <span className="font-bold text-body-sm text-primary block leading-tight">Howrah Mail</span>
                <span className="text-[11px] text-secondary font-medium">CSMT → HWH (71% completed)</span>
              </div>
            </div>
          </td>
          <td className="px-5 py-3.5">
            <span className="text-body-sm font-medium text-on-surface block">Nagpur (NGP)</span>
            <span className="text-[10px] text-secondary font-data-mono">Speed: 68 km/h</span>
          </td>
          <td className="px-5 py-3.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-status-error/10 text-status-error text-[11px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-status-error"></span>
              +42m Late
            </span>
          </td>
          <td className="px-5 py-3.5 text-right">
            <span className="text-body-lg font-data-mono font-bold text-primary block">21:15</span>
            <span className="text-[10px] text-secondary font-medium">Sched: 20:33</span>
          </td>
          <td className="px-4 py-3.5 text-center">
            <button type="button" className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs font-semibold transition-all">
              <span className="">Inspect</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
</section>
</main>
{/* Footer */}
<footer className="bg-surface-container dark:bg-surface-container-highest border-t border-surface-border dark:border-outline-variant mt-auto">
<div className="flex flex-col md:flex-row justify-between items-center w-full px-margin-desktop py-8 max-w-container-max mx-auto gap-4">
<div className="flex items-center gap-2">
<span className="text-label-caps font-label-caps font-bold text-primary uppercase">RailETA</span>
<span className="text-body-sm font-body-sm text-on-surface-variant dark:text-surface-variant">© 2024 RailETA ML Forecasting. Built for High-Integrity Logistics.</span>
</div>
<nav className="flex gap-6">
<a className="text-secondary dark:text-secondary-fixed-dim hover:text-primary text-label-caps font-label-caps hover:underline decoration-primary transition-all uppercase focus:outline-none focus:ring-1 focus:ring-primary rounded-sm px-1" href="#">About</a>
<a className="text-secondary dark:text-secondary-fixed-dim hover:text-primary text-label-caps font-label-caps hover:underline decoration-primary transition-all uppercase focus:outline-none focus:ring-1 focus:ring-primary rounded-sm px-1" href="#">How It Works</a>
<a className="text-secondary dark:text-secondary-fixed-dim hover:text-primary text-label-caps font-label-caps hover:underline decoration-primary transition-all uppercase focus:outline-none focus:ring-1 focus:ring-primary rounded-sm px-1" href="#">Hackathon Attribution</a>
</nav>
</div>
</footer>



