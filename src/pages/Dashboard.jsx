import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ClipboardList, CheckCircle2, Clock, Users, Plus, ArrowRight, PenLine, Bell, Download, Home } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StatsCard from '../components/dashboard/StatsCard';
import WerkbonCard from '../components/werkbon/WerkbonCard';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const unsubWerkbon = base44.entities.Werkbon.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['werkbonnen-dashboard'] });
    });
    const unsubTekening = base44.entities.TekeningOpdracht.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['tekening-notificaties'] });
    });
    return () => { unsubWerkbon(); unsubTekening(); };
  }, [queryClient]);

  const { data: werkbonnen = [], isLoading } = useQuery({
    queryKey: ['werkbonnen-dashboard'],
    queryFn: () => base44.entities.Werkbon.list('-created_date', 50),
    retry: false,
  });

  const { data: tekeningOpdrachten = [] } = useQuery({
    queryKey: ['tekening-notificaties'],
    queryFn: () => base44.entities.TekeningOpdracht.list('-created_date', 50),
    retry: false,
    throwOnError: false,
  });

  const isVerkoper = user?.role === 'verkoper' || user?.role === 'admin' || user?.role === 'kantoor';
  const isTekenaar = user?.role === 'tekenaar' || user?.role === 'admin';
  const nieuweTekenOpdrachten = tekeningOpdrachten.filter(o => o.status === 'open');
  const nieuweTekenLeveringen = tekeningOpdrachten.filter(o => o.status === 'geleverd' && !o.verkoper_gezien);

  const isKantoor = user?.role === 'admin' || user?.role === 'kantoor' || user?.role === 'verkoper';
  const openCount = werkbonnen.filter(w => w.status === 'open').length;
  const geclaimdCount = werkbonnen.filter(w => w.status === 'geclaimd' || w.status === 'ingepland').length;
  const onderweCount = werkbonnen.filter(w => w.status === 'onderweg' || w.status === 'in_uitvoering').length;
  const afgerondCount = werkbonnen.filter(w => w.status === 'afgerond').length;

  const recentOpen = werkbonnen.filter(w => w.status === 'open').slice(0, 3);

  const exportCSV = () => {
    const eenWeekGeleden = new Date();
    eenWeekGeleden.setDate(eenWeekGeleden.getDate() - 7);
    const afgerond = werkbonnen.filter(w =>
      w.status === 'afgerond' && new Date(w.updated_date) >= eenWeekGeleden
    );
    if (afgerond.length === 0) { alert('Geen afgeronde werkbonnen in de afgelopen week.'); return; }

    const headers = ['ID','Titel','Type','Status','Prioriteit','Adres','Postcode','Stad','Contactpersoon','Telefoon','Geclaimd door','Geplande datum','Geplande tijd','Geschatte duur (uur)','Notities','Aangemaakt op','Afgerond op'];
    const rows = afgerond.map(w => [
      w.id, w.titel, w.type, w.status, w.prioriteit,
      w.adres, w.postcode || '', w.stad || '',
      w.contactpersoon || '', w.contact_telefoon || '',
      w.geclaimd_door_naam || '', w.geplande_datum || '', w.geplande_tijd || '',
      w.geschatte_duur || '', w.notities || '',
      new Date(w.created_date).toLocaleDateString('nl-NL'),
      new Date(w.updated_date).toLocaleDateString('nl-NL'),
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `werkbonnen-afgerond-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  const mijnWerkbonnen = werkbonnen
    .filter(w => w.geclaimd_door === user?.email && w.status !== 'afgerond')
    .slice(0, 3);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="pt-2">
        <p className="text-slate-500 text-sm">Welkom terug,</p>
        <h1 className="text-2xl font-bold text-slate-900">{user?.full_name || 'Gebruiker'}</h1>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatsCard title="Open" value={openCount} icon={ClipboardList} color="blue" />
          <StatsCard title="Geclaimd" value={geclaimdCount} icon={Users} color="purple" />
          <StatsCard title="Actief" value={onderweCount} icon={Clock} color="orange" />
          <StatsCard title="Afgerond" value={afgerondCount} icon={CheckCircle2} color="green" />
        </div>
      )}

      {/* Thuisadres: link naar agenda */}
      {!user?.thuisadres && (user?.role === 'buitendienst' || user?.role === 'admin' || user?.role === 'kantoor') && (
        <Link to={createPageUrl('Agenda')}>
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <Home className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">Stel je <span className="font-semibold">thuisadres</span> in voor reistijdberekening</p>
            <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
        </Link>
      )}

      {/* Quick Actions */}
      {(user?.role === 'admin' || user?.role === 'kantoor') && (
        <div className="space-y-2">
          <Link to={createPageUrl('WerkbonAanmaken')}>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-sm font-semibold rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Nieuwe werkbon aanmaken
            </Button>
          </Link>
          <Button variant="outline" onClick={exportCSV} className="w-full h-11 text-sm font-semibold rounded-xl border-slate-200 text-slate-700">
            <Download className="w-4 h-4 mr-2" />
            Exporteer afgerond (afgelopen week)
          </Button>
        </div>
      )}

      {/* Verkoper: nieuwe tekeningen geleverd */}
      {isVerkoper && nieuweTekenLeveringen.length > 0 && (
        <Link to={createPageUrl('TekeningOpdrachten')}>
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">{nieuweTekenLeveringen.length} nieuwe tekening{nieuweTekenLeveringen.length > 1 ? 'en' : ''} geleverd</p>
              <p className="text-xs text-amber-700">Tik om te bekijken</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-500" />
          </div>
        </Link>
      )}

      {/* Tekenaar: openstaande opdrachten */}
      {isTekenaar && nieuweTekenOpdrachten.length > 0 && (
        <Link to={createPageUrl('TekeningOpdrachten')}>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <PenLine className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-blue-900 text-sm">{nieuweTekenOpdrachten.length} tekening opdracht{nieuweTekenOpdrachten.length > 1 ? 'en' : ''} open</p>
              <p className="text-xs text-blue-700">Tik om te bekijken</p>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400" />
          </div>
        </Link>
      )}

      {/* Mijn werkbonnen (buitendienst) */}
      {mijnWerkbonnen.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Mijn werkbonnen</h2>
            <Link to={createPageUrl('Agenda')} className="text-blue-600 text-sm font-medium flex items-center gap-1">
              Alles <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {mijnWerkbonnen.map(w => <WerkbonCard key={w.id} werkbon={w} />)}
          </div>
        </div>
      )}

      {/* Recent open */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Open werkbonnen</h2>
          <Link to={createPageUrl('Werkbonnen')} className="text-blue-600 text-sm font-medium flex items-center gap-1">
            Alles <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : recentOpen.length > 0 ? (
          <div className="space-y-2.5">
            {recentOpen.map(w => <WerkbonCard key={w.id} werkbon={w} />)}
          </div>
        ) : (
          <Card className="p-8 text-center border-slate-200">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Geen open werkbonnen</p>
          </Card>
        )}
      </div>
    </div>
  );
}