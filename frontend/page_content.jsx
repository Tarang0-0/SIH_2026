
{/* Navigation Component from JSON */}
<header className="bg-transparent docked full-width top-0 z-50 absolute w-full transition-all duration-300" id="main-nav">
<div className="flex justify-between items-center w-full px-container-margin py-4 max-w-7xl mx-auto">
<div className="flex items-center gap-2 text-headline-md font-headline-md font-bold text-primary dark:text-primary-fixed">
<span className="material-symbols-outlined" style={{ fontVariationSettings: "\'FILL\' 1" }}>train</span>
        RailPulse
      </div>
<nav className="hidden md:flex gap-8">
{/* Not actively on these pages, so rendering inactive state */}
<a className="text-on-surface-variant font-label-md text-label-md hover:text-secondary-container transition-colors duration-200" href="#">Features</a>
<a className="text-on-surface-variant font-label-md text-label-md hover:text-secondary-container transition-colors duration-200" href="#">How it Works</a>
</nav>
<button className="bg-primary-container text-on-primary hover:bg-opacity-90 transition-colors font-label-md text-label-md px-6 py-2 rounded-full">
        App Download
      </button>
</div>
</header>
{/* Main Content Canvas */}
<main className="flex-grow flex flex-col">
{/* Hero Section */}
<section className="relative w-full h-[600px] md:h-[700px] flex items-center bg-primary">
{/* Background Image from DataStore */}
<div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: "url(\'https://lh3.googleusercontent.com/aida/AEtjO1XkKJLtutxIMb3rxmfUKL2qEcE4lONblxvbBqnXO8ZMm_eL5OEQ4IB_BWwN5dV7ka3C924Yv9uBi0VSScJW1P56hBOZzQFJv4V84XTaCmg0bp9-KBP1TPLjxrXYVGb5PAKn3OAeMLcwkhVHm6TBb-qy3GvpKvACWMT_UcuslnBADGuyjAVKX0cboylH0bmaHlGu0W0OTWo152JQN-qn414KPmyqeCORcmR5YXIUa5BXrUKsq8ipKg3Nhhs\')" }}></div>
<div className="absolute inset-0 hero-overlay"></div>
<div className="relative z-10 w-full max-w-7xl mx-auto px-container-margin pt-20">
<div className="max-w-2xl text-on-primary">
<h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg mb-6 leading-tight">
            Know exactly when your train arrives.<br />
<span className="text-secondary-fixed-dim">Not just when it should.</span>
</h1>
<p className="font-body-lg text-body-lg text-primary-fixed mb-8 max-w-xl opacity-90">
            Precision transit intelligence powered by real-time data science. Stop guessing, start tracking.
          </p>
{/* Search Interactive Area */}
<div className="bg-surface-container-lowest p-card-padding rounded-xl soft-shadow mb-4">
<div className="flex items-center border border-outline rounded-lg bg-surface px-4 py-2 focus-within:border-primary-container focus-within:ring-1 focus-within:ring-primary-container transition-all">
<span className="material-symbols-outlined text-outline-variant mr-3" data-icon="search">search</span>
<input className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-md text-body-md placeholder-outline-variant p-1 outline-none" placeholder="Track Train by Number or Station..." type="text" />
<button className="bg-secondary-container text-on-secondary-container font-label-md text-label-md px-4 py-2 rounded-md ml-2 hover:opacity-90 transition-opacity">
                Track
              </button>
