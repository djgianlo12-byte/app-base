import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Home, Save, Car, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { minutesToTime } from '../lib/reistijd';

const START_HOUR = 6;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_H = 64; // px per uur
const TIME_COL_W = 36;

function toMin(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function topPx(timeStr) {
  const m = toMin(timeStr);
  if (m === null) return null;
  return ((m - START_HOUR * 60) / 60) * HOUR_H;
}

// Bouw reistijden voor een dag vanuit de opgeslagen velden op werkbonnen
function bouwDagReistijdenVanOpgeslagen(items) {
  const results = {};
  for (const item of items) {
    if (item.reistijd_naar_min && item.reistijd_vertrek) {
      results[item.id] = {
        minuten: item.reistijd_naar_min,
        vertrekTijd: item.reistijd_vertrek,
        vertrekMin: toMin(item.reistijd_vertrek),
      };
    }
  }
  return results;
}

const TYPE_COLORS = {
  'Keuring':          'bg-blue-100 border-blue-500 text-blue-900',
  'Oplevering':       'bg-emerald-100 border-emerald-500 text-emerald-900',
  'Montagewerk':      'bg-purple-100 border-purple-500 text-purple-900',
  'Magazijn keuring': 'bg-orange-100 border-orange-500 text-orange-900',
  'Jaarlijkse keuring':'bg-cyan-100 border-cyan-500 text-cyan-900',
  'Inmeten':          'bg-pink-100 border-pink-500 text-pink-900',
};

export default function Agenda() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [thuisadresInput, setThuisadresInput] = useState('');
  const [savingAdres, setSavingAdres] = useState(false);
  const [savedAdres, setSavedAdres] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'day'
  const gridRef = useRef(null);
  const queryClient = useQueryClient();

  const today = new Date();
  const weekStart = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const weekDays = [...Array(5)].map((_, i) => addDays(weekStart, i)); // ma-vr

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setThuisadresInput(u?.thuisadres || '');
    });
  }, []);

  useEffect(() => {
    const unsub = base44.entities.Werkbon.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['agenda-werkbonnen'] });
    });
    return unsub;
  }, [queryClient]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = HOUR_H * 1.5;
  }, []);

  const { data: werkbonnen = [], isLoading } = useQuery({
    queryKey: ['agenda-werkbonnen', user?.email],
    queryFn: () => base44.entities.Werkbon.filter({ geclaimd_door: user.email }, 'geplande_datum', 200),
    enabled: !!user?.email,
  });

  const itemsVoorDag = useCallback((day) =>
    werkbonnen
      .filter(w => w.geplande_datum && w.geplande_tijd && isSameDay(parseISO(w.geplande_datum), day) && w.status !== 'afgerond')
      .sort((a, b) => (a.geplande_tijd || '').localeCompare(b.geplande_tijd || '')),
    [werkbonnen]
  );

  const saveThuisadres = async () => {
    if (!thuisadresInput.trim()) return;
    setSavingAdres(true);
    await base44.auth.updateMe({ thuisadres: thuisadresInput.trim() });
    setUser(u => ({ ...u, thuisadres: thuisadresInput.trim() }));
    setSavingAdres(false);
    setSavedAdres(true);
    setTimeout(() => setSavedAdres(false), 2500);
  };

  const ongepland = werkbonnen.filter(w => !w.geplande_datum && w.status !== 'afgerond');
  const hours = [...Array(TOTAL_HOURS + 1)].map((_, i) => START_HOUR + i);

  const renderDayColumn = (day) => {
    const items = itemsVoorDag(day);
    const isToday = isSameDay(day, today);
    const dagRt = bouwDagReistijdenVanOpgeslagen(items);

    return (
      <div
        key={day.toISOString()}
        className="relative border-l border-slate-100"
        style={{ height: TOTAL_HOURS * HOUR_H }}
      >
        {/* Uurlijnen */}
        {hours.slice(0, -1).map(h => (
          <div key={h} className="absolute left-0 right-0 border-t border-slate-100" style={{ top: (h - START_HOUR) * HOUR_H }} />
        ))}
        {hours.slice(0, -1).map(h => (
          <div key={`hh${h}`} className="absolute left-0 right-0 border-t border-dashed border-slate-50" style={{ top: (h - START_HOUR) * HOUR_H + HOUR_H / 2 }} />
        ))}

        {/* Reistijdblokken (amber) */}
        {items.map(w => {
          const rt = dagRt[w.id];
          if (!rt) return null;
          const aankomstPx = topPx(w.geplande_tijd);
          const rtH = Math.max((rt.minuten / 60) * HOUR_H, 16);
          const rtTop = aankomstPx - rtH;
          if (rtTop < 0) return null;
          return (
            <div
              key={`rt-${w.id}`}
              className="absolute left-0.5 right-0.5 rounded bg-amber-50 border-l-2 border-amber-400 overflow-hidden flex items-center gap-1 px-1"
              style={{ top: rtTop, height: rtH, zIndex: 3 }}
            >
              <Car className="w-2.5 h-2.5 text-amber-500 shrink-0" />
              <span className="text-amber-800 font-semibold truncate leading-none" style={{ fontSize: 9 }}>
                {rt.vertrekTijd} weg · {rt.minuten}m
              </span>
            </div>
          );
        })}

        {/* Afspraakblokken + thuis-blok voor laatste afspraak */}
        {items.map((w, idx) => {
          const top = topPx(w.geplande_tijd);
          if (top === null) return null;
          const duurMin = (w.geschatte_duur || 1) * 60;
          const h = Math.max((duurMin / 60) * HOUR_H, 28);
          const color = TYPE_COLORS[w.type] || 'bg-blue-100 border-blue-500 text-blue-900';
          const isLaatste = idx === items.length - 1;
          const eindMin = toMin(w.geplande_tijd) + duurMin;
          const thuisTop = topPx(minutesToTime(eindMin));
          const thuisH = w.reistijd_naar_huis_min ? Math.max((w.reistijd_naar_huis_min / 60) * HOUR_H, 16) : 0;

          return (
            <React.Fragment key={w.id}>
              <Link to={createPageUrl(`WerkbonDetail?id=${w.id}`)}>
                <div
                  className={`absolute left-0.5 right-0.5 rounded border-l-2 overflow-hidden px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity ${color}`}
                  style={{ top, height: h, zIndex: 4 }}
                >
                  <p className="font-bold leading-tight truncate" style={{ fontSize: 9 }}>{w.geplande_tijd}</p>
                  <p className="font-semibold leading-tight truncate" style={{ fontSize: 9 }}>{w.titel}</p>
                  {h > 40 && <p className="leading-tight truncate opacity-70" style={{ fontSize: 8 }}>{w.adres}{w.stad ? `, ${w.stad}` : ''}</p>}
                </div>
              </Link>
              {/* Thuis-blok na de laatste afspraak van de dag */}
              {isLaatste && w.reistijd_naar_huis_min && w.reistijd_thuis_aankomst && (
                <div
                  className="absolute left-0.5 right-0.5 rounded bg-purple-50 border-l-2 border-purple-400 overflow-hidden flex flex-col justify-center px-1 pointer-events-none"
                  style={{ top: thuisTop, height: thuisH, zIndex: 3 }}
                >
                  <div className="flex items-center gap-0.5">
                    <Home className="w-2 h-2 text-purple-500 shrink-0" />
                    <span className="text-purple-800 font-semibold truncate leading-none" style={{ fontSize: 9 }}>
                      thuis {w.reistijd_thuis_aankomst}
                    </span>
                  </div>
                  {thuisH > 24 && (
                    <span className="text-purple-600 truncate" style={{ fontSize: 7 }}>
                      {w.reistijd_naar_huis_min}m rijden
                    </span>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Now-lijn */}
        {isToday && (() => {
          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const nowTop = ((nowMin - START_HOUR * 60) / 60) * HOUR_H;
          if (nowTop < 0 || nowTop > TOTAL_HOURS * HOUR_H) return null;
          return (
            <div className="absolute left-0 right-0 flex items-center pointer-events-none" style={{ top: nowTop, zIndex: 10 }}>
              <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          );
        })()}
      </div>
    );
  };

  const displayDays = viewMode === 'week' ? weekDays : [selectedDate];

  return (
    <div className="pb-32 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Mijn agenda</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${viewMode === 'week' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
          >Week</button>
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${viewMode === 'day' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
          >Dag</button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o - 1)} className="h-8 w-8 rounded-lg">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold text-slate-700">
          {format(weekStart, 'd MMM', { locale: nl })} – {format(addDays(weekStart, 4), 'd MMM yyyy', { locale: nl })}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(o => o + 1)} className="h-8 w-8 rounded-lg">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Kalender */}
      {isLoading ? (
        <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <Card className="border-slate-200 overflow-hidden">
          {/* Dag-headers */}
          <div
            className="grid bg-slate-50 border-b border-slate-200"
            style={{ gridTemplateColumns: `${TIME_COL_W}px repeat(${displayDays.length}, 1fr)` }}
          >
            <div />
            {displayDays.map(day => {
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              const cnt = itemsVoorDag(day).length;
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => { setSelectedDate(day); if (viewMode === 'week') setViewMode('day'); }}
                  className={`p-2 text-center border-l border-slate-200 transition-colors ${isSelected && viewMode === 'day' ? 'bg-blue-50' : 'hover:bg-slate-100'}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>
                    {format(day, 'EEE', { locale: nl })}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-slate-800'}`}>
                    {format(day, 'd')}
                  </p>
                  {cnt > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto mt-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Scrollbaar tijdraster */}
          <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: '62vh' }}>
            <div
              className="grid"
              style={{ gridTemplateColumns: `${TIME_COL_W}px repeat(${displayDays.length}, 1fr)` }}
            >
              {/* Tijdlabels */}
              <div className="relative shrink-0" style={{ height: TOTAL_HOURS * HOUR_H }}>
                {hours.map(h => (
                  <div
                    key={h}
                    className="absolute right-1 text-slate-400 -translate-y-2"
                    style={{ top: (h - START_HOUR) * HOUR_H, fontSize: 9 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Dag-kolommen */}
              {displayDays.map(day => (
                <div key={day.toISOString()}>
                  {renderDayColumn(day)}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Legenda */}
      <div className="flex items-center gap-4 px-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-50 border-l-2 border-amber-400" />
          <span className="text-xs text-slate-500">Reistijd vertrek</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-100 border-l-2 border-blue-500" />
          <span className="text-xs text-slate-500">Afspraak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-purple-50 border-l-2 border-purple-400" />
          <span className="text-xs text-slate-500">Thuis aankomst</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-red-500" />
          <span className="text-xs text-slate-500">Nu</span>
        </div>
      </div>

      {/* Thuisadres */}
      <div className={`rounded-xl border p-4 space-y-2 ${user?.thuisadres ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-300'}`}>
        <div className="flex items-center gap-2">
          <Home className={`w-4 h-4 ${user?.thuisadres ? 'text-green-600' : 'text-amber-600'}`} />
          <span className={`text-sm font-semibold ${user?.thuisadres ? 'text-green-800' : 'text-amber-800'}`}>
            {user?.thuisadres ? 'Mijn thuisadres' : 'Stel je thuisadres in voor reistijden'}
          </span>
          {savedAdres && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        </div>
        {!user?.thuisadres && (
          <p className="text-xs text-amber-700">Zonder thuisadres kunnen reistijden niet worden berekend.</p>
        )}
        <div className="flex gap-2">
          <Input
            value={thuisadresInput}
            onChange={e => setThuisadresInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveThuisadres()}
            placeholder="Straat 1, 1234 AB Stad"
            className="h-9 rounded-lg bg-white border-slate-200 text-sm flex-1"
          />
          <Button
            size="sm"
            onClick={saveThuisadres}
            disabled={savingAdres || !thuisadresInput.trim() || thuisadresInput.trim() === user?.thuisadres}
            className={`h-9 rounded-lg shrink-0 ${savedAdres ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {savingAdres ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Ongeplande werkbonnen */}
      {ongepland.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Nog in te plannen ({ongepland.length})</h2>
          <div className="space-y-1.5">
            {ongepland.slice(0, 5).map(w => (
              <Link key={w.id} to={createPageUrl(`WerkbonDetail?id=${w.id}`)}>
                <Card className="p-3 border-dashed border-slate-200 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{w.titel}</p>
                      <p className="text-xs text-slate-400 truncate">{w.adres}{w.stad ? `, ${w.stad}` : ''}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-blue-100 text-blue-800">
                      {w.type}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
            {ongepland.length > 5 && (
              <Link to={createPageUrl('Werkbonnen')}>
                <p className="text-xs text-center text-blue-600 py-1">+ {ongepland.length - 5} meer bekijken</p>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}