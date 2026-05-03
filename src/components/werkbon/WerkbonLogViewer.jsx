import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronUp, User, Clock } from 'lucide-react';

const actionLabels = {
  aangemaakt: { label: 'Aangemaakt', color: 'text-teal-700', bg: 'bg-teal-50' },
  bewerkt: { label: 'Bewerkt', color: 'text-yellow-700', bg: 'bg-yellow-50' },
  geclaimd: { label: 'Geclaimd', color: 'text-blue-600', bg: 'bg-blue-50' },
  vrijgegeven: { label: 'Vrijgegeven', color: 'text-orange-600', bg: 'bg-orange-50' },
  ingepland: { label: 'Ingepland', color: 'text-violet-600', bg: 'bg-violet-50' },
  status_gewijzigd: { label: 'Status gewijzigd', color: 'text-slate-600', bg: 'bg-slate-50' },
  notities_toegevoegd: { label: 'Notitie toegevoegd', color: 'text-green-600', bg: 'bg-green-50' },
  afgerond: { label: 'Afgerond', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  foto_toegevoegd: { label: 'Foto toegevoegd', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  bijlage_toegevoegd: { label: 'Bijlage toegevoegd', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  verwijderd: { label: 'Verwijderd', color: 'text-red-600', bg: 'bg-red-50' },
};

export default function WerkbonLogViewer({ werkbonId }) {
  const [expanded, setExpanded] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['werkbon-log', werkbonId],
    queryFn: () => base44.entities.WerkbonLog.filter({ werkbon_id: werkbonId }, '-created_date', 100),
    enabled: !!werkbonId,
  });

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Activiteitenlog ({logs.length})
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock className="w-4 h-4" />
          Activiteitenlog ({logs.length})
        </span>
        <ChevronUp className="w-4 h-4 text-slate-400" />
      </button>

      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            Geen activiteiten geregistreerd
          </div>
        ) : (
          logs.map(log => {
            const actionInfo = actionLabels[log.actie] || { label: log.actie, color: 'text-slate-600', bg: 'bg-slate-50' };
            return (
              <div key={log.id} className={`p-4 ${actionInfo.bg}`}>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-current" style={{ color: actionInfo.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(log.created_date), 'd MMM yyyy HH:mm', { locale: nl })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {log.gebruiker_naam || log.gebruiker_email}
                    </div>
                    {log.beschrijving && (
                      <p className="text-sm text-slate-700 leading-relaxed">{log.beschrijving}</p>
                    )}
                    {log.oude_waarde && log.nieuwe_waarde && (
                      <div className="text-xs text-slate-600 mt-1.5 flex gap-2">
                        <span className="line-through">{log.oude_waarde}</span>
                        <span>→</span>
                        <span className="font-semibold">{log.nieuwe_waarde}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}