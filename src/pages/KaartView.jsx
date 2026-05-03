import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, addDays, subDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Eye, EyeOff, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

// Fix leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const orangeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

async function geocodeAddress(adres, postcode, stad) {
  const q = [adres, postcode, stad, 'Nederland'].filter(Boolean).join(', ');
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
    { headers: { 'User-Agent': 'WerkbonTracker/1.0' } }
  );
  const data = await res.json();
  if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  return null;
}

export default function KaartView() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showOpen, setShowOpen] = useState(false);
  const [geocoded, setGeocoded] = useState({});
  const [geocoding, setGeocoding] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const { data: werkbonnen = [] } = useQuery({
    queryKey: ['werkbonnen-kaart'],
    queryFn: () => base44.entities.Werkbon.list('-geplande_datum', 300),
    enabled: !!user,
  });

  const mijnWerkbonnen = werkbonnen.filter(w =>
    w.geclaimd_door === user?.email && w.geplande_datum === dateStr && w.status !== 'afgerond'
  );

  const openWerkbonnen = showOpen
    ? werkbonnen.filter(w => 
        w.status === 'open' && 
        (selectedTypes.length === 0 || selectedTypes.includes(w.type))
      )
    : [];

  const toGeocodeIds = [...mijnWerkbonnen, ...openWerkbonnen].map(w => w.id).join(',');

  useEffect(() => {
    const items = [...mijnWerkbonnen, ...openWerkbonnen].filter(w => !geocoded[w.id]);
    if (items.length === 0) return;

    let cancelled = false;
    setGeocoding(true);

    const run = async () => {
      for (const w of items) {
        if (cancelled) break;
        const coords = await geocodeAddress(w.adres, w.postcode, w.stad);
        if (coords && !cancelled) setGeocoded(prev => ({ ...prev, [w.id]: coords }));
        await new Promise(r => setTimeout(r, 400));
      }
      if (!cancelled) setGeocoding(false);
    };

    run();
    return () => { cancelled = true; };
  }, [toGeocodeIds]);

  return (
    <div className="space-y-4 pb-24">
      <div className="pt-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Kaart</h1>
        {geocoding && (
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Locaties laden…
          </div>
        )}
      </div>

      {/* Dagselector */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-semibold text-slate-800 capitalize">
          {format(selectedDate, 'EEEE d MMMM', { locale: nl })}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Toggle open werkbonnen */}
      <button
        onClick={() => setShowOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
          showOpen ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        {showOpen ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        {showOpen ? 'Open werkbonnen verbergen' : 'Open werkbonnen tonen (heel NL)'}
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${showOpen ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
          {werkbonnen.filter(w => w.status === 'open').length}
        </span>
      </button>

      {/* Type filter (alleen bij open werkbonnen) */}
      {showOpen && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">Filter op type</label>
          <div className="flex flex-wrap gap-2">
            {['Keuring', 'Oplevering', 'Montagewerk', 'Magazijn keuring', 'Jaarlijkse keuring', 'Inmeten'].map(type => {
              const count = werkbonnen.filter(w => w.status === 'open' && w.type === type).length;
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => setSelectedTypes(prev =>
                    isSelected ? prev.filter(t => t !== type) : [...prev, type]
                  )}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    isSelected
                      ? 'bg-orange-500 border-orange-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300'
                  }`}
                >
                  {type} ({count})
                </button>
              );
            })}
            {selectedTypes.length > 0 && (
              <button
                onClick={() => setSelectedTypes([])}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Alles tonen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Legenda */}
      <div className="flex gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
          Mijn planning ({mijnWerkbonnen.length})
        </span>
        {showOpen && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block"></span>
            Open ({openWerkbonnen.length})
          </span>
        )}
      </div>

      {/* Kaart */}
      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '460px' }}>
        <MapContainer center={[52.2, 5.3]} zoom={7} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mijnWerkbonnen.map(w => geocoded[w.id] && (
            <Marker key={w.id} position={geocoded[w.id]} icon={blueIcon}>
              <Popup>
                <div className="text-sm space-y-0.5">
                  <strong>{w.titel}</strong><br />
                  {w.type && <span className="text-blue-600">{w.type}</span>}<br />
                  {w.adres}{w.stad ? `, ${w.stad}` : ''}<br />
                  {w.geplande_tijd && <>🕐 {w.geplande_tijd}<br /></>}
                  {w.contactpersoon && <>👤 {w.contactpersoon}<br /></>}
                  {w.contact_telefoon && (
                    <a href={`tel:${w.contact_telefoon}`} className="text-blue-600 underline">{w.contact_telefoon}</a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          {openWerkbonnen.map(w => geocoded[w.id] && (
            <Marker key={`open-${w.id}`} position={geocoded[w.id]} icon={orangeIcon}>
              <Popup>
                <div className="text-sm space-y-0.5">
                  <strong>{w.titel}</strong><br />
                  <span className="text-orange-600 font-medium">{w.type}</span><br />
                  {w.adres}{w.stad ? `, ${w.stad}` : ''}<br />
                  {w.prioriteit && <>Prioriteit: <strong>{w.prioriteit}</strong></>}
                  <br />
                  <a href={`/WerkbonDetail?id=${w.id}`} className="text-blue-600 underline text-xs">Bekijken →</a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Lijst van de dag */}
      {mijnWerkbonnen.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Jouw planning deze dag</h2>
          {mijnWerkbonnen.map(w => (
            <Link key={w.id} to={`/WerkbonDetail?id=${w.id}`}
              className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3 hover:border-blue-300 transition-colors">
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-0.5"></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{w.titel}</p>
                <p className="text-xs text-slate-500">{w.adres}{w.stad ? `, ${w.stad}` : ''}</p>
              </div>
              {w.geplande_tijd && <span className="text-xs text-slate-400">{w.geplande_tijd}</span>}
            </Link>
          ))}
        </div>
      )}

      {mijnWerkbonnen.length === 0 && (
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Geen werkbonnen ingepland voor {format(selectedDate, 'd MMMM', { locale: nl })}</p>
        </div>
      )}
    </div>
  );
}