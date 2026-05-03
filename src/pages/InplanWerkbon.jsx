import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, addDays, startOfWeek, isSameDay, parseISO, isEqual } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Phone, ChevronLeft, ChevronRight, Clock,
  MapPin, AlertTriangle, CheckCircle2, Car, Calendar, Loader2, Home, Save, AlertCircle
} from 'lucide-react';
import TypeBadge from '../components/werkbon/TypeBadge';
import { geocodeAdres, geocodeAdresString, berekenReistijd, minutesToTime } from '../lib/reistijd';

const START_HOUR = 6;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_H = 64;
const TIME_COL_W = 36;
const DAY_COL_W = 76;
const PX_PER_MIN = HOUR_H / 60;

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function topPx(timeStr) {
  return ((toMin(timeStr) - START_HOUR * 60)) * PX_PER_MIN;
}

export default function InplanWerkbon() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const gridRef = useRef(null);

  const [user, setUser] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [durationHours, setDurationHours] = useState(null);
  const [thuisInput, setThuisInput] = useState('');
  const [savingThuis, setSavingThuis] = useState(false);

  // Reistijden per dag voor bestaande afspraken (vast, wordt 1x berekend per dag)
  // { [dagKey]: { [werkbonId]: {minuten, vertrekTijd} } }
  const [dagRtCache, setDagRtCache] = useState({});
  const [dagRtBezig, setDagRtBezig] = useState(false);

  // Reistijd preview voor de nieuw te plannen afspraak
  const [previewRt, setPreviewRt] = useState(null); // { van, naar, naarHuis: {minuten, thuisAankomst} | null }
  const [previewBezig, setPreviewBezig] = useState(false);

  // Adres-correctie popup
  const [adresPopup, setAdresPopup] = useState(null); // { label, huidigAdres, veld: 'werkbon'|'thuis', resolve }
  const [adresInput, setAdresInput] = useState('');

  // Gecorrigeerde adressen lokaal cachen zodat ze niet steeds opnieuw gevraagd worden
  const gecorrigeerdWerkbonAdres = useRef(null); // string | null

  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const weekDays = [...Array(5)].map((_, i) => addDays(weekStart, i)); // ma-vr

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setThuisInput(u?.thuisadres || '');
    });
  }, []);



  const { data: werkbonData = [] } = useQuery({
    queryKey: ['werkbon-inplan', id],
    queryFn: () => base44.entities.Werkbon.filter({ id }),
    enabled: !!id,
  });
  const werkbon = werkbonData[0];

  const { data: alleWerkbonnen = [] } = useQuery({
    queryKey: ['inplan-agenda', user?.email],
    queryFn: () => base44.entities.Werkbon.filter({ geclaimd_door: user.email }, 'geplande_datum', 200),
    enabled: !!user?.email,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Werkbon.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['werkbon', id] });
      queryClient.invalidateQueries({ queryKey: ['mijn-werkbonnen'] });
      navigate(createPageUrl(`WerkbonDetail?id=${id}`));
    },
  });

  // Items voor een dag (excl. de huidige werkbon en afgeronde)
  const itemsVoorDag = useCallback((day) =>
    alleWerkbonnen
      .filter(w => w.id !== id && w.geplande_datum && w.geplande_tijd && w.status !== 'afgerond' && isSameDay(parseISO(w.geplande_datum), day))
      .sort((a, b) => toMin(a.geplande_tijd) - toMin(b.geplande_tijd)),
    [alleWerkbonnen, id]
  );

  // Bereken reistijden voor dag (bestaande afspraken) - 1x per dag, wordt gecached
  const herberekenDagReistijden = useCallback(async (day, thuisadres) => {
    if (!thuisadres || !day) return;
    const dagKey = format(day, 'yyyy-MM-dd');
    const items = itemsVoorDag(day);
    if (items.length === 0) return;

    setDagRtBezig(true);
    try {
      const thuisCoords = await geocodeAdresString(thuisadres);
      if (!thuisCoords) return;

      const results = {};
      let prevCoords = thuisCoords;

      for (const w of items) {
        const coords = await geocodeAdres(w.adres, w.postcode, w.stad);
        if (prevCoords && coords) {
          const min = await berekenReistijd(prevCoords, coords);
          if (min !== null) {
            const aankomstMin = toMin(w.geplande_tijd);
            results[w.id] = {
              minuten: min,
              vertrekTijd: minutesToTime(Math.max(START_HOUR * 60, aankomstMin - min)),
            };
          }
        }
        if (coords) prevCoords = coords;
      }
      setDagRtCache(prev => ({ ...prev, [dagKey]: results }));
    } finally {
      setDagRtBezig(false);
    }
  }, [itemsVoorDag]);

  // Helper: vraag om adrescorrectie via popup
  const vraagAdresCorrectie = useCallback((label, huidigAdres, veld = null) => {
    return new Promise((resolve) => {
      setAdresInput(huidigAdres || '');
      setAdresPopup({ label, huidigAdres, veld, resolve });
    });
  }, []);

  // Bereken preview reistijd voor nieuw te plannen afspraak
  const berekenPreview = useCallback(async (day, time, thuisadres, duration = null) => {
    if (!werkbon || !day || !time || !thuisadres) return;
    setPreviewBezig(true);
    setPreviewRt(null);

    try {
      // Gebruik gecorrigeerd adres als dat al eerder is ingevoerd (anders opnieuw vragen)
      let naarCoords = gecorrigeerdWerkbonAdres.current
        ? await geocodeAdres(gecorrigeerdWerkbonAdres.current, '', '')
        : await geocodeAdres(werkbon.adres, werkbon.postcode, werkbon.stad);

      if (!naarCoords) {
        // Geocoding mislukt: vraag om correctie en sla op in werkbon EN lokaal
        const gecorrigeerd = await vraagAdresCorrectie(
          `Adres werkbon "${werkbon.titel}"`,
          [werkbon.adres, werkbon.postcode, werkbon.stad].filter(Boolean).join(', '),
          'werkbon'
        );
        if (!gecorrigeerd) return;
        gecorrigeerdWerkbonAdres.current = gecorrigeerd;
        naarCoords = await geocodeAdres(gecorrigeerd, '', '');
        if (!naarCoords) return; // Nog steeds niet gevonden, stop
      }

      const finalDuration = duration || werkbon.geschakte_duur || 1;
      const gekozenMin = toMin(time);
      const gekozenEindMin = gekozenMin + finalDuration * 60;
      const items = itemsVoorDag(day);

      // Vorige afspraak: start vóór de nieuwe starttijd (neem de laatste)
      const vorige = [...items].filter(w => toMin(w.geplande_tijd) < gekozenMin).pop();
      // Volgende afspraak: start ná de nieuwe starttijd (neem de eerste)
      const volgende = items.find(w => toMin(w.geplande_tijd) > gekozenMin);

      let vanCoords = null;
      let vanLabel = '';

      if (vorige) {
        vanCoords = await geocodeAdres(vorige.adres, vorige.postcode, vorige.stad);
        vanLabel = vorige.adres + (vorige.stad ? `, ${vorige.stad}` : '');
      } else {
        vanCoords = await geocodeAdresString(thuisadres);
        if (!vanCoords) {
          // Thuisadres niet gevonden: vraag om correctie
          const gecorrigeerd = await vraagAdresCorrectie('Jouw thuisadres', thuisadres);
          if (gecorrigeerd) {
            vanCoords = await geocodeAdresString(gecorrigeerd);
            if (vanCoords) {
              await base44.auth.updateMe({ thuisadres: gecorrigeerd });
              setUser(u => ({ ...u, thuisadres: gecorrigeerd }));
              setThuisInput(gecorrigeerd);
            }
          }
        }
        vanLabel = 'thuis';
      }

      const rtVan = vanCoords ? await berekenReistijd(vanCoords, naarCoords) : null;

      let rtNaar = null;
      let naarLabel = '';
      if (volgende) {
        const volgCoords = await geocodeAdres(volgende.adres, volgende.postcode, volgende.stad);
        if (volgCoords) {
          rtNaar = await berekenReistijd(naarCoords, volgCoords);
          naarLabel = volgende.adres + (volgende.stad ? `, ${volgende.stad}` : '');
        }
      }

      // Reistijd naar huis: alleen als dit de LAATSTE afspraak van de dag is (geen volgende)
      let rtNaarHuis = null;
      if (!volgende && thuisadres) {
        const thuisCoords2 = await geocodeAdresString(thuisadres);
        if (thuisCoords2) {
          const minNaarHuis = await berekenReistijd(naarCoords, thuisCoords2);
          if (minNaarHuis !== null) {
            const thuisAankomst = gekozenEindMin + minNaarHuis;
            rtNaarHuis = { minuten: minNaarHuis, thuisAankomst };
          }
        }
      }

      setPreviewRt({
        van: rtVan !== null ? { minuten: rtVan, label: vanLabel } : null,
        naar: rtNaar !== null ? { minuten: rtNaar, label: naarLabel } : null,
        naarHuis: rtNaarHuis,
      });
    } finally {
      setPreviewBezig(false);
    }
  }, [werkbon, itemsVoorDag]);

  // Bereken dag-reistijden voor alle zichtbare weekdagen bij laden/wijzigen
  useEffect(() => {
    if (!user?.thuisadres) return;
    for (const day of weekDays) {
      const dagKey = format(day, 'yyyy-MM-dd');
      if (!dagRtCache[dagKey]) {
        herberekenDagReistijden(day, user.thuisadres);
      }
    }
  }, [user?.thuisadres, weekOffset, alleWerkbonnen.length]);

  // Herbereken preview als datum/tijd/thuisadres/werkbon wijzigt
  useEffect(() => {
    if (selectedDate && selectedTime && user?.thuisadres && werkbon) {
      const duration = durationHours || werkbon.geschatte_duur || 1;
      berekenPreview(selectedDate, selectedTime, user.thuisadres, duration);
    } else {
      setPreviewRt(null);
    }
  }, [selectedDate, selectedTime, durationHours, user?.thuisadres, werkbon?.id, alleWerkbonnen.length]);

  const saveThuisadres = async () => {
    if (!thuisInput.trim()) return;
    setSavingThuis(true);
    const nieuwAdres = thuisInput.trim();
    await base44.auth.updateMe({ thuisadres: nieuwAdres });
    setUser(u => ({ ...u, thuisadres: nieuwAdres }));
    setSavingThuis(false);
    // Herbereken preview meteen na opslaan thuisadres
    if (selectedDate && selectedTime && werkbon) {
      berekenPreview(selectedDate, selectedTime, nieuwAdres, durationHours || werkbon.geschatte_duur || 1);
    }
  };

  // Verwerk adrescorrectie: sla altijd op in werkbon + lokale ref
  const bevestigAdresCorrectie = async () => {
    const gecorrigeerd = adresInput.trim();
    if (!gecorrigeerd) return;
    // Altijd opslaan in werkbon zodat iedereen het ziet
    gecorrigeerdWerkbonAdres.current = gecorrigeerd;
    await base44.entities.Werkbon.update(id, { adres: gecorrigeerd });
    adresPopup.resolve(gecorrigeerd);
    setAdresPopup(null);
  };

  const handleGridClick = (e, day) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMin = (y / PX_PER_MIN) + START_HOUR * 60;
    const snapped = Math.round(rawMin / 15) * 15;
    const clamped = Math.max(START_HOUR * 60, Math.min((END_HOUR - 1) * 60, snapped));
    setSelectedDate(day);
    setSelectedTime(minutesToTime(clamped));
  };

  const hasConflict = () => {
    if (!selectedDate || !selectedTime || !werkbon) return false;
    const startMin = toMin(selectedTime);
    const eindMin = startMin + (werkbon.geschatte_duur || 1) * 60;
    return itemsVoorDag(selectedDate).some(w => {
      const wStart = toMin(w.geplande_tijd);
      const wEind = wStart + (w.geschatte_duur || 1) * 60;
      return !(eindMin <= wStart || startMin >= wEind);
    });
  };

  const conflict = hasConflict();
  const finalDuration = durationHours || werkbon?.geschatte_duur || 1;
  const newDurMin = finalDuration * 60;

  const handleConfirm = () => {
    if (!selectedDate || !selectedTime) return;
    const rtData = {};
    if (previewRt?.van) {
      rtData.reistijd_naar_min = previewRt.van.minuten;
      rtData.reistijd_vertrek = minutesToTime(toMin(selectedTime) - previewRt.van.minuten);
    }
    if (previewRt?.naarHuis) {
      rtData.reistijd_naar_huis_min = previewRt.naarHuis.minuten;
      rtData.reistijd_thuis_aankomst = minutesToTime(previewRt.naarHuis.thuisAankomst);
    }
    if (durationHours) {
      rtData.geschatte_duur = durationHours;
    }
    updateMutation.mutate({
      geplande_datum: format(selectedDate, 'yyyy-MM-dd'),
      geplande_tijd: selectedTime,
      status: 'ingepland',
      ...rtData,
    });
  };

  const renderDayColumn = (day) => {
    const items = itemsVoorDag(day);
    const isSelectedDay = selectedDate && isSameDay(day, selectedDate);
    const isToday = isSameDay(day, today);

    return (
      <div
        key={day.toISOString()}
        className={`relative border-r border-slate-100 cursor-crosshair ${isToday ? 'bg-blue-50/20' : ''}`}
        style={{ width: DAY_COL_W, minWidth: DAY_COL_W, height: TOTAL_HOURS * HOUR_H }}
        onClick={(e) => handleGridClick(e, day)}
      >
        {isSelectedDay && <div className="absolute inset-0 bg-blue-50/50 pointer-events-none" />}

        {/* Uurlijnen */}
        {[...Array(TOTAL_HOURS + 1)].map((_, i) => (
          <div key={i} className="absolute left-0 right-0 border-t border-slate-100 pointer-events-none" style={{ top: i * HOUR_H }} />
        ))}
        {[...Array(TOTAL_HOURS)].map((_, i) => (
          <div key={`hh${i}`} className="absolute left-0 right-0 border-t border-dashed border-slate-50 pointer-events-none" style={{ top: i * HOUR_H + HOUR_H / 2 }} />
        ))}

        {/* Bestaande afspraken + vaste reistijden */}
        {items.map(w => {
          const wTop = topPx(w.geplande_tijd);
          const wH = Math.max((w.geschatte_duur || 1) * 60 * PX_PER_MIN, 20);
          const dagKey = format(day, 'yyyy-MM-dd');
          const rt = dagRtCache[dagKey]?.[w.id] ?? null;
          const rtH = rt ? Math.max(rt.minuten * PX_PER_MIN, 14) : 0;
          const rtTop = rt ? wTop - rtH : 0;

          return (
            <React.Fragment key={w.id}>
              {/* Vaste reistijdblok voor bestaande afspraak */}
              {rt && rtTop >= 0 && (
                <div
                  className="absolute left-0.5 right-0.5 rounded bg-amber-50 border-l-2 border-amber-400 overflow-hidden flex items-center gap-0.5 px-1 pointer-events-none"
                  style={{ top: rtTop, height: rtH, zIndex: 3 }}
                >
                  <Car className="w-2 h-2 text-amber-500 shrink-0" />
                  <span className="text-amber-800 font-semibold truncate" style={{ fontSize: 8 }}>
                    {rt.vertrekTijd} · {rt.minuten}m
                  </span>
                </div>
              )}
              {/* Afspraakblok */}
              <div
                className="absolute left-0.5 right-0.5 rounded bg-blue-200 border border-blue-400 px-1 py-0.5 overflow-hidden pointer-events-none"
                style={{ top: wTop, height: wH, zIndex: 5 }}
              >
                <p className="font-bold text-blue-900 truncate leading-tight" style={{ fontSize: 8 }}>{w.geplande_tijd}</p>
                <p className="text-blue-800 truncate leading-tight" style={{ fontSize: 7 }}>{w.titel}</p>
              </div>
            </React.Fragment>
          );
        })}

        {/* Preview: nieuwe afspraak */}
        {isSelectedDay && selectedTime && (() => {
          const startMin = toMin(selectedTime);
          const previewTop = topPx(selectedTime);
          const previewH = Math.max(newDurMin * PX_PER_MIN, 24);
          const eindMin = startMin + newDurMin;

          return (
            <>
              {/* Reistijd VAN (preview) */}
              {!previewBezig && previewRt?.van && (() => {
                const vertrekMin = startMin - previewRt.van.minuten;
                const tTop = topPx(minutesToTime(vertrekMin));
                const tH = Math.max(previewRt.van.minuten * PX_PER_MIN, 16);
                if (tTop < 0) return null;
                return (
                  <div
                    className="absolute left-0.5 right-0.5 rounded bg-amber-100 border-l-2 border-amber-500 overflow-hidden flex flex-col justify-center px-1 pointer-events-none"
                    style={{ top: tTop, height: tH, zIndex: 9 }}
                  >
                    <div className="flex items-center gap-0.5">
                      {previewRt.van.label === 'thuis'
                        ? <Home className="w-2 h-2 text-amber-600 shrink-0" />
                        : <Car className="w-2 h-2 text-amber-600 shrink-0" />}
                      <span className="text-amber-900 font-bold truncate" style={{ fontSize: 8 }}>
                        {minutesToTime(vertrekMin)} weg
                      </span>
                    </div>
                    {tH > 24 && (
                      <span className="text-amber-700 truncate" style={{ fontSize: 7 }}>
                        {previewRt.van.minuten}m · {previewRt.van.label === 'thuis' ? 'van huis' : previewRt.van.label}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Laden indicator */}
              {previewBezig && previewTop - 20 >= 0 && (
                <div
                  className="absolute left-0.5 right-0.5 rounded bg-amber-50 border-l-2 border-amber-300 flex items-center gap-0.5 px-1 pointer-events-none"
                  style={{ top: previewTop - 20, height: 18, zIndex: 9 }}
                >
                  <Loader2 className="w-2 h-2 text-amber-500 animate-spin shrink-0" />
                  <span className="text-amber-600 truncate" style={{ fontSize: 7 }}>berekenen…</span>
                </div>
              )}

              {/* Geen thuisadres melding */}
              {!previewBezig && !previewRt?.van && !user?.thuisadres && previewTop - 16 >= 0 && (
                <div
                  className="absolute left-0.5 right-0.5 rounded bg-amber-50 border-l-2 border-amber-300 flex items-center gap-0.5 px-1 pointer-events-none"
                  style={{ top: previewTop - 16, height: 14, zIndex: 9 }}
                >
                  <Home className="w-2 h-2 text-amber-400 shrink-0" />
                  <span className="text-amber-500 truncate" style={{ fontSize: 7 }}>thuisadres ontbreekt</span>
                </div>
              )}

              {/* Nieuwe afspraak blok */}
              <div
                className={`absolute left-0.5 right-0.5 rounded border-2 px-1 py-0.5 pointer-events-none ${conflict ? 'bg-red-100 border-red-500' : 'bg-sky-200 border-sky-600'}`}
                style={{ top: previewTop, height: previewH, zIndex: 10 }}
              >
                <p className={`font-bold truncate leading-tight ${conflict ? 'text-red-900' : 'text-sky-900'}`} style={{ fontSize: 9 }}>
                  {selectedTime}
                </p>
                {previewH > 28 && <p className="text-sky-800 truncate leading-tight" style={{ fontSize: 7 }}>{werkbon?.titel}</p>}
              </div>

              {/* Reistijd NAAR volgende (preview) */}
              {!previewBezig && previewRt?.naar && (() => {
                const naarTop = topPx(minutesToTime(eindMin));
                const naarH = Math.max(previewRt.naar.minuten * PX_PER_MIN, 14);
                return (
                  <div
                    className="absolute left-0.5 right-0.5 rounded bg-green-100 border-l-2 border-green-500 overflow-hidden flex items-center gap-0.5 px-1 pointer-events-none"
                    style={{ top: naarTop, height: naarH, zIndex: 9 }}
                  >
                    <Car className="w-2 h-2 text-green-600 shrink-0" />
                    <span className="text-green-900 font-bold truncate" style={{ fontSize: 8 }}>
                      {previewRt.naar.minuten}m rijden
                    </span>
                  </div>
                );
              })()}

              {/* Reistijd NAAR HUIS (preview) - alleen als dit de laatste afspraak is */}
              {!previewBezig && previewRt?.naarHuis && (() => {
                const thuisTop = topPx(minutesToTime(eindMin));
                const thuisH = Math.max(previewRt.naarHuis.minuten * PX_PER_MIN, 16);
                return (
                  <div
                    className="absolute left-0.5 right-0.5 rounded bg-purple-100 border-l-2 border-purple-500 overflow-hidden flex flex-col justify-center px-1 pointer-events-none"
                    style={{ top: thuisTop, height: thuisH, zIndex: 9 }}
                  >
                    <div className="flex items-center gap-0.5">
                      <Home className="w-2 h-2 text-purple-600 shrink-0" />
                      <span className="text-purple-900 font-bold truncate" style={{ fontSize: 8 }}>
                        thuis {minutesToTime(previewRt.naarHuis.thuisAankomst)}
                      </span>
                    </div>
                    {thuisH > 24 && (
                      <span className="text-purple-700 truncate" style={{ fontSize: 7 }}>
                        {previewRt.naarHuis.minuten}m rijden
                      </span>
                    )}
                  </div>
                );
              })()}
            </>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-slate-50" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 px-4 pt-3 pb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-9 w-9 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900">Inplannen in agenda</h1>
            {werkbon && <p className="text-xs text-slate-500 truncate">{werkbon.titel}</p>}
          </div>
          {werkbon?.contact_telefoon && (
            <a href={`tel:${werkbon.contact_telefoon}`}>
              <Button size="sm" variant="outline" className="rounded-xl h-9 border-green-300 text-green-700 hover:bg-green-50">
                <Phone className="w-3.5 h-3.5 mr-1" />Bellen
              </Button>
            </a>
          )}
        </div>

        {werkbon && (
          <div className="mx-4 mb-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap">
            <TypeBadge type={werkbon.type} />
            <span className="flex items-center gap-1 text-xs font-semibold text-blue-800">
              <Clock className="w-3.5 h-3.5" />{werkbon.geschatte_duur || '?'} uur
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-600 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{werkbon.adres}{werkbon.stad ? `, ${werkbon.stad}` : ''}</span>
            </span>
          </div>
        )}

        {/* Legenda */}
        <div className="px-4 pb-2 flex items-center gap-3 flex-wrap">
          {[
            { color: 'bg-amber-100 border-l-2 border-amber-500', label: 'Vertrek' },
            { color: 'bg-sky-200 border-2 border-sky-600', label: 'Nieuw' },
            { color: 'bg-green-100 border-l-2 border-green-500', label: 'Volgende' },
            { color: 'bg-purple-100 border-l-2 border-purple-500', label: 'Thuis' },
            { color: 'bg-blue-200 border border-blue-400', label: 'Gepland' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-xs text-slate-500">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Week navigator + dag-headers */}
        <div className="px-4 pb-1 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o - 1)} className="h-7 w-7 rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-medium text-slate-500">
            {format(weekStart, 'd MMM', { locale: nl })} – {format(addDays(weekStart, 4), 'd MMM', { locale: nl })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o + 1)} className="h-7 w-7 rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Dag-headers */}
        <div className="flex overflow-x-hidden" style={{ paddingLeft: TIME_COL_W }}>
          {weekDays.map(day => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            const hasBonnen = alleWerkbonnen.some(w => w.id !== id && w.geplande_datum && isSameDay(parseISO(w.geplande_datum), day) && w.status !== 'afgerond');
            return (
              <div
                key={day.toISOString()}
                style={{ width: DAY_COL_W, minWidth: DAY_COL_W }}
                className={`flex flex-col items-center py-1 border-r border-slate-100 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <span className={`font-semibold uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-slate-400'}`} style={{ fontSize: 9 }}>
                  {format(day, 'EEE', { locale: nl })}
                </span>
                <span className={`font-bold text-sm ${isSelected ? 'text-blue-600' : isToday ? 'text-blue-500' : 'text-slate-700'}`}>
                  {format(day, 'd')}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${hasBonnen ? 'bg-blue-400' : 'bg-transparent'}`} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollbaar tijdraster */}
      <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_H }}>
          {/* Tijdlabels */}
          <div className="relative shrink-0" style={{ width: TIME_COL_W, height: TOTAL_HOURS * HOUR_H }}>
            {[...Array(TOTAL_HOURS + 1)].map((_, i) => (
              <div key={i} className="absolute right-1 text-slate-400 -translate-y-2" style={{ top: i * HOUR_H, fontSize: 9 }}>
                {String(START_HOUR + i).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {/* Dag-kolommen */}
          <div className="flex">
            {weekDays.map(day => renderDayColumn(day))}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t border-slate-200 px-4 py-3 shrink-0 space-y-2">

        {/* Conflict waarschuwing */}
        {conflict && selectedTime && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-xs text-red-700 font-medium">Overlap met bestaande afspraak!</p>
          </div>
        )}

        {/* Geselecteerde tijdstip + reistijd info */}
        {selectedDate && selectedTime ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 space-y-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-sm font-semibold text-blue-900">
                  {format(selectedDate, 'EEE d MMM', { locale: nl })} · {selectedTime}
                  <span className="font-normal text-blue-600"> – {minutesToTime(toMin(selectedTime) + newDurMin)}</span>
                </p>
              </div>
              
              <div className="flex items-center gap-2 pl-6">
                <label className="text-xs font-medium text-blue-700">Duur (uren):</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={durationHours || finalDuration}
                  onChange={(e) => setDurationHours(parseFloat(e.target.value) || null)}
                  className="w-16 h-8 px-2 rounded-lg border border-blue-300 bg-white text-sm font-semibold text-blue-900"
                />
              </div>
            </div>

            {previewBezig ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 pl-6">
                <Loader2 className="w-3 h-3 animate-spin" />Reistijden berekenen…
              </div>
            ) : (
              <div className="space-y-1.5 pl-1">
                {/* Vertrek */}
                {previewRt?.van && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    {previewRt.van.label === 'thuis'
                      ? <Home className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      : <Car className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-900">
                        Vertrek {minutesToTime(toMin(selectedTime) - previewRt.van.minuten)}
                        <span className="font-normal"> · {previewRt.van.minuten} min rijden</span>
                      </p>
                      <p className="text-xs text-amber-700 truncate">
                        van {previewRt.van.label === 'thuis' ? 'huis' : previewRt.van.label}
                      </p>
                    </div>
                  </div>
                )}

                {/* Naar volgende */}
                {previewRt?.naar && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                    <Car className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-900">
                        Daarna {previewRt.naar.minuten} min rijden
                      </p>
                      <p className="text-xs text-green-700 truncate">naar {previewRt.naar.label}</p>
                    </div>
                  </div>
                )}

                {/* Thuis aankomst */}
                {previewRt?.naarHuis && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5">
                    <Home className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-purple-900">
                        Thuis om {minutesToTime(previewRt.naarHuis.thuisAankomst)}
                      </p>
                      <p className="text-xs text-purple-700">{previewRt.naarHuis.minuten} min rijden naar huis</p>
                    </div>
                  </div>
                )}

                {/* Geen thuisadres */}
                {!previewRt?.van && !user?.thuisadres && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <p className="text-xs font-semibold text-amber-800">Stel je thuisadres in voor reistijden</p>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={thuisInput}
                        onChange={e => setThuisInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveThuisadres()}
                        placeholder="Straat 1, 1234 AB Stad"
                        className="h-8 text-xs rounded-lg bg-white border-amber-200 flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={saveThuisadres}
                        disabled={savingThuis || !thuisInput.trim()}
                        className="h-8 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shrink-0"
                      >
                        {savingThuis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center flex items-center justify-center gap-1.5 py-1">
            <Calendar className="w-3.5 h-3.5" />Tik op een dag/tijdstip in de agenda
          </p>
        )}

        <Button
          onClick={handleConfirm}
          disabled={!selectedDate || !selectedTime || updateMutation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 h-12 rounded-xl font-semibold"
        >
          {updateMutation.isPending ? 'Opslaan...' : 'Bevestig planning'}
        </Button>
      </div>

      {/* Adres-correctie popup */}
      {adresPopup && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 px-4 pb-6">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Adres niet gevonden</h3>
                <p className="text-xs text-slate-500 mt-0.5">{adresPopup.label}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Het adres <span className="font-semibold text-slate-800">"{adresPopup.huidigAdres}"</span> kon niet worden gevonden.
              Vul het juiste adres in — dit wordt opgeslagen in de werkbon zodat het voor iedereen klopt.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Correct adres</label>
              <Input
                value={adresInput}
                onChange={e => setAdresInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && adresInput.trim()) bevestigAdresCorrectie(); }}
                placeholder="Straat 1, 1234 AB Stad"
                className="h-10 rounded-xl border-slate-200"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { adresPopup.resolve(null); setAdresPopup(null); }}
                className="flex-1 h-10 rounded-xl"
              >
                Overslaan
              </Button>
              <Button
                onClick={bevestigAdresCorrectie}
                disabled={!adresInput.trim()}
                className="flex-1 h-10 rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                Opslaan & doorgaan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}