</div>
<div className="mt-4 flex items-center gap-3 overflow-x-auto pb-1">
<span className="font-label-sm text-label-sm text-outline shrink-0">Popular:</span>
<button className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-3 py-1 rounded-full whitespace-nowrap hover:bg-surface-dim transition-colors">12951 Rajdhani</button>
<button className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-3 py-1 rounded-full whitespace-nowrap hover:bg-surface-dim transition-colors">Vande Bharat</button>
<button className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-3 py-1 rounded-full whitespace-nowrap hover:bg-surface-dim transition-colors">NDLS to MMCT</button>
</div>
</div>
</div>
</div>
</section>
{/* Stats Bar */}
<section className="bg-surface-container-lowest border-b border-outline-variant relative z-20 -mt-10 mx-container-margin md:mx-auto max-w-5xl rounded-xl soft-shadow">
<div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
<div className="p-6 text-center flex flex-col items-center justify-center">
<span className="text-primary-container font-headline-md text-headline-md mb-1">1,240+</span>
<span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Live Trains</span>
</div>
<div className="p-6 text-center flex flex-col items-center justify-center">
<span className="text-on-tertiary-container font-headline-md text-headline-md mb-1">98.4%</span>
<span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">AI Accuracy</span>
</div>
<div className="p-6 text-center flex flex-col items-center justify-center">
<span className="text-secondary-container font-headline-md text-headline-md mb-1">45ms</span>
<span className="text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">Avg. Latency</span>
</div>
</div>
</section>
{/* How It Works Section */}
<section className="py-20 px-container-margin max-w-7xl mx-auto w-full">
<div className="text-center mb-16">
<h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface mb-4">Intelligence in 3 Steps</h2>
<p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">From unstructured railway data to precise, actionable insights in milliseconds.</p>
</div>
<div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
{/* Connecting Line for Web */}
<div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-surface-variant z-0 border-t-2 border-dashed border-outline-variant"></div>
{/* Step 1 */}
<div className="relative z-10 flex flex-col items-center text-center group">
<div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6 group-hover:bg-primary-fixed transition-colors duration-300">
<span className="material-symbols-outlined text-4xl text-primary" data-icon="search" style={{ fontSize: "36px" }}>search</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface mb-2">Search</h3>
<p className="font-body-md text-body-md text-on-surface-variant">Enter train number or station into our high-speed query engine.</p>
</div>
{/* Step 2 */}
<div className="relative z-10 flex flex-col items-center text-center group">
<div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6 group-hover:bg-primary-fixed transition-colors duration-300">
<span className="material-symbols-outlined text-4xl text-primary" data-icon="memory" style={{ fontSize: "36px" }}>memory</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface mb-2">AI Analyzes</h3>
<p className="font-body-md text-body-md text-on-surface-variant">Our algorithms process real-time geospatial and operational network data.</p>
</div>
{/* Step 3 */}
<div className="relative z-10 flex flex-col items-center text-center group">
<div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6 group-hover:bg-primary-fixed transition-colors duration-300">
<span className="material-symbols-outlined text-4xl text-primary" data-icon="timer" style={{ fontSize: "36px" }}>timer</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface mb-2">Get Precise ETA</h3>
<p className="font-body-md text-body-md text-on-surface-variant">Receive minute-by-minute updates and predictive delay forecasting.</p>
</div>
</div>
</section>
{/* Features Bento Grid */}
<section className="py-16 bg-surface-container-low px-container-margin">
<div className="max-w-7xl mx-auto">
<h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface mb-12 text-center">Platform Capabilities</h2>
<div className="grid grid-cols-1 md:grid-cols-12 gap-6">
{/* Feature 1: Large Card */}
<div className="md:col-span-8 bg-surface-container-lowest rounded-2xl p-8 soft-shadow border border-surface-variant flex flex-col md:flex-row gap-8 items-center hover:-translate-y-1 transition-transform duration-300">
<div className="flex-1">
<div className="w-12 h-12 rounded-lg bg-primary-fixed flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-primary-container" data-icon="model_training">model_training</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface mb-3">AI-Powered ETA</h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-6">Predictive modeling leverages historical patterns, seasonal weather data, and current network congestion to provide arrival times far more accurate than traditional schedules.</p>
{/* Mini UI Mockup */}
<div className="bg-surface rounded-lg p-4 border border-outline-variant">
<div className="flex justify-between items-center mb-2">
<span className="font-label-md text-label-md text-on-surface">Scheduled: 14:30</span>
<span className="font-label-md text-label-md text-error">Expected: 14:42</span>
</div>
<div className="w-full bg-surface-variant rounded-full h-1.5 mb-1">
<div className="bg-error h-1.5 rounded-full" style={{ width: "85%" }}></div>
</div>
<div className="flex justify-end">
<span className="font-label-sm text-label-sm text-on-surface-variant">+12m delay predicted by AI</span>
</div>
</div>
</div>
</div>
{/* Feature 2: Tall Card */}
<div className="md:col-span-4 bg-surface-container-lowest rounded-2xl p-8 soft-shadow border border-surface-variant flex flex-col hover:-translate-y-1 transition-transform duration-300">
<div className="w-12 h-12 rounded-lg bg-surface-variant flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-on-surface-variant" data-icon="troubleshoot">troubleshoot</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface mb-3">Explainable Delays</h3>
<p className="font-body-md text-body-md text-on-surface-variant flex-grow">Understand exactly why a train is late. Our system categorizes root-cause insights so you aren't left in the dark.</p>
<div className="mt-6 space-y-3">
<div className="flex items-center gap-3 p-3 rounded-md bg-surface border border-outline-variant">
<div className="w-2 h-10 bg-secondary rounded-full"></div>
<div>
<div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Reason</div>
<div className="font-label-md text-label-md text-on-surface">Signal Failure at Junction B</div>
</div>
</div>
<div className="flex items-center gap-3 p-3 rounded-md bg-surface border border-outline-variant">
<div className="w-2 h-10 bg-primary rounded-full"></div>
<div>
<div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Impact</div>
<div className="font-label-md text-label-md text-on-surface">Moderate clearance pacing</div>
</div>
</div>
</div>
</div>
{/* Feature 3: Wide Bottom Card */}
<div className="md:col-span-12 bg-surface-container-lowest rounded-2xl p-8 soft-shadow border border-surface-variant flex flex-col md:flex-row items-center justify-between hover:-translate-y-1 transition-transform duration-300">
<div className="max-w-xl mb-6 md:mb-0">
<div className="w-12 h-12 rounded-lg bg-tertiary-fixed-dim flex items-center justify-center mb-4">
<span className="material-symbols-outlined text-tertiary-container" data-icon="map">map</span>
</div>
<h3 className="font-headline-md text-headline-md text-on-surface mb-3">Real-Time Geographic Map</h3>
<p className="font-body-md text-body-md text-on-surface-variant">High-performance geographic interface for total situational awareness. Track train nodes moving along the corridor live.</p>
</div>
<button className="bg-transparent border-2 border-primary-container text-primary-container hover:bg-primary-container hover:text-on-primary transition-colors font-label-md text-label-md px-6 py-3 rounded-lg flex items-center gap-2">
              Explore Live Map <span className="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
