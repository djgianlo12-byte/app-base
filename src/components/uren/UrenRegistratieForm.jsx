import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isSameDay, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Car, Home, Save, Loader2, CheckCircle2 } from 'lucide-react';

function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export default function UrenRegistratieForm({ user, datum }) {
  const queryClient = useQueryClient();
  const [starttijd, setStarttijd] = useState('08:00');
  const [eindtijd, setEindtijd] = useState('17:00');
  const [thuiswerk, setThuiswerk] = useState('');
  const [notitie, setNotitie] = useState('');
  const [saved, setSaved] = useState(false);

  // Haal bestaande registratie op voor deze dag
  const { data: bestaande = [] } = useQuery({
    queryKey: ['uren', user?.email, datum],
    queryFn: () => base44.entities.Urenregistratie.filter({
      medewerker_email: user.email,
      datum: datum
    }),
    enabled: !!user?.email && !!datum,
  });

  const bestaandeReg = bestaande[0];

  // Haal werkbonnen op voor reistijd berekening
  const { data: werkbonnen = [] } = useQuery({
    queryKey: ['uren-werkbonnen', user?.email, datum],
    queryFn: () => base44.entities.Werkbon.filter({ geclaimd_door: user.email }),
    enabled: !!user?.email,
  });

  // Bereken totale reistijd voor de dag (uit geplande werkbonnen)
  const dagBonnen = werkbonnen.filter(w =>
    w.geplande_datum && isSameDay(parseISO(w.geplande_datum), parseISO(datum)) &&
    w.status !== 'open'
  );

  // Vul form in met bestaande data
  useEffect(() => {
    if (bestaandeReg) {
      setStarttijd(bestaandeReg.starttijd || '08:00');
      setEindtijd(bestaandeReg.eindtijd || '17:00');
      setThuiswerk(bestaandeReg.thuiswerk_uren?.toString() || '');
      setNotitie(bestaandeReg.notitie || '');
    }
  }, [bestaandeReg]);

  const totaalWerkMinuten = timeToMinutes(eindtijd) - timeToMinutes(starttijd);
  const totaalUren = (totaalWerkMinuten / 60).toFixed(1);
  const reistijdMin = bestaandeReg?.reistijd_minuten || 0;

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (bestaandeReg) {
        return base44.entities.Urenregistratie.update(bestaandeReg.id, data);
      } else {
        return base44.entities.Urenregistratie.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uren', user?.email, datum] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      medewerker_email: user.email,
      medewerker_naam: user.full_name,
      datum,
      starttijd,
      eindtijd,
      thuiswerk_uren: thuiswerk ? parseFloat(thuiswerk) : 0,
      notitie,
    });
  };

  return (
    <div className="space-y-4">
      {/* Samenvatting werkbonnen die dag */}
      {dagBonnen.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Werkbonnen vandaag</p>
          {dagBonnen.map(w => (
            <div key={w.id} className="flex items-center justify-between text-xs text-slate-700">
              <span className="truncate flex-1">{w.titel}</span>
              <span className="text-slate-500 ml-2 shrink-0">{w.geplande_tijd} · {w.geschatte_duur || '?'}u</span>
            </div>
          ))}
        </div>
      )}

      {/* Werktijden */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Starttijd
          </Label>
          <Input
            type="time"
            value={starttijd}
            onChange={e => setStarttijd(e.target.value)}
            className="h-10 rounded-xl border-slate-200 bg-white text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Eindtijd
          </Label>
          <Input
            type="time"
            value={eindtijd}
            onChange={e => setEindtijd(e.target.value)}
            className="h-10 rounded-xl border-slate-200 bg-white text-sm"
          />
        </div>
      </div>

      {/* Thuiswerk */}
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600 flex items-center gap-1">
          <Home className="w-3 h-3" /> Thuisgewerkt (uren)
        </Label>
        <Input
          type="number"
          step="0.5"
          min="0"
          max="12"
          value={thuiswerk}
          onChange={e => setThuiswerk(e.target.value)}
          placeholder="0"
          className="h-10 rounded-xl border-slate-200 bg-white text-sm"
        />
      </div>

      {/* Samenvatting totaal */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Totaal overzicht</p>
        <div className="flex justify-between text-xs text-blue-700">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Werktijd op locatie</span>
          <span className="font-semibold">{totaalUren} uur</span>
        </div>
        {reistijdMin > 0 && (
          <div className="flex justify-between text-xs text-blue-700">
            <span className="flex items-center gap-1"><Car className="w-3 h-3" /> Reistijd (is werktijd)</span>
            <span className="font-semibold">{(reistijdMin / 60).toFixed(1)} uur</span>
          </div>
        )}
        {thuiswerk > 0 && (
          <div className="flex justify-between text-xs text-blue-700">
            <span className="flex items-center gap-1"><Home className="w-3 h-3" /> Thuisgewerkt</span>
            <span className="font-semibold">{parseFloat(thuiswerk).toFixed(1)} uur</span>
          </div>
        )}
        <div className="border-t border-blue-200 pt-1 flex justify-between text-sm font-bold text-blue-900">
          <span>Totaal factureerbare uren</span>
          <span>{(parseFloat(totaalUren) + reistijdMin / 60 + (parseFloat(thuiswerk) || 0)).toFixed(1)} uur</span>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending || saved}
        className={`w-full h-11 rounded-xl font-semibold ${saved ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {saveMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opslaan...</>
        ) : saved ? (
          <><CheckCircle2 className="w-4 h-4 mr-2" />Opgeslagen!</>
        ) : (
          <><Save className="w-4 h-4 mr-2" />Uren opslaan</>
        )}
      </Button>
    </div>
  );
}