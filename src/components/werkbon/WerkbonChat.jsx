import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Paperclip, X, Loader2, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

const GEADRESSEERDEN = [
  { value: '', label: 'Algemeen bericht' },
  { value: 'Verkoper', label: '→ Verkoper' },
  { value: 'Tekenaar', label: '→ Tekenaar' },
  { value: 'Buitendienst', label: '→ Buitendienst' },
  { value: 'Kantoor', label: '→ Kantoor' },
  { value: 'Inmeter', label: '→ Inmeter' },
];

const ROL_CONFIG = {
  admin:       { kleur: 'bg-slate-700 text-white',   label: 'Admin' },
  kantoor:     { kleur: 'bg-blue-600 text-white',    label: 'Kantoor' },
  buitendienst:{ kleur: 'bg-orange-500 text-white',  label: 'Buitendienst' },
  tekenaar:    { kleur: 'bg-violet-600 text-white',  label: 'Tekenaar' },
  verkoper:    { kleur: 'bg-emerald-600 text-white', label: 'Verkoper' },
};

const AAN_KLEUREN = {
  Verkoper:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  Tekenaar:    'bg-violet-100 text-violet-700 border-violet-200',
  Buitendienst:'bg-orange-100 text-orange-700 border-orange-200',
  Kantoor:     'bg-blue-100 text-blue-700 border-blue-200',
  Inmeter:     'bg-amber-100 text-amber-700 border-amber-200',
};

export default function WerkbonChat({ werkbonId, user }) {
  const [bericht, setBericht] = useState('');
  const [gerichtAan, setGerichtAan] = useState('');
  const [bijlage, setBijlage] = useState(null);
  const [bijlageNaam, setBijlageNaam] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: berichten = [], isLoading } = useQuery({
    queryKey: ['berichten', werkbonId],
    queryFn: () => base44.entities.WerkbonBericht.filter({ werkbon_id: werkbonId }, 'created_date', 100),
    enabled: !!werkbonId,
    refetchInterval: 15000,
    retry: false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [berichten.length]);

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.WerkbonBericht.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['berichten', werkbonId] });
      setBericht('');
      setGerichtAan('');
      setBijlage(null);
      setBijlageNaam('');
    },
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setBijlage(file_url);
    setBijlageNaam(file.name);
    setUploading(false);
  };

  const handleSend = () => {
    if (!bericht.trim() && !bijlage) return;
    sendMutation.mutate({
      werkbon_id: werkbonId,
      auteur_naam: user?.full_name || user?.email,
      auteur_email: user?.email,
      auteur_rol: user?.role || 'gebruiker',
      gericht_aan: gerichtAan || null,
      bericht: bericht.trim(),
      bijlage_url: bijlage || null,
      bijlage_naam: bijlageNaam || null,
    });
  };

  const initials = (naam) => naam ? naam.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const rolConfig = (rol) => ROL_CONFIG[rol] || { kleur: 'bg-slate-500 text-white', label: rol || 'Gebruiker' };

  return (
    <Card className="border-slate-200">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900">Berichten</h3>
        <span className="text-xs text-slate-400 ml-auto">Zichtbaar voor iedereen</span>
      </div>

      {/* Berichten */}
      <div className="p-3 space-y-4 max-h-80 overflow-y-auto bg-slate-50">
        {isLoading && <p className="text-xs text-slate-400 text-center py-4">Laden...</p>}
        {!isLoading && berichten.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">Nog geen berichten. Start de conversatie!</p>
        )}
        {berichten.map((b) => {
          const cfg = rolConfig(b.auteur_rol);
          const aanKleur = b.gericht_aan ? (AAN_KLEUREN[b.gericht_aan] || 'bg-slate-100 text-slate-600 border-slate-200') : null;
          return (
            <div key={b.id} className="flex gap-2.5">
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${cfg.kleur}`}>
                {initials(b.auteur_naam)}
              </div>
              <div className="flex-1 min-w-0">
                {/* Naam + rol + tijd */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="text-xs font-semibold text-slate-800">{b.auteur_naam || b.auteur_email}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.kleur}`}>{cfg.label}</span>
                  {b.gericht_aan && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${aanKleur}`}>
                      → {b.gericht_aan}
                    </span>
                  )}
                  <span className="text-xs text-slate-400 ml-auto">
                    {format(new Date(b.created_date), 'd MMM HH:mm', { locale: nl })}
                  </span>
                </div>
                {/* Bericht bubble */}
                <div className={`rounded-xl rounded-tl-sm px-3 py-2 text-sm bg-white border text-slate-800 ${b.gericht_aan ? 'border-l-2 ' + (aanKleur ? 'border-l-current' : 'border-slate-300') : 'border-slate-200'}`}>
                  {b.bericht && <p className="whitespace-pre-wrap">{b.bericht}</p>}
                  {b.bijlage_url && (
                    <a href={b.bijlage_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-600 underline">
                      <Paperclip className="w-3 h-3" />
                      {b.bijlage_naam || 'Bijlage'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 space-y-2 border-t border-slate-100 bg-white rounded-b-xl">
        <div className="relative">
          <select
            value={gerichtAan}
            onChange={(e) => setGerichtAan(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 appearance-none pr-7"
          >
            {GEADRESSEERDEN.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        <Textarea
          value={bericht}
          onChange={(e) => setBericht(e.target.value)}
          placeholder={gerichtAan ? `Bericht aan ${gerichtAan}...` : 'Schrijf een algemeen bericht...'}
          className="min-h-[70px] text-sm rounded-xl border-slate-200 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />

        {bijlage && (
          <div className="flex items-center gap-2 bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-lg">
            <Paperclip className="w-3 h-3" />
            <span className="truncate flex-1">{bijlageNaam}</span>
            <button onClick={() => { setBijlage(null); setBijlageNaam(''); }}>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="cursor-pointer p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" /> : <Paperclip className="w-4 h-4 text-slate-400" />}
            <input type="file" className="hidden" onChange={handleFileSelect} disabled={uploading} />
          </label>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || (!bericht.trim() && !bijlage)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 h-9 rounded-xl text-sm"
          >
            {sendMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Send className="w-3.5 h-3.5 mr-1.5" />Versturen</>
            }
          </Button>
        </div>
      </div>
    </Card>
  );
}