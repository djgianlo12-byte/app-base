import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const { event, data, old_data, changed_fields } = body;

    const b44 = base44.asServiceRole;

    const werkbon_id = data?.id || event?.entity_id;
    if (!werkbon_id) return Response.json({ ok: true });

    // Probeer de gebruiker op te halen die de actie heeft uitgevoerd
    // Bij create: created_by bevat het email adres
    // Bij update: probeer via geclaimd_door of updated_by
    let uitvoerder_email = 'systeem';
    let uitvoerder_naam = 'Onbekend';

    if (event.type === 'create') {
      // created_by is het email van de maker
      uitvoerder_email = data?.created_by || 'systeem';
      uitvoerder_naam = uitvoerder_email;
      // Zoek de volledige naam op via de User entiteit
      if (uitvoerder_email && uitvoerder_email !== 'systeem') {
        const users = await b44.entities.User.filter({ email: uitvoerder_email });
        if (users && users.length > 0) {
          uitvoerder_naam = users[0].full_name || uitvoerder_email;
        }
      }
    } else if (event.type === 'update') {
      // Bij status geclaimd: gebruik geclaimd_door
      uitvoerder_email = data?.geclaimd_door || old_data?.geclaimd_door || 'systeem';
      uitvoerder_naam = data?.geclaimd_door_naam || old_data?.geclaimd_door_naam || uitvoerder_email;
    }

    const logEntries = [];
    const now = new Date();
    const datumTijd = now.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

    if (event.type === 'create') {
      logEntries.push({
        werkbon_id,
        gebruiker_naam: uitvoerder_naam,
        gebruiker_email: uitvoerder_email,
        actie: 'aangemaakt',
        beschrijving: `Werkbon aangemaakt op ${datumTijd} door ${uitvoerder_naam} (${uitvoerder_email}) — "${data.titel}" | Type: ${data.type} | Adres: ${data.adres}${data.stad ? ', ' + data.stad : ''}`,
      });
    }

    if (event.type === 'update' && changed_fields) {
      // Status wijzigingen
      if (changed_fields.includes('status')) {
        const oudStatus = old_data?.status;
        const nieuwStatus = data?.status;

        if (nieuwStatus === 'geclaimd' && oudStatus !== 'geclaimd') {
          logEntries.push({
            werkbon_id,
            gebruiker_naam: data.geclaimd_door_naam || uitvoerder_naam,
            gebruiker_email: data.geclaimd_door || uitvoerder_email,
            actie: 'geclaimd',
            beschrijving: `Werkbon geclaimd op ${datumTijd} door ${data.geclaimd_door_naam || data.geclaimd_door}`,
            oude_waarde: oudStatus,
            nieuwe_waarde: 'geclaimd',
          });
        } else if (nieuwStatus === 'open' && oudStatus !== 'open') {
          logEntries.push({
            werkbon_id,
            gebruiker_naam: old_data?.geclaimd_door_naam || 'Onbekend',
            gebruiker_email: old_data?.geclaimd_door || 'systeem',
            actie: 'vrijgegeven',
            beschrijving: `Werkbon vrijgegeven op ${datumTijd} (was bij: ${old_data?.geclaimd_door_naam || old_data?.geclaimd_door || 'onbekend'})`,
            oude_waarde: oudStatus,
            nieuwe_waarde: 'open',
          });
        } else if (nieuwStatus === 'ingepland') {
          logEntries.push({
            werkbon_id,
            gebruiker_naam: data.geclaimd_door_naam || uitvoerder_naam,
            gebruiker_email: data.geclaimd_door || uitvoerder_email,
            actie: 'ingepland',
            beschrijving: `Ingepland op ${datumTijd} — uitvoeringsdatum: ${data.geplande_datum || '?'}${data.geplande_tijd ? ' om ' + data.geplande_tijd : ''}`,
            nieuwe_waarde: `${data.geplande_datum || ''} ${data.geplande_tijd || ''}`.trim(),
          });
        } else if (nieuwStatus === 'afgerond') {
          logEntries.push({
            werkbon_id,
            gebruiker_naam: data.geclaimd_door_naam || uitvoerder_naam,
            gebruiker_email: data.geclaimd_door || uitvoerder_email,
            actie: 'afgerond',
            beschrijving: `Werkbon afgerond op ${datumTijd} door ${data.geclaimd_door_naam || data.geclaimd_door || 'onbekend'}`,
            oude_waarde: oudStatus,
            nieuwe_waarde: 'afgerond',
          });
        } else if (oudStatus && nieuwStatus && oudStatus !== nieuwStatus) {
          logEntries.push({
            werkbon_id,
            gebruiker_naam: uitvoerder_naam,
            gebruiker_email: uitvoerder_email,
            actie: 'status_gewijzigd',
            beschrijving: `Status gewijzigd op ${datumTijd}`,
            oude_waarde: oudStatus,
            nieuwe_waarde: nieuwStatus,
          });
        }
      }

      // Ingepland (datum/tijd veranderd zonder status change)
      if (!changed_fields.includes('status') && (changed_fields.includes('geplande_datum') || changed_fields.includes('geplande_tijd'))) {
        const datumStr = data.geplande_datum || '';
        const tijdStr = data.geplande_tijd || '';
        logEntries.push({
          werkbon_id,
          gebruiker_naam: data.geclaimd_door_naam || uitvoerder_naam,
          gebruiker_email: data.geclaimd_door || uitvoerder_email,
          actie: 'ingepland',
          beschrijving: `Ingepland op ${datumTijd} — uitvoeringsdatum: ${datumStr}${tijdStr ? ' om ' + tijdStr : ''}`,
          oude_waarde: old_data?.geplande_datum ? `${old_data.geplande_datum} ${old_data.geplande_tijd || ''}`.trim() : null,
          nieuwe_waarde: `${datumStr} ${tijdStr}`.trim(),
        });
      }

      // Bewerkt: veld-wijzigingen in basisgegevens (titel, beschrijving, adres, contactpersoon, etc.)
      const bewerkVelden = ['titel', 'beschrijving', 'adres', 'stad', 'postcode', 'type', 'prioriteit', 'geschatte_duur', 'contactpersoon', 'contact_telefoon', 'contact_email'];
      const gewijzigdeBewerkVelden = changed_fields.filter(f => bewerkVelden.includes(f));

      if (gewijzigdeBewerkVelden.length > 0 && !changed_fields.includes('status')) {
        // Probeer de bewerker op te halen — zoek user op via geclaimd_door of created_by
        let bewerker_naam = uitvoerder_naam;
        let bewerker_email = uitvoerder_email;
        // Als de bewerker de admin/kantoor is (niet de geclaimed medewerker), gebruik de created_by
        if (data?.created_by && data.created_by !== data?.geclaimd_door) {
          const users = await b44.entities.User.filter({ email: data.created_by });
          if (users && users.length > 0) {
            bewerker_naam = users[0].full_name || data.created_by;
            bewerker_email = data.created_by;
          }
        }

        const veldLabels = {
          titel: 'Titel', beschrijving: 'Beschrijving', adres: 'Adres', stad: 'Stad',
          postcode: 'Postcode', type: 'Type', prioriteit: 'Prioriteit',
          geschatte_duur: 'Geschatte duur', contactpersoon: 'Contactpersoon',
          contact_telefoon: 'Telefoon', contact_email: 'E-mailadres klant'
        };

        const veldOmschrijving = gewijzigdeBewerkVelden
          .map(f => `${veldLabels[f] || f}: "${old_data?.[f] || '—'}" → "${data[f] || '—'}"`)
          .join(' | ');

        logEntries.push({
          werkbon_id,
          gebruiker_naam: bewerker_naam,
          gebruiker_email: bewerker_email,
          actie: 'bewerkt',
          beschrijving: `Werkbon bewerkt op ${datumTijd} door ${bewerker_naam} — ${veldOmschrijving}`,
        });
      }

      // Notities toegevoegd
      if (changed_fields.includes('notities') && data.notities && data.notities !== old_data?.notities) {
        logEntries.push({
          werkbon_id,
          gebruiker_naam: uitvoerder_naam,
          gebruiker_email: uitvoerder_email,
          actie: 'notities_toegevoegd',
          beschrijving: `Notities bijgewerkt op ${datumTijd} door ${uitvoerder_naam}`,
        });
      }
    }

    // Sla alle log entries op
    for (const entry of logEntries) {
      await b44.entities.WerkbonLog.create(entry);
    }

    return Response.json({ ok: true, logged: logEntries.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});