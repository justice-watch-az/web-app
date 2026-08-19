import { supabase } from './supabase';
import type { McsoBooking } from '../types/database';

/**
 * MCSO booking wall leads (mugshot source).
 * Ordered DUI-first, then newest first_seen_at.
 */
export const getBookings = async (limit = 200): Promise<McsoBooking[]> => {
  const { data, error } = await supabase
    .from('mcso_bookings')
    .select(
      'id, booking_number, first_name, last_name, charges, charges_raw, arresting_agency, is_dui, mugshot_b64, source, first_seen_at, created_at'
    )
    .order('is_dui', { ascending: false })
    .order('first_seen_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching mcso_bookings:', error);
    throw error;
  }

  const mcso = (data || []) as McsoBooking[];

  // YCSO (Yavapai) confirmed-DUI bookings — RLS only exposes is_dui = true.
  // Roster has no mugshots and no charges; DUI verdict comes from AZ Public
  // Access enrichment, so charges_raw states the provenance.
  const { data: ycsoData, error: ycsoError } = await supabase
    .from('ycso_bookings')
    .select('id, inmate_number, first_name, last_name, is_dui, source, first_seen_at, created_at')
    .order('first_seen_at', { ascending: false })
    .limit(limit);

  if (ycsoError) {
    // Table/policy may not exist yet in some environments — MCSO still works.
    console.warn('ycso_bookings unavailable (ok pre-migration):', ycsoError);
    return mcso;
  }

  const ycso = ((ycsoData || []) as Record<string, unknown>[]).map((r) => ({
    id: r.id,
    booking_number: r.inmate_number,
    first_name: r.first_name,
    last_name: r.last_name,
    charges: [],
    charges_raw: 'DUI — confirmed via AZ Public Access',
    arresting_agency: 'Yavapai County Sheriff',
    is_dui: true,
    mugshot_b64: null,
    source: r.source || 'ycso_booking',
    first_seen_at: r.first_seen_at,
    created_at: r.created_at,
  })) as McsoBooking[];

  return [...mcso, ...ycso].sort((a, b) =>
    (b.first_seen_at || '').localeCompare(a.first_seen_at || '')
  );
};

export const searchBookings = async (term: string): Promise<McsoBooking[]> => {
  const q = term.trim();
  if (!q) return getBookings();

  const { data, error } = await supabase
    .from('mcso_bookings')
    .select(
      'id, booking_number, first_name, last_name, charges, charges_raw, arresting_agency, is_dui, mugshot_b64, source, first_seen_at, created_at'
    )
    .or(
      `booking_number.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,charges_raw.ilike.%${q}%,arresting_agency.ilike.%${q}%`
    )
    .order('is_dui', { ascending: false })
    .order('first_seen_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Error searching mcso_bookings:', error);
    throw error;
  }

  return (data || []) as McsoBooking[];
};

export const isNewBooking = (firstSeenAt: string | null, hours = 24): boolean => {
  if (!firstSeenAt) return false;
  const t = new Date(firstSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < hours * 60 * 60 * 1000;
};
