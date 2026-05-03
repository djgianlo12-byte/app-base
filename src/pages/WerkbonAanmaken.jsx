import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Mail, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import FileUploader from '../components/werkbon/FileUploader';
import { logWerkbonActie } from '@/lib/logAction';

const TYPES = ["Keuring", "Oplevering", "Montagewerk", "Magazijn keuring", "Jaarlijkse keuring", "Inmeten"];
const PRIORITEITEN = [
  { value: "laag", label: "Laag" },
  { value: "normaal", label: "Normaal" },
  { value: "hoog", label: "Hoog" },
  { value: "spoed", label: "Spoed" },
];

export default function WerkbonAanmaken() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [form, setForm] = useState({
    titel: '',
    beschrijving: '',
    type: '',
    prioriteit: 'normaal',
    adres: '',
    stad: '',
    postcode: '',
    geschatte_duur: '',
    contactpersoon: '',
    contact_telefoon: '',
    contact_email: '',
    fotos: [],
    bijlagen: [],
    email_links: [],
  });
  const [emailLink, setEmailLink] = useState('');

  useEffect(() => {
    if (!editId) return;
    base44.entities.Werkbon.filter({ id: editId }).then(data => {
      const w = data[0];
      if (w) {
        setForm({
          titel: w.titel || '',
          beschrijving: w.beschrijving || '',
          type: w.type || '',
          prioriteit: w.prioriteit || 'normaal',
          adres: w.adres || '',
          stad: w.stad || '',
          postcode: w.postcode || '',
          geschatte_duur: w.geschatte_duur != null ? String(w.geschatte_duur) : '',
          contactpersoon: w.contactpersoon || '',
          contact_telefoon: w.contact_telefoon || '',
          contact_email: w.contact_email || '',
          fotos: w.fotos || [],
          bijlagen: w.bijlagen || [],
          email_links: w.email_links || [],
        });
      }
      setLoading(false);
    });
  }, [editId]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editId) {
      await base44.entities.Werkbon.update(editId, {
        ...form,
        geschatte_duur: form.geschatte_duur ? parseFloat(form.geschatte_duur) : null,
      });
      await logWerkbonActie({
        werkbon_id: editId,
        actie: 'bewerkt',
        beschrijving: `Werkbon bewerkt: ${form.titel}`,
      });
      navigate(createPageUrl(`WerkbonDetail?id=${editId}`));
    } else {
      const nieuw = await base44.entities.Werkbon.create({
        ...form,
        geschatte_duur: form.geschatte_duur ? parseFloat(form.geschatte_duur) : null,
        status: 'open',
      });
      await logWerkbonActie({
        werkbon_id: nieuw.id,
        actie: 'aangemaakt',
        beschrijving: `Werkbon aangemaakt: ${form.titel} (${form.type}) – ${form.adres}${form.stad ? ', ' + form.stad : ''}`,
      });
      navigate(createPageUrl('Werkbonnen'));
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-bold text-slate-900">{editId ? 'Werkbon bewerken' : 'Nieuwe werkbon'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basisinfo */}
        <Card className="p-4 space-y-4 border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Basisinformatie</h2>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Titel *</Label>
            <Input
              value={form.titel}
              onChange={(e) => updateField('titel', e.target.value)}
              placeholder="Bijv. Keuring verwarmingsinstallatie"
              className="h-11 rounded-xl bg-white border-slate-200"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Beschrijving</Label>
            <Textarea
              value={form.beschrijving}
              onChange={(e) => updateField('beschrijving', e.target.value)}
              placeholder="Beschrijf het werk dat uitgevoerd moet worden..."
              className="min-h-[100px] rounded-xl bg-white border-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Type *</Label>
              <Select value={form.type} onValueChange={(v) => updateField('type', v)} required>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                  <SelectValue placeholder="Selecteer" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Prioriteit</Label>
              <Select value={form.prioriteit} onValueChange={(v) => updateField('prioriteit', v)}>
                <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITEITEN.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Geschatte duur (uren)</Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={form.geschatte_duur}
              onChange={(e) => updateField('geschatte_duur', e.target.value)}
              placeholder="Bijv. 2.5"
              className="h-11 rounded-xl bg-white border-slate-200"
            />
          </div>
        </Card>

        {/* Locatie */}
        <Card className="p-4 space-y-4 border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Locatie</h2>
          
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">Adres *</Label>
            <Input
              value={form.adres}
              onChange={(e) => updateField('adres', e.target.value)}
              placeholder="Straatnaam en huisnummer"
              className="h-11 rounded-xl bg-white border-slate-200"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Stad</Label>
              <Input
                value={form.stad}
                onChange={(e) => updateField('stad', e.target.value)}
                placeholder="Stad"
                className="h-11 rounded-xl bg-white border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Postcode</Label>
              <Input
                value={form.postcode}
                onChange={(e) => updateField('postcode', e.target.value)}
                placeholder="1234 AB"
                className="h-11 rounded-xl bg-white border-slate-200"
              />
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card className="p-4 space-y-4 border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Contactpersoon</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Naam</Label>
              <Input
                value={form.contactpersoon}
                onChange={(e) => updateField('contactpersoon', e.target.value)}
                placeholder="Naam"
                className="h-11 rounded-xl bg-white border-slate-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Telefoon</Label>
              <Input
                value={form.contact_telefoon}
                onChange={(e) => updateField('contact_telefoon', e.target.value)}
                placeholder="06-12345678"
                className="h-11 rounded-xl bg-white border-slate-200"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">E-mailadres klant</Label>
            <Input
              type="email"
              value={form.contact_email}
              onChange={(e) => updateField('contact_email', e.target.value)}
              placeholder="klant@voorbeeld.nl"
              className="h-11 rounded-xl bg-white border-slate-200"
            />
          </div>
        </Card>

        {/* Bestanden */}
        <Card className="p-4 space-y-4 border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Bestanden</h2>
          <FileUploader
            label="Foto's"
            files={form.fotos}
            onChange={(urls) => updateField('fotos', urls)}
            accept="image/*"
          />
          <FileUploader
            label="Bijlagen"
            files={form.bijlagen}
            onChange={(urls) => updateField('bijlagen', urls)}
          />
        </Card>

        {/* Outlook e-mail koppelen */}
        <Card className="p-4 space-y-3 border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">E-mails koppelen (optioneel)</h2>
          <p className="text-xs text-slate-500">Kopieer een e-maillink uit Outlook en plak hem hieronder.</p>

          {form.email_links.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate flex-1">{item.label}</span>
              <button type="button" onClick={() => updateField('email_links', form.email_links.filter((_, j) => j !== i))}>
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              type="url"
              value={emailLink}
              onChange={(e) => setEmailLink(e.target.value)}
              placeholder="https://outlook.office.com/mail/..."
              className="h-10 rounded-xl bg-white border-slate-200 flex-1 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl shrink-0"
              disabled={!emailLink.trim()}
              onClick={() => {
                const num = form.email_links.length + 1;
                updateField('email_links', [...form.email_links, { url: emailLink.trim(), label: `E-mail ${num}` }]);
                setEmailLink('');
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <Button
          type="submit"
          disabled={saving || !form.titel || !form.type || !form.adres}
          className="w-full bg-blue-600 hover:bg-blue-700 h-12 rounded-xl font-semibold"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opslaan...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />{editId ? 'Wijzigingen opslaan' : 'Werkbon aanmaken'}</>
          )}
        </Button>
      </form>
    </div>
  );
}