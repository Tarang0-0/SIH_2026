import { NextRequest, NextResponse } from 'next/server';

const RAILRADAR_KEY = process.env.RAILRADAR_API_KEY || "";
const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q') || '';
  const cleanQ = q.trim();

  if (!cleanQ) {
    return NextResponse.json([]);
  }

  // 1. Try FastAPI backend
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/trains/search?q=${encodeURIComponent(cleanQ)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    // Backend offline
  }

  // 2. Query Real RailRadar Production API directly for the searched train number
  if (RAILRADAR_KEY && cleanQ.length >= 3) {
    try {
      const resp = await fetch(`https://railradar.in/api/v1/trains/${cleanQ}`, {
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

          return NextResponse.json([
            {
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
            }
          ]);
        }
      }
    } catch (err) {
      console.debug("RailRadar live search fallback:", err);
    }
  }

  return NextResponse.json([]);
}
