import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Users } from 'lucide-react';

const roles = [
  { role: 'admin', label: 'Admin', email: 'admin@test.nl', fullName: 'Admin' },
  { role: 'kantoor', label: 'Kantoor', email: 'kantoor@test.nl', fullName: 'Kantoor Medewerker' },
  { role: 'buitendienst', label: 'Buitendienst', email: 'buitendienst@test.nl', fullName: 'Buitendienst' },
  { role: 'tekenaar', label: 'Tekenaar', email: 'tekenaar@test.nl', fullName: 'Tekenaar' },
  { role: 'verkoper', label: 'Verkoper', email: 'verkoper@test.nl', fullName: 'Verkoper' },
];

export default function DevLogin() {
  const [user, setUser] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const handleLogin = async (email) => {
    try {
      await base44.auth.login(email);
      const redirect = searchParams.get('redirect');
      if (redirect) {
        window.location.href = redirect;
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 border-slate-200 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Ingelogd</h1>
            <p className="text-sm text-slate-600">Je bent ingelogd als <span className="font-semibold">{user.full_name}</span> ({user.role})</p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-slate-600">Email: <span className="font-mono">{user.email}</span></p>
            <p className="text-sm text-slate-600">Rol: <span className="font-semibold capitalize">{user.role}</span></p>
          </div>

          <Button 
            onClick={() => base44.auth.logout()}
            className="w-full"
          >
            Uitloggen
          </Button>

          <Button 
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Naar Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 border-slate-200 space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Kies je rol</h1>
          <p className="text-sm text-slate-600">Selecteer een account om in te loggen</p>
        </div>

        <div className="space-y-2">
          {roles.map(({ role, label, email, fullName }) => (
            <button
              key={role}
              onClick={() => handleLogin(email)}
              className="w-full text-left p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition-colors"
            >
              <p className="font-semibold text-slate-900">{fullName}</p>
              <p className="text-xs text-slate-500">{email} · <span className="capitalize">{role}</span></p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
