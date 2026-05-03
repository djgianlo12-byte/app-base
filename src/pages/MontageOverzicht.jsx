import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Wrench, PenLine } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_CONFIG = {
  open:         { label: 'Open',          dot: 'bg-blue-500',   bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700' },
  geclaimd:     { label: 'Geclaimd',      dot: 'bg-purple-500', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  ingepland:    { label: 'Ingepland',     dot: 'bg-indigo-500', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  onderweg:     { label: 'Onderweg',      dot: 'bg-orange-500', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
  in_uitvoering:{ label: 'In uitvoering', dot: 'bg-yellow-500', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  afgerond:     { label: 'Afgerond',      dot: 'bg-green-500',  bg: 'bg-green-50 border-green-200',  text: 'text-green-700' },
};

const VOLGORDE = ['open', 'geclaimd', 'ingepland', 'onderweg', 'in_uitvoering', 'afgerond'];

export default function MontageOverzicht() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const isBuitendienst = user?.role === 'buitendienst';

  const { data: werkbonnen = [], isLoading } = useQuery({
    queryKey: ['montage-werkbonnen'],
    queryFn: () => base44.entities.Werkbon.filter({ type: 'Montagewerk' }, '-created_date', 300),
    enabled: !!user,
  });

  const { data: tekeningOpdrachten = [] } = useQuery({
    queryKey: ['tekening-opdrachten-all'],
    queryFn: () => base44.entities.TekeningOpdracht.list('-created_date', 300),
    enabled: !!user,
  });

  const tekeningMap = Object.fromEntries(tekeningOpdrachten.map(t => [t.werkbon_id, t]));

  const gefilterd = isBuitendienst
    ? werkbonnen.filter(w => w.geclaimd_door === user?.email)
    : werkbonnen;

  const byStatus = gefilterd.reduce((acc, w) => {
    (acc[w.status] = acc[w.status] || []).push(w);
    return acc;
  }, {});

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-slate-900">Montage overzicht</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {isBuitendienst ? 'Jouw montagewerk' : `${gefilterd.length} montagewerk werkbonnen`}
        </p>
      </div>

      {/* Status samenvatting */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {VOLGORDE.map(status => {
            const items = byStatus[status] || [];
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status} className={`rounded-xl border p-3 text-center ${cfg.bg}`}>
                <div className={`text-2xl font-bold ${cfg.text}`}>{items.length}</div>
                <div className={`text-xs font-medium ${cfg.text} leading-tight`}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per status */}
      {VOLGORDE.filter(s => s !== 'afgerond').map(status => {
        const items = byStatus[status] || [];
        if (items.length === 0) return null;
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot} inline-block`}></span>
              <h2 className="text-sm font-semibold text-slate-700">{cfg.label} ({items.length})</h2>
            </div>
            <div className="space-y-2">
              {items.map(w => {
                const tekening = tekeningMap[w.id];
                return (
                  <Link key={w.id} to={`/WerkbonDetail?id=${w.id}`}>
                    <Card className="p-3 border-slate-200 hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{w.titel}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {w.adres}{w.stad ? `, ${w.stad}` : ''}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {w.geplande_datum && (
                              <span className="text-xs text-slate-400">📅 {w.geplande_datum}</span>
                            )}
                            {w.geclaimd_door_naam && (
                              <span className="text-xs text-slate-400">👤 {w.geclaimd_door_naam}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {tekening && (
                            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              tekening.status === 'geleverd'
                                ? 'bg-green-100 text-green-700'
                                : tekening.status === 'in_behandeling'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              <PenLine className="w-2.5 h-2.5" />
                              {tekening.status === 'geleverd'
                                ? 'Tekening klaar'
                                : tekening.status === 'in_behandeling'
                                ? 'Bij tekenaar'
                                : 'Tekening open'}
                            </span>
                          )}
                          <ArrowRight className="w-4 h-4 text-slate-300 mt-1" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}

      {!isLoading && gefilterd.length === 0 && (
        <Card className="p-8 text-center border-slate-200">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Geen montagewerk gevonden</p>
        </Card>
      )}
    </div>
  );
}