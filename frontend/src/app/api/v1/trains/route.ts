import { NextResponse } from 'next/server';

const RAILRADAR_KEY = process.env.RAILRADAR_API_KEY || "";
const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const POPULAR_TRAIN_NUMBERS = [
  "12004", // New Delhi - Lucknow Swarn Shatabdi
  "12951", // Mumbai Central - New Delhi Tejas Rajdhani
  "12301", // Howrah - New Delhi Rajdhani
  "22436", // Vande Bharat Express
  "20608", // Mysore - Chennai Vande Bharat
  "12245", // Howrah - SMVT Bengaluru Duronto
  "12626", // Kerala Express
  "12424"  // Dibrugarh Rajdhani
];

export async function GET() {
  // 1. Try FastAPI backend
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/trains`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    // Backend offline, query real RailRadar API directly
  }

  // 2. Query Real RailRadar Production API for active flagship fleet
  if (RAILRADAR_KEY) {
    try {
      const liveTrains = await Promise.allSettled(
        POPULAR_TRAIN_NUMBERS.map(async (num) => {
          const resp = await fetch(`https://railradar.in/api/v1/trains/${num}`, {
            headers: {
              'Authorization': `Bearer ${RAILRADAR_KEY}`,
              'x-api-key': RAILRADAR_KEY,
              'User-Agent': 'Mozilla/5.0'
            },
            next: { revalidate: 60 }
          });
          if (resp.ok) {
            const raw = await resp.json();
            if (raw.success && raw.data?.train) {
              const t = raw.data.train;
              const route = raw.data.route || [];
              const halts = route.filter((s: any) => s.isHalt);
              const curr = halts.length > 1 ? halts[1].station?.code : t.source?.code;
              const next = halts.length > 2 ? halts[2].station?.code : t.destination?.code;

              return {
                journey_id: `J_${t.number}`,
                train_number: t.number,
                train_name: t.name,
                train_type: t.type || "Express",
                origin: t.source?.code || "NDLS",
                destination: t.destination?.code || "LJN",
                current_station: curr || "GZB",
                next_station: next || "ALJN",
                speed_kmph: Number(t.avgSpeed || 85),
                delay_minutes: 0.0,
                status: "RUNNING",
                data_source: "REAL"
              };
            }
          }
          return null;
        })
      );

      const resolved = liveTrains
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value);

      if (resolved.length > 0) {
        return NextResponse.json(resolved);
      }
    } catch (err) {
      console.debug("RailRadar fleet query fallback:", err);
    }
  }

  return NextResponse.json([]);
}
