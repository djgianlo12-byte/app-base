import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, MapPin, Clock, User, Phone, FileText, Image,
  Hand, Calendar, Navigation, CheckCircle2, ExternalLink, Loader2, UserX, Mail, Trash2, Pencil
} from 'lucide-react';
import StatusBadge from '../components/werkbon/StatusBadge';
import TypeBadge from '../components/werkbon/TypeBadge';
import PrioriteitIndicator from '../components/werkbon/PrioriteitIndicator';
import FileUploader from '../components/werkbon/FileUploader';
import WerkbonChat from '../components/werkbon/WerkbonChat';
import WerkbonLogViewer from '../components/werkbon/WerkbonLogViewer';
import { logWerkbonActie } from '@/lib/logAction';

export default function WerkbonDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [notities, setNotities] = useState('');
  const [documentatie, setDocumentatie] = useState([]);
  const [showAfrondenPanel, setShowAfrondenPanel] = useState(false);

  useEffect(() => { base44.auth.me().then(setUser); }, []);

  const { data: werkbon, isLoading } = useQuery({
    queryKey: ['werkbon', id],
    queryFn: () => base44.entities.Werkbon.filter({ id }),
    select: (data) => data[0],
    enabled: !!id,
  });

  useEffect(() => {
    if (werkbon) {
      setNotities(werkbon.notities || '');
      setDocumentatie(werkbon.documentatie || []);
    }
  }, [werkbon]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Werkbon.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['werkbon', id] }),
  });

  const handleClaim = async () => {
    await updateMutation.mutateAsync({
      geclaimd_door: user.email,
      geclaimd_door_naam: user.full_name,
      status: 'geclaimd',
    });
    await logWerkbonActie({
      werkbon_id: id,
      actie: 'geclaimd',
      beschrijving: `Werkbon geclaimd door ${user.full_name}`,
    });
    // Na claimen direct naar inplan-agenda
    navigate(createPageUrl(`InplanWerkbon?id=${id}`));
  };

  const handleStatusUpdate = (status) => {
    updateMutation.mutate({ status });
  };

  const handleAfronden = async () => {
    await updateMutation.mutateAsync({
      status: 'afgerond',
      notities,
      documentatie,
    });
    await logWerkbonActie({
      werkbon_id: id,
      actie: 'afgerond',
      beschrijving: `Werkbon afgerond door ${user.full_name}${notities ? ': ' + notities.substring(0, 80) : ''}`,
      oude_waarde: werkbon.status,
      nieuwe_waarde: 'afgerond',
    });
    // Bij Inmeten: automatisch tekening-opdracht aanmaken
    if (werkbon.type === 'Inmeten') {
      await base44.entities.TekeningOpdracht.create({
        werkbon_id: werkbon.id,
        werkbon_titel: werkbon.titel,
        adres: werkbon.adres,
        stad: werkbon.stad,
        status: 'open',
        inmeet_fotos: [...(werkbon.fotos || []), ...documentatie],
        notities_buitendienst: notities,
        contactpersoon: werkbon.contactpersoon,
        contact_telefoon: werkbon.contact_telefoon,
      });
    }
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({ notities, documentatie });
  };

  const openInMaps = () => {
    const address = `${werkbon.adres}, ${werkbon.postcode || ''} ${werkbon.stad || ''}, Nederland`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!werkbon) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Werkbon niet gevonden</p>
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="link" className="mt-2">Terug naar dashboard</Button>
        </Link>
      </div>
    );
  }

  const isMine = werkbon.geclaimd_door === user?.email;
  const isAdmin = user?.role === 'admin' || user?.role === 'kantoor';
  const isVerkoper = user?.role === 'verkoper';
  const canEdit = isAdmin || isVerkoper;
  const canClaim = werkbon.status === 'open';
  const canVrijgeven = isMine || isAdmin;
  const canDelete = canEdit;
  const canPlan = isMine && (werkbon.status === 'geclaimd' || werkbon.status === 'ingepland');
  const canAfronden = isMine && werkbon.status !== 'open' && werkbon.status !== 'afgerond';

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <Link to={createPageUrl('Werkbonnen')}>
          <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{werkbon.titel}</h1>
          <div className="flex items-center gap-2 mt-1">
            <TypeBadge type={werkbon.type} />
            <StatusBadge status={werkbon.status} />
            <PrioriteitIndicator prioriteit={werkbon.prioriteit} showLabel />
          </div>
        </div>
      </div>

      {/* Info */}
      <Card className="p-4 border-slate-200 space-y-3">
        {werkbon.beschrijving && (
          <p className="text-sm text-slate-600 leading-relaxed">{werkbon.beschrijving}</p>
        )}

        <div className="space-y-2.5 pt-1">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-slate-700">{werkbon.adres}</p>
              {(werkbon.postcode || werkbon.stad) && (
                <p className="text-xs text-slate-500">{werkbon.postcode} {werkbon.stad}</p>
              )}
            </div>
          </div>

          {werkbon.geschatte_duur && (
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-700">{werkbon.geschatte_duur} uur geschat</p>
            </div>
          )}

          {werkbon.geclaimd_door_naam && (
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-700">{werkbon.geclaimd_door_naam}</p>
            </div>
          )}

          {werkbon.geplande_datum && (
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-700">
                {format(new Date(werkbon.geplande_datum), 'd MMMM yyyy', { locale: nl })}
                {werkbon.geplande_tijd && ` om ${werkbon.geplande_tijd}`}
              </p>
            </div>
          )}

          {werkbon.contactpersoon && (
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-700">{werkbon.contactpersoon}</p>
                {werkbon.contact_telefoon && (
                  <p className="text-xs text-slate-500">{werkbon.contact_telefoon}</p>
                )}
              </div>
              {werkbon.contact_telefoon && (
                <a
                  href={`tel:${werkbon.contact_telefoon}`}
                  onClick={() => logWerkbonActie({
                    werkbon_id: id,
                    actie: 'gebeld',
                    beschrijving: `${user?.full_name || 'Medewerker'} heeft ${werkbon.contactpersoon} gebeld (${werkbon.contact_telefoon})`,
                  })}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  <Phone className="w-3.5 h-3.5" />Bellen
                </a>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Foto's */}
      {werkbon.fotos?.length > 0 && (
        <Card className="p-4 border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Image className="w-4 h-4" />Foto's
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {werkbon.fotos.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg overflow-hidden border border-slate-200">
                <img src={url} alt="" className="w-full h-20 object-cover" />
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Bijlagen & e-mails (alleen weergave) */}
      {(werkbon.bijlagen?.length > 0 || werkbon.email_links?.length > 0) && (
        <Card className="p-4 border-slate-200 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />Bijlagen & E-mails
          </h3>
          {werkbon.bijlagen?.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-sm text-blue-600">
              <ExternalLink className="w-3.5 h-3.5" />Bijlage {i + 1}
            </a>
          ))}
          {werkbon.email_links?.map((item, i) => (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{item.label || `E-mail ${i + 1}`}</span>
              <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
            </a>
          ))}
        </Card>
      )}

      {/* Navigate */}
      <Button variant="outline" onClick={openInMaps} className="w-full h-11 rounded-xl border-slate-200">
        <Navigation className="w-4 h-4 mr-2" />
        Navigeer naar locatie
      </Button>

      {/* Actions */}
      <div className="space-y-3">
        {/* Bewerken / Verwijderen (verkoper + admin) */}
        {canDelete && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => navigate(createPageUrl(`WerkbonAanmaken?edit=${id}`))}
              className="h-10 rounded-xl border-slate-200 text-slate-700">
              <Pencil className="w-4 h-4 mr-2" />Bewerken
            </Button>
            <button
              onClick={async () => {
                if (window.confirm('Werkbon definitief verwijderen?')) {
                  await base44.entities.Werkbon.delete(id);
                  navigate(createPageUrl('Werkbonnen'));
                }
              }}
              className="h-10 flex items-center justify-center gap-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />Verwijderen
            </button>
          </div>
        )}

        {/* Vrijgeven knop */}
        {canVrijgeven && werkbon.status !== 'open' && werkbon.status !== 'afgerond' && (
          <button
            onClick={async () => {
              if (window.confirm('Werkbon vrijgeven? Deze wordt dan weer beschikbaar voor anderen.')) {
                await updateMutation.mutateAsync({
                  status: 'open',
                  geclaimd_door: null,
                  geclaimd_door_naam: null,
                  geplande_datum: null,
                  geplande_tijd: null,
                });
                await logWerkbonActie({
                  werkbon_id: id,
                  actie: 'vrijgegeven',
                  beschrijving: `Werkbon vrijgegeven door ${user.full_name}`,
                  oude_waarde: werkbon.geclaimd_door_naam || werkbon.geclaimd_door,
                  nieuwe_waarde: 'open',
                });
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            <UserX className="w-4 h-4" />
            Werkbon vrijgeven aan anderen
          </button>
        )}

        {canClaim && (
          <Button onClick={handleClaim} disabled={updateMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl font-semibold">
            {updateMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Even wachten...</>
              : <><Hand className="w-4 h-4 mr-2" />Claimen & inplannen in agenda</>
            }
          </Button>
        )}

        {canPlan && (
          <Button onClick={() => navigate(createPageUrl(`InplanWerkbon?id=${id}`))}
            className="w-full bg-violet-600 hover:bg-violet-700 h-12 rounded-xl font-semibold">
            <Calendar className="w-4 h-4 mr-2" />Herplannen in agenda
          </Button>
        )}

        {canAfronden && !showAfrondenPanel && (
          <Button onClick={() => setShowAfrondenPanel(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-semibold">
            <CheckCircle2 className="w-4 h-4 mr-2" />Werk afronden
          </Button>
        )}

        {canAfronden && showAfrondenPanel && (
          <Card className="p-4 border-emerald-200 bg-emerald-50/30 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />Werk afronden
            </h3>
            <Textarea
              value={notities}
              onChange={(e) => setNotities(e.target.value)}
              placeholder="Voeg notities toe voor de tekenaar / verkoper..."
              className="min-h-[100px] rounded-xl bg-white border-slate-200"
            />
            {werkbon.type === 'Inmeten' && (
              <FileUploader
                label="Inmeet foto's uploaden (voor tekenaar)"
                files={werkbon.fotos || []}
                onChange={(urls) => updateMutation.mutate({ fotos: urls })}
              />
            )}
            <FileUploader
              label="Documentatie uploaden"
              files={documentatie}
              onChange={setDocumentatie}
            />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowAfrondenPanel(false)} className="h-11 rounded-xl">
                Annuleren
              </Button>
              <Button onClick={handleAfronden} disabled={updateMutation.isPending}
                className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold">
                {updateMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4 mr-1.5" />Afronden</>}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Chat */}
      <WerkbonChat werkbonId={id} user={user} />

      {/* Activiteitenlog */}
      <WerkbonLogViewer werkbonId={id} />

      {/* Afgerond info */}
      {werkbon.status === 'afgerond' && (
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-800">Afgerond</h3>
          </div>
          {werkbon.notities && <p className="text-sm text-emerald-700 mb-2">{werkbon.notities}</p>}
          {werkbon.documentatie?.length > 0 && (
            <div className="space-y-1">
              {werkbon.documentatie.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-emerald-700 underline">
                  <FileText className="w-3.5 h-3.5" />Document {i + 1}
                </a>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}