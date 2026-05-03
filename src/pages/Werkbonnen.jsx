import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ClipboardList } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import WerkbonCard from '../components/werkbon/WerkbonCard';

const TYPES = ["Keuring", "Oplevering", "Montagewerk", "Magazijn keuring", "Jaarlijkse keuring", "Inmeten"];

export default function Werkbonnen() {
  const [zoekterm, setZoekterm] = useState('');
  const [typeFilter, setTypeFilter] = useState('alle');
  const [statusTab, setStatusTab] = useState('open');
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = base44.entities.Werkbon.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['werkbonnen'] });
    });
    return unsub;
  }, [queryClient]);

  const { data: werkbonnen = [], isLoading } = useQuery({
    queryKey: ['werkbonnen'],
    queryFn: () => base44.entities.Werkbon.list('-created_date', 100),
  });

  const filtered = werkbonnen.filter(w => {
    const matchZoek = !zoekterm || 
      w.titel?.toLowerCase().includes(zoekterm.toLowerCase()) ||
      w.adres?.toLowerCase().includes(zoekterm.toLowerCase()) ||
      w.geclaimd_door_naam?.toLowerCase().includes(zoekterm.toLowerCase());
    const matchType = typeFilter === 'alle' || w.type === typeFilter;
    const matchStatus = statusTab === 'alle' || 
      (statusTab === 'open' && w.status === 'open') ||
      (statusTab === 'actief' && ['geclaimd', 'ingepland', 'onderweg', 'in_uitvoering'].includes(w.status)) ||
      (statusTab === 'afgerond' && w.status === 'afgerond');
    return matchZoek && matchType && matchStatus;
  });

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-bold text-slate-900 pt-2">Werkbonnen</h1>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Zoeken op titel, adres, naam..."
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            className="pl-9 h-11 bg-white border-slate-200 rounded-xl"
          />
        </div>

        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="flex-1 h-10 bg-white border-slate-200 rounded-xl text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle types</SelectItem>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList className="w-full bg-slate-100 rounded-xl h-10">
            <TabsTrigger value="open" className="flex-1 rounded-lg text-xs">Open</TabsTrigger>
            <TabsTrigger value="actief" className="flex-1 rounded-lg text-xs">Actief</TabsTrigger>
            <TabsTrigger value="afgerond" className="flex-1 rounded-lg text-xs">Afgerond</TabsTrigger>
            <TabsTrigger value="alle" className="flex-1 rounded-lg text-xs">Alle</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs text-slate-400">{filtered.length} resultaten</p>
          {filtered.map(w => <WerkbonCard key={w.id} werkbon={w} />)}
        </div>
      ) : (
        <Card className="p-10 text-center border-slate-200">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Geen werkbonnen gevonden</p>
        </Card>
      )}
    </div>
  );
}