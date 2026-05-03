import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { werkbon_id, actie, beschrijving, oude_waarde, nieuwe_waarde } = await req.json();

    if (!werkbon_id || !actie) {
      return Response.json({ error: 'werkbon_id en actie zijn verplicht' }, { status: 400 });
    }

    await base44.entities.WerkbonLog.create({
      werkbon_id,
      gebruiker_naam: user.full_name,
      gebruiker_email: user.email,
      actie,
      beschrijving: beschrijving || null,
      oude_waarde: oude_waarde || null,
      nieuwe_waarde: nieuwe_waarde || null,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});