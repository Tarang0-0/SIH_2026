import { NextRequest, NextResponse } from 'next/server';

const RAILRADAR_KEY = process.env.RAILRADAR_API_KEY || "";
const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cleanId = id.replace("J_", "").trim();

  // 1. Try FastAPI backend
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/trains/${cleanId}/route`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.stations && data.stations.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    // Backend offline
  }

  // 2. Query Real RailRadar Production API for full track topology & GPS coordinates
  if (RAILRADAR_KEY) {
    try {
      const resp = await fetch(`https://railradar.in/api/v1/trains/${cleanId}`, {
        headers: {
          'Authorization': `Bearer ${RAILRADAR_KEY}`,
          'x-api-key': RAILRADAR_KEY,
          'User-Agent': 'Mozilla/5.0'
        },
        next: { revalidate: 300 }
      });
      if (resp.ok) {
        const raw = await resp.json();
        if (raw.success && raw.data?.route) {
          const routeList = raw.data.route;
          const parsed = routeList.map((s: any, idx: number) => {
            const stn = s.station || {};
            const arr = s.arrival || s.departure || "00:00";
            const dep = s.departure || s.arrival || "00:05";
            return {
              sequence: s.sequence || idx + 1,
              station_code: stn.code || `STN_${idx + 1}`,
              station_name: stn.name || stn.code || `Station ${idx + 1}`,
              distance_km: Number(s.distance || 0),
              scheduled_arrival: arr.length === 5 ? `${arr}:00` : arr,
              scheduled_departure: dep.length === 5 ? `${dep}:00` : dep,
              dwell_minutes: s.isHalt ? 2 : 0,
              latitude: Number(stn.lat || 28.6415),
              longitude: Number(stn.lng || 77.2197)
            };
          });

          if (parsed.length > 0) {
            return NextResponse.json({
              train_number: cleanId,
              stations: parsed
            });
          }
        }
      }
    } catch (err) {
      console.debug("RailRadar live route fetch fallback:", err);
    }
  }

  return NextResponse.json({
    train_number: cleanId,
    stations: []
  });
}
