import { NextRequest, NextResponse } from 'next/server';

const FASTAPI_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const FALLBACK_POIS = [
  { name: "Yamuna River Crossing", type: "river", category: "waterway", description: "Historic Himalayan river crossed on the classic steel rail bridge", distance_from_train_km: 12.4 },
  { name: "Taj Mahal & Agra Fort", type: "monument", category: "heritage", description: "UNESCO World Heritage wonder visible along Agra Cantt approach", distance_from_train_km: 24.5 },
  { name: "Gwalior Fort", type: "monument", category: "heritage", description: "8th-century hill fortress overlooking the central railway line", distance_from_train_km: 18.2 },
  { name: "Ganga River (Holy Ganges)", type: "river", category: "waterway", description: "Sacred rail viaduct crossing near Prayagraj & Varanasi", distance_from_train_km: 32.0 },
  { name: "Thal Ghat (Kasara Incline)", type: "ghat", category: "mountain", description: "Famous 1 in 37 steep rail incline in Western Ghats requiring banker locos", distance_from_train_km: 15.0 },
  { name: "Narmada River Rail Bridge", type: "bridge", category: "infrastructure", description: "Heavy-duty double track bridge across the sacred Narmada", distance_from_train_km: 8.5 }
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const stations = searchParams.get('stations');

  // 1. Try FastAPI backend
  try {
    let url = `${FASTAPI_URL}/api/v1/poi/nearby?lat=${lat || '28.64'}&lng=${lng || '77.21'}&radius_km=50`;
    if (stations) {
      url = `${FASTAPI_URL}/api/v1/poi/corridor?stations=${encodeURIComponent(stations)}`;
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    // Fallback to direct Overpass query below
  }

  // 2. Query Overpass API directly from Next.js server
  if (lat && lng) {
    try {
      const nLat = parseFloat(lat);
      const nLng = parseFloat(lng);
      const bbox = `${nLat - 0.4},${nLng - 0.4},${nLat + 0.4},${nLng + 0.4}`;
      const overpassQuery = `[out:json][timeout:3];(node["tourism"="attraction"](${bbox});node["waterway"="river"](${bbox});node["natural"="peak"](${bbox}););out 6;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        next: { revalidate: 3600 }
      });

      if (res.ok) {
        const raw = await res.json();
        const elements = raw.elements || [];
        const parsed = elements
          .filter((el: any) => el.tags && (el.tags.name || el.tags['name:en']))
          .map((el: any) => {
            const tags = el.tags;
            const pLat = el.lat || nLat;
            const pLng = el.lon || nLng;
            const dist = Math.round(Math.sqrt(((pLat - nLat) * 111) ** 2 + ((pLng - nLng) * 102) ** 2) * 10) / 10;
            let cat = "heritage";
            let pType = "monument";
            if (tags.waterway) { cat = "waterway"; pType = "river"; }
            else if (tags.natural) { cat = "mountain"; pType = "mountain"; }

            return {
              name: tags.name || tags['name:en'],
              type: pType,
              category: cat,
              lat: pLat,
              lng: pLng,
              description: tags.description || `Scenic ${cat} landmark along railway corridor`,
              distance_from_train_km: dist
            };
          });

        if (parsed.length > 0) {
          return NextResponse.json(parsed);
        }
      }
    } catch (err) {
      console.debug("Direct Overpass query notice:", err);
    }
  }

  return NextResponse.json(FALLBACK_POIS);
}
