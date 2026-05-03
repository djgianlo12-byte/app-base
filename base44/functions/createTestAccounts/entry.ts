import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Alleen admins kunnen test-accounts aanmaken' }, { status: 403 });
    }

    const testAccounts = [
      { email: 'admin@werkbon.test', role: 'admin', name: 'Test Admin' },
      { email: 'kantoor@werkbon.test', role: 'kantoor', name: 'Test Kantoor' },
      { email: 'buitendienst@werkbon.test', role: 'buitendienst', name: 'Test Buitendienst' },
      { email: 'tekenaar@werkbon.test', role: 'tekenaar', name: 'Test Tekenaar' },
      { email: 'verkoper@werkbon.test', role: 'verkoper', name: 'Test Verkoper' },
    ];

    const results = [];
    for (const account of testAccounts) {
      try {
        await base44.users.inviteUser(account.email, account.role);
        results.push({ email: account.email, role: account.role, status: 'uitgenodigd' });
      } catch (error) {
        results.push({ email: account.email, role: account.role, status: 'fout', message: error.message });
      }
    }

    return Response.json({ success: true, accounts: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});