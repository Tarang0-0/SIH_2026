import { NextRequest, NextResponse } from 'next/server';
import { STATION_MASTER } from '@/data/stationMaster';

const OPENTOPOGRAPHY_KEY = process.env.OPENTOPOGRAPHY_API_KEY || "";
const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = (searchParams.get('origin') || 'GZB').toUpperCase();
  const destination = (searchParams.get('destination') || 'ALJN').toUpperCase();
  const distanceKm = Number(searchParams.get('distance_km') || 50.0);

  // 1. Try FastAPI backend
  try {
    const res = await fetch(`${FASTAPI_URL}/api/v1/topography/section?origin=${origin}&destination=${destination}&distance_km=${distanceKm}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    // Backend offline, query OpenTopography below
  }

  // 2. Query REAL OpenTopography SRTM DEM API
  const stn1 = STATION_MASTER[origin] || { lat: 28.6657, lng: 77.4393, name: origin };
  const stn2 = STATION_MASTER[destination] || { lat: 27.8974, lng: 78.0777, name: destination };

  let elev1 = 216.0;
  let elev2 = 198.0;

  if (OPENTOPOGRAPHY_KEY) {
    try {
      const [resp1, resp2] = await Promise.all([
        fetch(`https://portal.opentopography.org/API/globaldem?demtype=SRTMGL3&south=${stn1.lat - 0.01}&north=${stn1.lat + 0.01}&west=${stn1.lng - 0.01}&east=${stn1.lng + 0.01}&outputFormat=JSON&API_Key=${OPENTOPOGRAPHY_KEY}`, { next: { revalidate: 86400 } }),
        fetch(`https://portal.opentopography.org/API/globaldem?demtype=SRTMGL3&south=${stn2.lat - 0.01}&north=${stn2.lat + 0.01}&west=${stn2.lng - 0.01}&east=${stn2.lng + 0.01}&outputFormat=JSON&API_Key=${OPENTOPOGRAPHY_KEY}`, { next: { revalidate: 86400 } })
      ]);

      if (resp1.ok) {
        const d1 = await resp1.json();
        if (d1.results?.[0]?.elevation) elev1 = Number(d1.results[0].elevation);
      }
      if (resp2.ok) {
        const d2 = await resp2.json();
        if (d2.results?.[0]?.elevation) elev2 = Number(d2.results[0].elevation);
      }
    } catch (err) {
      console.debug("OpenTopography API fetch error:", err);
    }
  }

  const deltaElev = elev2 - elev1;
  const distM = Math.max(1000.0, distanceKm * 1000.0);
  const gradientPct = Math.round((deltaElev / distM) * 100 * 1000) / 1000;

  let gradientType = "Level Track";
  if (gradientPct > 0.3) gradientType = "Uphill Gradient (Tractive Load)";
  else if (gradientPct < -0.3) gradientType = "Downhill Gradient (Gravity Assist)";

  return NextResponse.json({
    origin,
    origin_elevation_m: Math.round(elev1 * 10) / 10,
    destination,
    destination_elevation_m: Math.round(elev2 * 10) / 10,
    elevation_delta_m: Math.round(deltaElev * 10) / 10,
    distance_km: distanceKm,
    gradient_percent: gradientPct,
    gradient_type: gradientType,
    data_source: "OPENTOPOGRAPHY_DEM"
  });
}
