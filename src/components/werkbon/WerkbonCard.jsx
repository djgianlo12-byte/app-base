import React from 'react';
import { Card } from "@/components/ui/card";
import { MapPin, Clock, User, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import StatusBadge from './StatusBadge';
import TypeBadge from './TypeBadge';
import PrioriteitIndicator from './PrioriteitIndicator';

export default function WerkbonCard({ werkbon }) {
  return (
    <Link to={createPageUrl(`WerkbonDetail?id=${werkbon.id}`)}>
      <Card className="p-4 hover:shadow-md transition-all duration-200 border-slate-200 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <PrioriteitIndicator prioriteit={werkbon.prioriteit} />
              <h3 className="font-semibold text-slate-900 text-sm truncate">{werkbon.titel}</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <TypeBadge type={werkbon.type} />
              <StatusBadge status={werkbon.status} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{werkbon.adres}{werkbon.stad ? `, ${werkbon.stad}` : ''}</span>
              </div>
              {werkbon.geschatte_duur && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{werkbon.geschatte_duur} uur</span>
                </div>
              )}
              {werkbon.geclaimd_door_naam && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>{werkbon.geclaimd_door_naam}</span>
                </div>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 mt-1 shrink-0" />
        </div>
      </Card>
    </Link>
  );
}