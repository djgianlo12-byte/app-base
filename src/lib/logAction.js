import { base44 } from '@/api/base44Client';

/**
 * Log een actie op een werkbon
 */
export async function logWerkbonActie({ werkbon_id, actie, beschrijving, oude_waarde, nieuwe_waarde }) {
  try {
    await base44.functions.invoke('logWerkbonAction', {
      werkbon_id,
      actie,
      beschrijving: beschrijving || null,
      oude_waarde: oude_waarde || null,
      nieuwe_waarde: nieuwe_waarde || null,
    });
  } catch (e) {
    // Logging mag app niet breken
    console.warn('Log mislukt:', e);
  }
}