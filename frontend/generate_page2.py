import re

with open("page_jsx.txt", "r") as f:
    jsx = f.read()

# For the input replacement, we want to replace only the specific input.
# Find the exact input string.
input_str = re.search(r'<input[^>]*placeholder="Enter Train Number or Station Name"[^>]*>', jsx).group(0)

input_replacement = """<input className="w-full pl-12 pr-4 py-4 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-[#00e5ff] focus:border-[#00e5ff] transition-all shadow-sm" placeholder="Enter Train Number or Station Name" type="text"
    value={searchQuery}
    onChange={(e) => {
        setSearchQuery(e.target.value);
        if (e.target.value.length >= 2) {
            fetch(`http://localhost:8000/api/v1/trains/search?q=${e.target.value}`)
                .then(res => res.json())
                .then(data => setSearchResults(data))
                .catch(() => setSearchResults([]));
        } else {
            setSearchResults([]);
        }
        if (e.target.value.length >= 4) {
            fetchHeroPreview(e.target.value);
        }
    }}
    onBlur={() => setTimeout(() => setSearchResults([]), 200)}
    onKeyDown={(e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    }}
/>
{searchResults.length > 0 && (
<div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
    {searchResults.map((train) => (
    <div 
        key={train.train_number}
        onClick={() => {
        setSearchQuery(train.train_number);
        setSearchResults([]);
        fetchHeroPreview(train.train_number);
        }}
        className="px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800 cursor-pointer flex justify-between items-center group transition-colors"
    >
        <div>
        <div className="text-white font-bold">{train.train_number}</div>
        <div className="text-xs text-slate-400 group-hover:text-cyan-400">{train.train_name}</div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono text-right">
        {train.origin} ➔ {train.dest}
        </div>
    </div>
    ))}
</div>
)}"""

jsx = jsx.replace(input_str, input_replacement)

# Replace the exact Track Live button
track_live_match = re.search(r'<button[^>]*cyan-btn[^>]*>.*?Track Live.*?</button>', jsx, re.DOTALL)
if track_live_match:
    track_btn_str = track_live_match.group(0)
    track_live_btn = """<button onClick={handleSearch} className="cyan-btn px-8 py-4 rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-2 whitespace-nowrap shadow-lg">
<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>my_location</span>
    Track Live
</button>"""
    jsx = jsx.replace(track_btn_str, track_live_btn)
else:
    print("Could not find Track Live button")


# Replace "Train 12345 Exp"
jsx = jsx.replace("Train 12345 Exp", "Train {heroData ? heroData.train_number : \"----\"} - {heroData ? heroData.train_name : \"----\"}")
# Replace "Approaching Station XYZ"
jsx = jsx.replace("Approaching Station XYZ", "Approaching {heroData ? heroData.target_halt : \"----\"} | Speed: {heroData ? heroData.speed : \"----\"} km/h")
# Replace progress bar width
jsx = re.sub(r'<div className="bg-\[#00e5ff\] h-full w-\[85%\] rounded-full shadow-\[0_0_10px_#00e5ff\]"></div>',
             r'<div className="bg-[#00e5ff] h-full rounded-full shadow-[0_0_10px_#00e5ff]" style={{ width: `${heroData?.progress_pct || 0}%` }}></div>', jsx)

# Replace <a href="#">Live Map</a>
jsx = re.sub(r'<a[^>]*href="#"[^>]*>Live Map</a>', r'<Link href={`/map?train=${searchQuery}`} className="text-on-primary font-label-md nav-link transition-colors duration-200">Live Map</Link>', jsx)

# Links inside "Quick Links" - PNR Status, Live Station, Schedule
jsx = jsx.replace('href="#"', 'href="/"')

# Replace the full return block in page.tsx
page_tsx_header = """'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ApiKeyModal from './components/ApiKeyModal';

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [heroLoading, setHeroLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const [heroData, setHeroData] = useState<any>(null);

  const fetchHeroPreview = async (trainNo: string) => {
    const cleanNo = trainNo.trim();
    if (!cleanNo) return;
    try {
      setHeroLoading(true);
      const res = await fetch(`http://localhost:8000/api/v1/trains/${encodeURIComponent(cleanNo)}/eta?date=2026-09-03&current_station=NDLS&current_delay=15`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.stations && data.stations.length > 0) {
        const first = data.stations[0];
        const midIdx = Math.min(2, data.stations.length - 1);
        const mid = data.stations[midIdx];
        const last = data.stations[data.stations.length - 1];

        setHeroData({
          train_number: data.train_number,
          train_name: data.train_name,
          origin: data.origin_station || first.station_name || 'Origin',
          dest: data.destination_station || last.station_name || 'Destination',
          distance_km: Math.round(last.distance_km || 1384),
          current_delay: mid.delay_minutes || 15,
          confidence: mid.confidence_percent || 90,
          origin_halt: `${first.station_code} (${first.scheduled_arrival})`,
          target_halt: `${mid.station_code} (ETA ${mid.predicted_arrival})`,
          dest_halt: `${last.station_code} (Dest)`,
          speed: 120,
          signal: 'DOUBLE GREEN (CLEAR)',
          sector: `${first.station_code}-${mid.station_code} Corridor`,
          platform: mid.platform_prediction || 'Platform 1',
          progress_pct: Math.round((midIdx / (data.stations.length - 1)) * 100)
        });
      }
    } catch (e) {
      console.log('Error fetching hero preview:', e);
    } finally {
      setHeroLoading(false);
    }
  };

  const handleSearch = () => {
    const target = searchQuery.trim();
    if(target) router.push(`/dashboard?train=${encodeURIComponent(target)}`);
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col antialiased">
"""

page_tsx_footer = """
      {/* API Key Modal */}
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)}
      />
    </div>
  );
}
"""

with open("src/app/page.tsx", "w") as f:
    f.write(page_tsx_header + jsx + page_tsx_footer)

print("page.tsx generated successfully")