</button>
</div>
</div>
</div>
</section>
{/* Visual Map Section (Dark Theme aesthetic within light mode layout) */}
<section className="py-20 px-container-margin bg-inverse-surface text-inverse-on-surface w-full overflow-hidden relative">
{/* Decorative abstract map grid background */}
<div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>
<div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row items-center gap-12">
<div className="lg:w-1/3">
<h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-primary mb-4">Visualize the Network</h2>
<p className="font-body-md text-body-md text-primary-fixed-dim mb-8">See the heartbeat of the transit system. Watch TR-882 and thousands of others navigate complex corridors in real-time.</p>
<div className="bg-[#1e1e1e] border border-[#333] p-4 rounded-xl max-w-sm">
<div className="flex justify-between items-center mb-4">
<span className="font-label-md text-label-md text-on-primary">TR-882 Status</span>
<span className="flex h-3 w-3 relative">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-fixed-dim opacity-75"></span>
<span className="relative inline-flex rounded-full h-3 w-3 bg-tertiary-fixed-dim"></span>
</span>
</div>
<div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#333] before:to-transparent">
<div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
<div className="flex items-center justify-center w-5 h-5 rounded-full border border-primary-fixed bg-[#1e1e1e] text-primary-fixed shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
</div>
<div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-2">
<div className="font-label-md text-label-md text-on-primary">Station A</div>
<div className="font-label-sm text-label-sm text-primary-fixed-dim">Departed 10:15</div>
</div>
</div>
<div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
<div className="flex items-center justify-center w-5 h-5 rounded-full border border-primary bg-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
<span className="material-symbols-outlined text-[12px] text-on-primary">train</span>
</div>
<div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-2 bg-[#2a2a2a] rounded shadow">
<div className="font-label-md text-label-md text-on-primary">Current Location</div>
<div className="font-label-sm text-label-sm text-tertiary-fixed-dim">Speed: 110 km/h</div>
</div>
</div>
</div>
</div>
</div>
{/* Abstract Map Representation Area */}
<div className="lg:w-2/3 w-full h-[400px] bg-[#121212] rounded-2xl border border-[#333] relative overflow-hidden shadow-2xl flex items-center justify-center">
{/* Simulated Map Canvas - keeping simple structural elements to imply complex map without heavy assets */}
<div className="absolute w-[150%] h-[150%] border border-[#222] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"></div>
<div className="absolute w-[100%] h-[100%] border border-[#222] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30"></div>
<div className="absolute w-[50%] h-[50%] border border-[#222] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-40"></div>
{/* Simulated route path */}
<svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
<path d="M -100 300 Q 200 400 400 200 T 900 100" fill="none" stroke="#333" strokeDasharray="5,5" strokeWidth="2" />
<path d="M -100 300 Q 200 400 400 200" fill="none" stroke="#4c56af" strokeWidth="4" />
</svg>
{/* Train Node Blip */}
<div className="absolute top-[48%] left-[45%] w-8 h-8 -ml-4 -mt-4 flex items-center justify-center">
<div className="absolute inset-0 bg-tertiary-fixed-dim rounded-full animate-ping opacity-50"></div>
<div className="relative w-4 h-4 bg-tertiary-fixed-dim rounded-full shadow-[0_0_10px_#88d982]"></div>
<div className="absolute top-full mt-1 bg-[#222] text-on-primary text-[10px] px-2 py-0.5 rounded font-mono border border-[#444]">TR-882</div>
</div>
<div className="absolute bottom-4 right-4 bg-[#1a1a1a] border border-[#333] px-3 py-1.5 rounded-md text-[#888] font-label-sm text-[10px] uppercase tracking-widest flex items-center gap-2">
<span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span> System Live
            </div>
</div>
</div>
</section>
</main>
{/* Footer Component from JSON */}
<footer className="bg-surface-container-lowest dark:bg-inverse-surface border-t border-outline-variant full-width">
<div className="flex flex-col md:flex-row justify-between items-center w-full px-container-margin py-8 max-w-7xl mx-auto">
<div className="flex flex-col items-center md:items-start mb-6 md:mb-0 text-center md:text-left">
<div className="text-headline-md font-headline-md font-bold text-primary dark:text-primary-fixed-dim mb-2">
          RailPulse
        </div>
<div className="font-body-md text-body-md text-on-surface-variant max-w-xs">
          © 2024 RailPulse India. Precision Transit Intelligence.
        </div>
</div>
<nav className="flex flex-wrap justify-center gap-6">
<a className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded" href="#">Privacy Policy</a>
<a className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded" href="#">Terms of Service</a>
<a className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded" href="#">Contact Us</a>
<a className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded" href="#">Press Kit</a>
</nav>
</div>
</footer>


