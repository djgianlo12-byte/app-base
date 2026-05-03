import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, params } = body;

  if (action === 'geocode') {
    const { adres } = params;
    if (!adres) return Response.json({ coords: null });

    const q = adres.includes('Nederland') ? adres : `${adres}, Nederland`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=nl`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'WerkbonTracker/1.0' }
    });
    const data = await res.json();

    if (data?.[0]) {
      return Response.json({ coords: [parseFloat(data[0].lat), parseFloat(data[0].lon)] });
    }
    return Response.json({ coords: null });
  }

  if (action === 'reistijd') {
    const { van, naar } = params;
    if (!van || !naar) return Response.json({ minuten: null });

    const url = `https://router.project-osrm.org/route/v1/driving/${van[1]},${van[0]};${naar[1]},${naar[0]}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();

    if (data?.routes?.[0]) {
      return Response.json({ minuten: Math.ceil(data.routes[0].duration / 60) });
    }
    return Response.json({ minuten: null });
  }

  return Response.json({ error: 'Onbekende actie' }, { status: 400 });
});