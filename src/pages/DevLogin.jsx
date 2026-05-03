import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Copy, Check } from 'lucide-react';

const roles = [
  { role: 'admin', label: 'Admin', email: 'admin@test.nl' },
  { role: 'kantoor', label: 'Kantoor', email: 'kantoor@test.nl' },
  { role: 'buitendienst', label: 'Buitendienst', email: 'buitendienst@test.nl' },
  { role: 'tekenaar', label: 'Tekenaar', email: 'tekenaar@test.nl' },
  { role: 'verkoper', label: 'Verkoper', email: 'verkoper@test.nl' },
];

const password = 'Test123456!';

export default function DevLogin() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [copied, setCopied] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const createAccounts = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('createTestAccounts', {});
      setAccounts(result.data);
    } catch (error) {
      console.error('Error:', error);
      alert('Accounts al aangemaakt of fout bij aanmaken');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Dev Login</h1>
          <p className="text-slate-600 mb-4">Je moet ingelogd zijn als admin om test accounts aan te maken.</p>
          <Button onClick={() => base44.auth.redirectToLogin()} className="w-full">
            Inloggen
          </Button>
        </Card>
      </div>
    );
  }

  if (!accounts) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 border-slate-200 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Test Accounts</h1>
            <p className="text-sm text-slate-600">Maak test accounts aan voor alle rollen</p>
          </div>

          <Button 
            onClick={createAccounts} 
            disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Accounts aanmaken...
              </span>
            ) : (
              'Accounts aanmaken'
            )}
          </Button>

          <div className="pt-4 border-t border-slate-200">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => base44.auth.logout()}
            >
              Uitloggen
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 border-slate-200 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Login Gegevens</h1>
          <p className="text-sm text-slate-600">Accounts aangemaakt! Klik op email/wachtwoord om te kopiëren</p>
        </div>

        <div className="space-y-2">
          {roles.map(({ role, label, email }) => (
            <div key={role} className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-slate-900">{label}</p>
              <button
                onClick={() => copyToClipboard(email)}
                className="w-full flex items-center justify-between text-left text-sm p-2 bg-white rounded border border-slate-200 hover:border-blue-300 transition-colors"
              >
                <span className="text-slate-600">{email}</span>
                {copied === email ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <button
                onClick={() => copyToClipboard(password)}
                className="w-full flex items-center justify-between text-left text-sm p-2 bg-white rounded border border-slate-200 hover:border-blue-300 transition-colors"
              >
                <span className="text-slate-600">••••••••••</span>
                {copied === password ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          <Button 
            className="w-full"
            onClick={() => base44.auth.redirectToLogin()}
          >
            Ga naar inloggen
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => base44.auth.logout()}
          >
            Uitloggen
          </Button>
        </div>
      </Card>
    </div>
  );
}