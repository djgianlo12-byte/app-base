import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isSameDay, isToday } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation, MapPin, Clock, ExternalLink, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatusBadge from '../components/werkbon/StatusBadge';

export default function Routeplanning() {
  const [user, setUser] = useState(null);
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: werkbonnen = [], isLoading } = useQuery({
    queryKey: ['route-werkbonnen', user?.email],
    queryFn: () => base44.entities.Werkbon.filter({ geclaimd_door: user.email }, 'geplande_tijd', 50),
    enabled: !!user?.email,
  });

  const dagWerkbonnen = werkbonnen.filter(w => {
    if (!w.geplande_datum) return false;
    return isSameDay(parseISO(w.geplande_datum), parseISO(filterDate));
  }).filter(w => w.status !== 'afgerond')
    .sort((a, b) => (a.geplande_tijd || '').localeCompare(b.geplande_tijd || ''));

  const openGoogleMapsRoute = () => {
    if (dagWerkbonnen.length === 0) return;
    const waypoints = dagWerkbonnen.map(w => {
      return `${w.adres}, ${w.postcode || ''} ${w.stad || ''}, Nederland`;
    });
    const destination = waypoints[waypoints.length - 1];
    const waypointsStr = waypoints.slice(0, -1).join('|');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${
      waypointsStr ? `&waypoints=${encodeURIComponent(waypointsStr)}` : ''
    }&travelmode=driving`;
    window.open(url, '_blank');
  };

  const navigateToSingle = (w) => {
    const address = `${w.adres}, ${w.postcode || ''} ${w.stad || ''}, Nederland`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className="space-y-5 pb-24">
      <h1 className="text-2xl font-bold text-slate-900 pt-2">Routeplanning</h1>

      {/* Date filter */}
      <Input
        type="date"
        value={filterDate}
        onChange={(e) => setFilterDate(e.target.value)}
        className="h-11 rounded-xl bg-white border-slate-200"
      />

      {/* Route button */}
      {dagWerkbonnen.length > 1 && (
        <Button onClick={openGoogleMapsRoute} className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl font-semibold">
          <Route className="w-4 h-4 mr-2" />
          Route plannen ({dagWerkbonnen.length} stops)
        </Button>
      )}

      {/* Stops */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : dagWerkbonnen.length > 0 ? (
        <div className="space-y-0">
          {dagWerkbonnen.map((w, index) => (
            <div key={w.id} className="flex gap-3">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {index + 1}
                </div>
                {index < dagWerkbonnen.length - 1 && (
                  <div className="w-0.5 flex-1 bg-blue-200 my-1" />
                )}
              </div>

              {/* Card */}
              <Card className="flex-1 p-3.5 border-slate-200 mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link to={createPageUrl(`WerkbonDetail?id=${w.id}`)}>
                      <h3 className="font-semibold text-slate-900 text-sm hover:text-blue-600 truncate">
                        {w.titel}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StatusBadge status={w.status} />
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{w.adres}{w.stad ? `, ${w.stad}` : ''}</span>
                      </div>
                      {w.geplande_tijd && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>{w.geplande_tijd}{w.geschatte_duur ? ` · ${w.geschatte_duur} uur` : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => navigateToSingle(w)}
                    className="h-9 w-9 rounded-lg text-blue-600 hover:bg-blue-50 shrink-0">
                    <Navigation className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center border-slate-200">
          <Route className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {isToday(parseISO(filterDate))
              ? 'Geen werkbonnen ingepland voor vandaag'
              : 'Geen werkbonnen ingepland voor deze dag'}
          </p>
          <Link to={createPageUrl('Werkbonnen')}>
            <Button variant="link" className="mt-1 text-sm">Bekijk alle werkbonnen</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}