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

  return (data || []) as McsoBooking[];
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
