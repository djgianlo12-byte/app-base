import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PenLine, MapPin, CheckCircle2, ChevronDown, ChevronUp,
  Image, FileText, ExternalLink, Loader2, Bell
} from 'lucide-react';
import FileUploader from '../components/werkbon/FileUploader';

const statusConfig = {
  open: { label: 'Open', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_behandeling: { label: 'In behandeling', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  geleverd: { label: 'Geleverd', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function OpdrachtCard({ opdracht, user, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [tekeningen, setTekeningen] = useState(opdracht.tekeningen || []);
  const [notities, setNotities] = useState(opdracht.notities_tekenaar || '');
  const [notitiesVerkoper, setNotitiesVerkoper] = useState(opdracht.notities_verkoper || '');
  const [saving, setSaving] = useState(false);

  const isTekenaar = user?.role === 'tekenaar' || user?.role === 'admin';
  const isVerkoper = user?.role === 'verkoper' || user?.role === 'admin' || user?.role === 'kantoor';
  const isMine = opdracht.toegewezen_aan === user?.email;
  const cfg = statusConfig[opdracht.status] || statusConfig.open;
  const isNew = opdracht.status === 'geleverd' && !opdracht.verkoper_gezien;

  const handleClaim = async () => {
    setSaving(true);
    await onUpdate(opdracht.id, { toegewezen_aan: user.email, status: 'in_behandeling' });
    setSaving(false);
  };

  const handleLeveren = async () => {
    setSaving(true);
    await onUpdate(opdracht.id, { tekeningen, notities_tekenaar: notities, status: 'geleverd' });
    setSaving(false);
  };

  const handleVerkoperSave = async () => {
    setSaving(true);
    await onUpdate(opdracht.id, { notities_verkoper: notitiesVerkoper, verkoper_gezien: true });
    setSaving(false);
  };

  return (
    <Card className={`border-slate-200 overflow-hidden ${isNew ? 'ring-2 ring-amber-400' : ''}`}>
      <button className="w-full text-left p-4" onClick={() => setOpen(o => !o)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isNew && <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <h3 className="font-semibold text-slate-900 text-sm truncate">{opdracht.werkbon_titel}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{opdracht.adres}{opdracht.stad ? `, ${opdracht.stad}` : ''}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs border ${cfg.className}`}>{cfg.label}</Badge>
              {opdracht.toegewezen_aan && (
                <span className="text-xs text-slate-400">Tekenaar: {opdracht.toegewezen_aan.split('@')[0]}</span>
              )}
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 space-y-4">
          {/* Inmeet-foto's van buitendienst */}
          {opdracht.inmeet_fotos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5" />Inmeet foto's
              </p>
              <div className="grid grid-cols-3 gap-2">
                {opdracht.inmeet_fotos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg overflow-hidden border border-slate-200 block">
                    <img src={url} alt="" className="w-full h-20 object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Notities buitendienst */}
          {opdracht.notities_buitendienst && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">Notities buitendienst</p>
              <p className="text-sm text-slate-700">{opdracht.notities_buitendienst}</p>
            </div>
          )}

          {/* Tekenaar: claim + upload */}
          {isTekenaar && opdracht.status === 'open' && (
            <Button onClick={handleClaim} disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 h-10 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PenLine className="w-4 h-4 mr-2" />Tekening opdracht claimen</>}
            </Button>
          )}

          {isTekenaar && (isMine || user?.role === 'admin') && opdracht.status === 'in_behandeling' && (
            <div className="space-y-3">
              <FileUploader label="Tekeningen uploaden" files={tekeningen} onChange={setTekeningen} />
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">Notities tekenaar</p>
                <Textarea value={notities} onChange={e => setNotities(e.target.value)}
                  placeholder="Opmerkingen bij de tekening..." className="min-h-[80px] rounded-xl border-slate-200" />
              </div>
              <Button onClick={handleLeveren} disabled={saving || tekeningen.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Tekeningen leveren aan verkoper
              </Button>
            </div>
          )}

          {/* Geleverde tekeningen */}
          {opdracht.tekeningen?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />Geleverde tekeningen
              </p>
              <div className="grid grid-cols-3 gap-2">
                {opdracht.tekeningen.map((url, i) => {
                  const isImg = /\.(jpg|jpeg|png|gif|webp)/i.test(url);
                  return isImg ? (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg overflow-hidden border border-slate-200">
                      <img src={url} alt="" className="w-full h-20 object-cover" />
                    </a>
                  ) : (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-slate-200 bg-slate-50 h-20 flex flex-col items-center justify-center gap-1">
                      <FileText className="w-5 h-5 text-slate-400" />
                      <span className="text-xs text-blue-600 flex items-center gap-0.5">
                        <ExternalLink className="w-3 h-3" />Openen
                      </span>
                    </a>
                  );
                })}
              </div>
              {opdracht.notities_tekenaar && (
                <div className="mt-2 bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Notities tekenaar</p>
                  <p className="text-sm text-slate-700">{opdracht.notities_tekenaar}</p>
                </div>
              )}
            </div>
          )}

          {/* Verkoper: notities + bevestigen */}
          {isVerkoper && opdracht.status === 'geleverd' && (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-500" />Jouw opmerkingen (verkoper)
              </p>
              <Textarea value={notitiesVerkoper} onChange={e => setNotitiesVerkoper(e.target.value)}
                placeholder="Feedback of opmerkingen voor de klant..." className="min-h-[80px] rounded-xl border-slate-200" />
              <Button onClick={handleVerkoperSave} disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 rounded-xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Opslaan & gezien
              </Button>
            </div>
          )}

          {opdracht.notities_verkoper && (
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">Opmerkingen verkoper</p>
              <p className="text-sm text-indigo-800">{opdracht.notities_verkoper}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function TekeningOpdrachten() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('open');
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: opdrachten = [], isLoading } = useQuery({
    queryKey: ['tekening-opdrachten'],
    queryFn: () => base44.entities.TekeningOpdracht.list('-created_date', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ opdrachtId, data }) => base44.entities.TekeningOpdracht.update(opdrachtId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tekening-opdrachten'] }),
  });

  const filtered = opdrachten.filter(o => {
    if (tab === 'open') return o.status === 'open';
    if (tab === 'actief') return o.status === 'in_behandeling';
    if (tab === 'geleverd') return o.status === 'geleverd';
    return true;
  });

  const newCount = opdrachten.filter(o => o.status === 'geleverd' && !o.verkoper_gezien).length;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-slate-900">Tekeningen</h1>
        {newCount > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">{newCount} nieuw</span>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full bg-slate-100 rounded-xl h-10">
          <TabsTrigger value="open" className="flex-1 rounded-lg text-xs">Open</TabsTrigger>
          <TabsTrigger value="actief" className="flex-1 rounded-lg text-xs">Actief</TabsTrigger>
          <TabsTrigger value="geleverd" className="flex-1 rounded-lg text-xs">Geleverd</TabsTrigger>
          <TabsTrigger value="alle" className="flex-1 rounded-lg text-xs">Alle</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(o => (
            <OpdrachtCard key={o.id} opdracht={o} user={user}
              onUpdate={(opdrachtId, data) => updateMutation.mutateAsync({ opdrachtId, data })} />
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center border-slate-200">
          <PenLine className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Geen tekening opdrachten</p>
        </Card>
      )}
    </div>
  );
}