import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, parseISO, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Car, Home, User } from 'lucide-react';
import UrenRegistratieForm from '../components/uren/UrenRegistratieForm';

export default function Uren() {
  const [user, setUser] = useState(null);
  const [selectedDatum, setSelectedDatum] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Haal alle registraties op van de medewerker (afgelopen 14 dagen)
  const { data: registraties = [] } = useQuery({
    queryKey: ['alle-uren', user?.email],
    queryFn: () => base44.entities.Urenregistratie.filter({ medewerker_email: user.email }, '-datum', 30),
    enabled: !!user?.email,
  });

  // Admin: haal alle registraties van iedereen
  const { data: alleRegistraties = [] } = useQuery({
    queryKey: ['alle-uren-admin'],
    queryFn: () => base44.entities.Urenregistratie.list('-datum', 100),
    enabled: user?.role === 'admin' || user?.role === 'kantoor',
  });

  const isKantoor = user?.role === 'admin' || user?.role === 'kantoor';
  const isBuitendienst = user?.role === 'buitendienst';

  // Genereer de afgelopen 7 dagen als datumknoppen
  const recenteDagen = [...Array(7)].map((_, i) => {
    const d = subDays(new Date(), i);
    return format(d, 'yyyy-MM-dd');
  });

  function timeToMinutes(time) {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function calcTotaal(reg) {
    if (!reg?.starttijd || !reg?.eindtijd) return 0;
    const werk = (timeToMinutes(reg.eindtijd) - timeToMinutes(reg.starttijd)) / 60;
    const reis = (reg.reistijd_minuten || 0) / 60;
    const thuis = reg.thuiswerk_uren || 0;
    return werk + reis + thuis;
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-slate-900">Urenregistratie</h1>
        <p className="text-sm text-slate-500">Reistijd is ook werktijd</p>
      </div>

      {/* Buitendienst: eigen uren registreren */}
      {isBuitendienst && (
        <>
          {/* Dag selector */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recenteDagen.map(datum => {
              const heeftReg = registraties.some(r => r.datum === datum);
              const isSelected = datum === selectedDatum;
              const d = parseISO(datum);
              return (
                <button
                  key={datum}
                  onClick={() => setSelectedDatum(datum)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border text-xs shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : heeftReg
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="font-medium uppercase" style={{ fontSize: 10 }}>
                    {format(d, 'EEE', { locale: nl })}
                  </span>
                  <span className="font-bold text-sm">{format(d, 'd')}</span>
                  {heeftReg && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-0.5" />}
                </button>
              );
            })}
          </div>

          {/* Formulier voor geselecteerde dag */}
          <Card className="p-4 border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              {format(parseISO(selectedDatum), 'EEEE d MMMM', { locale: nl })}
            </h2>
            {user && <UrenRegistratieForm user={user} datum={selectedDatum} />}
          </Card>

          {/* Overzicht afgelopen dagen */}
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-3">Overzicht afgelopen dagen</h2>
            <div className="space-y-2">
              {registraties.slice(0, 10).map(reg => {
                const totaal = calcTotaal(reg);
                return (
                  <Card
                    key={reg.id}
                    className="p-3 border-slate-200 cursor-pointer hover:border-blue-300 transition-colors"
                    onClick={() => setSelectedDatum(reg.datum)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {format(parseISO(reg.datum), 'EEE d MMM', { locale: nl })}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {reg.starttijd && reg.eindtijd && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />{reg.starttijd}–{reg.eindtijd}
                            </span>
                          )}
                          {(reg.reistijd_minuten || 0) > 0 && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Car className="w-3 h-3" />{Math.round(reg.reistijd_minuten / 60 * 10) / 10}u reis
                            </span>
                          )}
                          {(reg.thuiswerk_uren || 0) > 0 && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Home className="w-3 h-3" />{reg.thuiswerk_uren}u thuis
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-700">{totaal.toFixed(1)}</p>
                        <p className="text-xs text-slate-400">uur totaal</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {registraties.length === 0 && (
                <Card className="p-6 text-center border-slate-200">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Nog geen uren geregistreerd</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* Kantoor/Admin: overzicht van alle medewerkers */}
      {isKantoor && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-3">Overzicht alle medewerkers</h2>
          {alleRegistraties.length === 0 ? (
            <Card className="p-6 text-center border-slate-200">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Nog geen urenregistraties</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {alleRegistraties.map(reg => {
                const totaal = calcTotaal(reg);
                return (
                  <Card key={reg.id} className="p-3 border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <p className="text-sm font-semibold text-slate-900">{reg.medewerker_naam || reg.medewerker_email}</p>
                        </div>
                        <p className="text-xs text-slate-500 ml-5">
                          {format(parseISO(reg.datum), 'EEE d MMM', { locale: nl })}
                          {reg.starttijd && reg.eindtijd && ` · ${reg.starttijd}–${reg.eindtijd}`}
                        </p>
                        <div className="flex items-center gap-3 ml-5 mt-0.5">
                          {(reg.reistijd_minuten || 0) > 0 && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Car className="w-3 h-3" />{(reg.reistijd_minuten / 60).toFixed(1)}u reis
                            </span>
                          )}
                          {(reg.thuiswerk_uren || 0) > 0 && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Home className="w-3 h-3" />{reg.thuiswerk_uren}u thuis
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-700">{totaal.toFixed(1)}</p>
                        <p className="text-xs text-slate-400">uur totaal</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}